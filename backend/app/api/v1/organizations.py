from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any, List
from app.models.schemas import Organization, WorkHoursConfig, AuditLog
from app.core.security import require_org_admin, require_super_admin
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
    for field in ["name", "work_hours", "gstin", "industry", "phone", "website", "address", "logo_url"]:
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