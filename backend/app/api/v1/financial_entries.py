from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from app.core.security import require_tenant_context, require_org_admin
from app.db.store import store
from app.models.schemas import FinancialEntryCreate

financial_entries_router = APIRouter(prefix="/financial-entries", tags=["Payroll: Financial Entries"])

@financial_entries_router.post("", status_code=status.HTTP_201_CREATED)
@financial_entries_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_financial_entry(
    payload: FinancialEntryCreate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in your organization.")

    entry_type = payload.type.upper()
    if entry_type not in ("BONUS", "DEDUCTION", "REIMBURSEMENT"):
        raise HTTPException(status_code=400, detail="Invalid entry type. Must be BONUS, DEDUCTION, or REIMBURSEMENT.")

    entry_id = f"FIN-{uuid.uuid4().hex[:6].upper()}"
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    record = {
        "id": entry_id,
        "organization_id": org_id,
        "employee_id": emp["id"],
        "employee_name": emp_name,
        "employee_code": emp.get("employee_code", "EMP"),
        "type": entry_type,
        "amount": round(float(payload.amount), 2),
        "cycle": payload.cycle.strip(),  # Format: "YYYY-MM"
        "reason": (payload.reason or "").strip(),
        "created_by": auth_ctx.get("name", "Admin"),
        "created_at": datetime.utcnow().isoformat()
    }

    await store.insert_one("financial_entries", record)
    return record

@financial_entries_router.get("")
@financial_entries_router.get("/")
async def list_financial_entries(
    employee_id: Optional[str] = None,
    cycle: Optional[str] = None,
    type: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")

    query = {"organization_id": org_id}
    if not is_admin:
        email = auth_ctx.get("email")
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
        if emp:
            query["employee_id"] = emp["id"]
        else:
            return []
    elif employee_id:
        query["employee_id"] = employee_id

    if cycle:
        query["cycle"] = cycle.strip()
    if type:
        query["type"] = type.strip().upper()

    entries = await store.find_many("financial_entries", query, sort_key="created_at", sort_desc=True)
    return entries

@financial_entries_router.delete("/{entry_id}")
async def delete_financial_entry(
    entry_id: str,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    entry = await store.find_one("financial_entries", {"id": entry_id, "organization_id": org_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Financial adjustment entry not found.")

    await store.delete_many("financial_entries", {"id": entry_id, "organization_id": org_id})
    return {"status": "success", "message": f"Entry {entry_id} deleted."}
