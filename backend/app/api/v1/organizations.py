from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any, List
from app.models.schemas import Organization, WorkHoursConfig, AuditLog, ClientSite, ClientSiteCreate
from app.core.security import require_org_admin, require_super_admin, require_tenant_context
from app.db.store import store

router = APIRouter(prefix="/organizations", tags=["Organizations & Settings"])

@router.get("/my-org")
async def get_my_org(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    org_id = auth_ctx["org_id"]
    org = await store.find_one("organizations", {"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.put("/my-org/settings")
async def update_org_settings(
    settings_payload: Dict[str, Any],
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    update_data = {}
    for field in ["name", "work_hours", "gstin", "industry", "phone", "website", "address", "logo_url", "geofence"]:
        if field in settings_payload:
            update_data[field] = settings_payload[field]

    await store.update_one("organizations", {"id": org_id}, update_data)

    # Audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="UPDATE_ORG_SETTINGS",
        target_resource="Organization",
        target_id=org_id,
        details=update_data
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {"status": "success", "message": "Organization settings updated successfully."}

@router.get("/my-org/logo")
async def get_org_logo(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    """Retrieve company branding logo for the authenticated organization."""
    org_id = auth_ctx["org_id"]
    org = await store.find_one("organizations", {"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"status": "success", "logo_url": org.get("logo_url")}

@router.post("/my-org/logo")
async def upload_org_logo(
    payload: Dict[str, Any],
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Upload or update company branding logo for the authenticated organization."""
    org_id = auth_ctx["org_id"]
    logo_data = payload.get("logo") or payload.get("logo_url")
    if not logo_data:
        raise HTTPException(status_code=400, detail="Logo data or image URL is required.")

    await store.update_one("organizations", {"id": org_id}, {"logo_url": logo_data})

    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="UPLOAD_ORG_LOGO",
        target_resource="Organization",
        target_id=org_id,
        details={"has_logo": True}
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {"status": "success", "logo_url": logo_data, "message": "Organization logo uploaded and saved successfully."}

@router.delete("/my-org/logo")
async def remove_org_logo(
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Remove company branding logo for the authenticated organization."""
    org_id = auth_ctx["org_id"]
    await store.update_one("organizations", {"id": org_id}, {"logo_url": None})

    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="REMOVE_ORG_LOGO",
        target_resource="Organization",
        target_id=org_id,
        details={"has_logo": False}
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {"status": "success", "message": "Organization logo removed successfully."}

@router.get("/public/list")
async def get_public_orgs_list():
    orgs = await store.find_many("organizations", {"is_active": True})
    return [{"id": o["id"], "name": o["name"], "slug": o.get("slug", o["id"])} for o in orgs]

@router.get("/audit-logs")
async def get_audit_logs(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    org_id = auth_ctx["org_id"]
    logs = await store.find_many("audit_logs", {"organization_id": org_id}, sort_key="timestamp", sort_desc=True, limit=100)
    return logs

@router.get("/my-org/geofence")
async def get_org_geofence(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    """Retrieve geofencing perimeter and settings for the authenticated organization."""
    org_id = auth_ctx["org_id"]
    org = await store.find_one("organizations", {"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    default_geofence = {
        "is_enabled": False,
        "latitude": 13.0827,
        "longitude": 80.2707,
        "radius_meters": 150,
        "strict_enforcement": False,
        "office_name": org.get("name", "Headquarters")
    }
    return org.get("geofence") or default_geofence

@router.put("/my-org/geofence")
async def update_org_geofence(
    payload: Dict[str, Any],
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Configure geofencing coordinates, radius, and enforcement policy."""
    org_id = auth_ctx["org_id"]
    geofence_data = {
        "is_enabled": bool(payload.get("is_enabled", False)),
        "latitude": float(payload.get("latitude", 13.0827)),
        "longitude": float(payload.get("longitude", 80.2707)),
        "radius_meters": int(payload.get("radius_meters", 150)),
        "strict_enforcement": bool(payload.get("strict_enforcement", False)),
        "office_name": str(payload.get("office_name") or "Headquarters").strip()
    }
    await store.update_one("organizations", {"id": org_id}, {"geofence": geofence_data})

    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="UPDATE_GEOFENCE_CONFIG",
        target_resource="Organization",
        target_id=org_id,
        details=geofence_data
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {"status": "success", "geofence": geofence_data, "message": "Geofence perimeter updated successfully."}

# ----------------- CLIENT SITES & FIELD WORK LOCATIONS -----------------
@router.get("/client-sites")
async def list_client_sites(auth_ctx: Dict[str, Any] = Depends(require_tenant_context)):
    """List all active client project locations for the tenant."""
    org_id = auth_ctx["org_id"]
    sites = await store.find_many("client_sites", {"organization_id": org_id, "is_active": True}, sort_key="created_at", sort_desc=True)
    return sites

@router.post("/client-sites")
async def create_client_site(payload: ClientSiteCreate, auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    """Register a new client or project site with geofence perimeter."""
    org_id = auth_ctx["org_id"]
    site_dict = ClientSite(
        organization_id=org_id,
        site_name=payload.site_name.strip(),
        client_name=payload.client_name.strip(),
        address=payload.address.strip(),
        latitude=float(payload.latitude),
        longitude=float(payload.longitude),
        radius_meters=int(payload.radius_meters or 150),
        contact_person=payload.contact_person,
        contact_phone=payload.contact_phone
    ).dict()
    await store.insert_one("client_sites", site_dict)
    return site_dict

@router.delete("/client-sites/{site_id}")
async def delete_client_site(site_id: str, auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    """Deactivate client site."""
    org_id = auth_ctx["org_id"]
    await store.update_one("client_sites", {"id": site_id, "organization_id": org_id}, {"is_active": False})
    return {"status": "success", "message": "Client site removed successfully."}