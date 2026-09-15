from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from app.core.security import require_org_admin, require_tenant_context
from app.db.store import store
from app.models.schemas import AuditLog

operations_router = APIRouter(tags=["Operations: Advances, Leaves & Overrides"])

# ----------------- 1. MANUAL ATTENDANCE OVERRIDES -----------------

class ManualOverridePayload(BaseModel):
    employee_id: str
    log_date: str
    shift: str
    punch_in: str
    punch_out: str
    reason: str
    hours: Optional[float] = 8.5

def format_time_12h(time_str: str) -> str:
    try:
        parts = time_str.split(":")
        h, m = int(parts[0]), int(parts[1])
        suffix = "AM" if h < 12 else "PM"
        h12 = h % 12
        if h12 == 0:
            h12 = 12
        return f"{h12:02d}:{m:02d} {suffix}"
    except Exception:
        return time_str

@operations_router.post("/attendance/manual")
async def create_manual_override(
    payload: ManualOverridePayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in your organization.")

    override_id = f"OVR-{uuid.uuid4().hex[:6].upper()}"
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    punch_in_12h = format_time_12h(payload.punch_in)
    punch_out_12h = format_time_12h(payload.punch_out)

    record = {
        "id": override_id,
        "organization_id": org_id,
        "employee_id": emp["id"],
        "employee_name": emp_name,
        "employee_code": emp.get("employee_code", "EMP"),
        "department": emp.get("department", "Operations"),
        "date": payload.log_date,
        "punch_in": punch_in_12h,
        "punch_out": punch_out_12h,
        "check_in_time": punch_in_12h,
        "check_out_time": punch_out_12h,
        "hours": f"{payload.hours} hrs",
        "total_hours": payload.hours,
        "shift": payload.shift,
        "reason": payload.reason,
        "authorized_by": f"{auth_ctx.get('name', 'Admin')}\n{datetime.utcnow().strftime('%d %b %I:%M %p')}",
        "status": "Approved & Synced",
        "status_type": "success",
        "created_at": datetime.utcnow().isoformat()
    }

    # Store in overrides collection
    await store.insert_one("manual_overrides", record)

    # Also update or insert in attendance collection
    existing_att = await store.find_one("attendance", {
        "organization_id": org_id,
        "employee_id": emp["id"],
        "date": payload.log_date
    })

    if existing_att:
        await store.update_one("attendance", {"id": existing_att["id"]}, {
            "status": "PRESENT",
            "check_in": f"{payload.log_date}T{payload.punch_in}:00",
            "check_out": f"{payload.log_date}T{payload.punch_out}:00",
            "check_in_time": punch_in_12h,
            "check_out_time": punch_out_12h,
            "total_hours": payload.hours,
            "verification_mode": "MANUAL_OVERRIDE"
        })
    else:
        new_att = {
            "id": f"ATT-{uuid.uuid4().hex[:8].upper()}",
            "organization_id": org_id,
            "employee_id": emp["id"],
            "employee_code": emp.get("employee_code", "EMP"),
            "employee_name": emp_name,
            "department": emp.get("department", "Operations"),
            "date": payload.log_date,
            "check_in": f"{payload.log_date}T{payload.punch_in}:00",
            "check_out": f"{payload.log_date}T{payload.punch_out}:00",
            "check_in_time": punch_in_12h,
            "check_out_time": punch_out_12h,
            "total_hours": payload.hours,
            "status": "PRESENT",
            "verification_mode": "MANUAL_OVERRIDE",
            "confidence_score": 1.0,
            "liveness_verified": True
        }
        await store.insert_one("attendance", new_att)

    # Audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="MANUAL_ATTENDANCE_OVERRIDE",
        target_resource="Attendance",
        target_id=override_id,
        details={"employee_id": emp["id"], "date": payload.log_date, "reason": payload.reason}
    ).dict()
    await store.insert_one("audit_logs", audit)

    return record

