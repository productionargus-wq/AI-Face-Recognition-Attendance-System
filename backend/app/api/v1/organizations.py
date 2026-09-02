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
    if "name" in settings_payload:
        update_data["name"] = settings_payload["name"]
    if "work_hours" in settings_payload:
        update_data["work_hours"] = settings_payload["work_hours"]

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

@router.get("/public/list")
async def get_public_orgs_list():
    orgs = await store.find_many("organizations", {"is_active": True})
    return [{"id": o["id"], "name": o["name"], "slug": o.get("slug", o["id"])} for o in orgs]

@router.get("/audit-logs")
async def get_audit_logs(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    org_id = auth_ctx["org_id"]
    logs = await store.find_many("audit_logs", {"organization_id": org_id}, sort_key="timestamp", sort_desc=True, limit=100)
    return logs