@operations_router.get("/attendance/manual")
async def list_manual_overrides(
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    records = await store.find_many(
        "manual_overrides", 
        {"organization_id": org_id}, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    return records


# ----------------- 2. SALARY ADVANCES -----------------

class AdvanceRequestPayload(BaseModel):
    employee_id: str
    total_advance: float
    installments: int = 2
    reason: Optional[str] = None

@operations_router.get("/advances")
async def list_advances(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    if cycle:
        query["cycle"] = cycle
    advances = await store.find_many(
        "advances", 
        query, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    return advances

@operations_router.post("/advances")
async def issue_salary_advance(
    payload: AdvanceRequestPayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    months = max(1, payload.installments)
    monthly_deduction = round(payload.total_advance / months, 2)
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    record = {
        "id": f"ADV-{uuid.uuid4().hex[:6].upper()}",
        "organization_id": org_id,
        "employee_id": emp["id"],
        "name": emp_name,
        "emp_code": emp.get("employee_code", "EMP"),
        "dept": emp.get("department", "General"),
        "total_advance": payload.total_advance,
        "next_deduction": monthly_deduction,
        "instalment_text": f"Instalment 1/{months}",
        "progress_text": f"0 of {months} mos",
        "progress_percent": 0,
        "balance": payload.total_advance,
        "approval": "Approved & Active",
        "approval_type": "active",
        "cycle_impact": f"Will deduct ₹{monthly_deduction:,.0f} on cycle cut",
        "reason": payload.reason or "Authorized Salary Advance",
        "created_at": datetime.utcnow().isoformat()
    }

    await store.insert_one("advances", record)
    return record


# ----------------- 3. LEAVE APPLICATIONS -----------------

class LeaveRequestPayload(BaseModel):
    category: str  # 'PL', 'CL', 'SL', 'LOP'
    from_date: str
    to_date: str
    duration_mode: str = "FULL"
    reason: str
    contact_phone: Optional[str] = None
    employee_id: Optional[str] = None

@operations_router.get("/leaves")
async def list_leaves(
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    # If standard employee, show their own leaves; if admin, show all
    if auth_ctx.get("role") == "employee":
        emp = await store.find_one("employees", {"email": auth_ctx["email"], "organization_id": org_id})
        if emp:
            query["employee_id"] = emp["id"]

    leaves = await store.find_many(
        "leaves", 
        query, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    return leaves

@operations_router.post("/leaves")
async def submit_leave(
    payload: LeaveRequestPayload,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    emp = None
    if payload.employee_id:
        emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        emp = await store.find_one("employees", {"email": auth_ctx.get("email"), "organization_id": org_id})
    
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() if emp else auth_ctx.get("name", "Employee")
    emp_code = emp.get("employee_code", "EMP") if emp else "EMP"
    emp_id = emp["id"] if emp else auth_ctx["sub"]

    cat_names = {
        "PL": "Paid Leave (PL)",
        "CL": "Casual Leave (CL)",
        "SL": "Sick Leave (SL)",
        "LOP": "Unpaid LOP"
    }

    record = {
        "id": f"LVR-{uuid.uuid4().hex[:6].upper()}",
        "organization_id": org_id,
        "employee_id": emp_id,
        "name": emp_name,
        "emp_code": emp_code,
        "category": cat_names.get(payload.category, "Paid Leave (PL)"),
        "category_code": payload.category,
        "dates": f"{payload.from_date} to {payload.to_date}",
        "days": "Full Shift" if payload.duration_mode == "FULL" else "Half Day",
        "reason": payload.reason,
        "status": "Pending Review",
        "approved_by": "Pending Approval",
        "status_type": "pending",
        "payroll_effect": "-₹1,333 Ded. (Pending)" if payload.category == "LOP" else "Salary Protected",
        "created_at": datetime.utcnow().isoformat()
    }

    await store.insert_one("leaves", record)
    return record
