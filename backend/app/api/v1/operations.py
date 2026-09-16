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
    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}
    records = await store.find_many(
        "manual_overrides", 
        {"organization_id": org_id}, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    res = []
    for r in records:
        if r.get("employee_id") in emp_map:
            emp = emp_map[r["employee_id"]]
            r["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))
            res.append(r)
    return res


# ----------------- 2. SALARY ADVANCES -----------------

class AdvanceRequestPayload(BaseModel):
    employee_id: Optional[str] = None
    total_advance: float
    installments: int = 2
    reason: Optional[str] = None

class StatusUpdatePayload(BaseModel):
    status: str  # 'APPROVED', 'REJECTED'
    comment: Optional[str] = None

@operations_router.get("/advances")
async def list_advances(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}
    query = {"organization_id": org_id}
    if cycle:
        query["cycle"] = cycle
    if auth_ctx.get("role") == "employee":
        emp = await store.find_one("employees", {"email": auth_ctx["email"], "organization_id": org_id})
        if emp:
            query["employee_id"] = emp["id"]

    advances = await store.find_many(
        "advances", 
        query, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    res = []
    for a in advances:
        if a.get("employee_id") in emp_map:
            emp = emp_map[a["employee_id"]]
            a["name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            a["emp_code"] = emp.get("employee_code", a.get("emp_code"))
            a["dept"] = emp.get("department", a.get("dept"))
            res.append(a)
    return res

@operations_router.post("/advances")
async def issue_salary_advance(
    payload: AdvanceRequestPayload,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")
    target_emp_id = payload.employee_id
    if not is_admin or not target_emp_id:
        user_emp = await store.find_one("employees", {"email": auth_ctx.get("email"), "organization_id": org_id})
        if user_emp:
            target_emp_id = user_emp["id"]

    emp = await store.find_one("employees", {"id": target_emp_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    months = max(1, payload.installments)
    monthly_deduction = round(payload.total_advance / months, 2)
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    approval_text = "Approved & Active" if is_admin else "Pending Approval"
    approval_type = "active" if is_admin else "pending"

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
        "approval": approval_text,
        "approval_type": approval_type,
        "cycle_impact": f"Will deduct ₹{monthly_deduction:,.0f} on cycle cut" if is_admin else "Awaiting Supervisor Approval",
        "reason": payload.reason or ("Authorized Salary Advance" if is_admin else "Employee Advance Request"),
        "created_at": datetime.utcnow().isoformat()
    }

    await store.insert_one("advances", record)
    return record

@operations_router.patch("/advances/{advance_id}/status")
async def update_advance_status(
    advance_id: str,
    payload: StatusUpdatePayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    adv = await store.find_one("advances", {"id": advance_id, "organization_id": org_id})
    if not adv:
        raise HTTPException(status_code=404, detail="Advance record not found.")

    new_status = payload.status.upper()
    admin_name = auth_ctx.get("name", "Admin")
    if new_status == "APPROVED":
        update = {
            "approval": "Approved & Active",
            "approval_type": "active",
            "cycle_impact": f"Will deduct ₹{adv.get('next_deduction', 0):,.0f} on cycle cut",
            "approved_by": admin_name,
            "approved_at": datetime.utcnow().isoformat()
        }
    elif new_status == "REJECTED":
        update = {
            "approval": "Rejected",
            "approval_type": "rejected",
            "cycle_impact": "Request Rejected (No Deduction)",
            "rejected_by": admin_name,
            "rejected_at": datetime.utcnow().isoformat()
        }
    else:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED.")

    await store.update_one("advances", {"id": advance_id, "organization_id": org_id}, update)
    adv.update(update)
    return adv


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
    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}
    query = {"organization_id": org_id}
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
    res = []
    for l in leaves:
        if l.get("employee_id") in emp_map:
            emp = emp_map[l["employee_id"]]
            l["name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            l["emp_code"] = emp.get("employee_code", l.get("emp_code"))
            res.append(l)
    return res

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

@operations_router.patch("/leaves/{leave_id}/status")
async def update_leave_status(
    leave_id: str,
    payload: StatusUpdatePayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    leave = await store.find_one("leaves", {"id": leave_id, "organization_id": org_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave record not found.")

    new_status = payload.status.upper()
    admin_name = auth_ctx.get("name", "Admin")
    if new_status == "APPROVED":
        update = {
            "status": "Approved",
            "status_type": "success",
            "approved_by": admin_name,
            "approved_at": datetime.utcnow().isoformat(),
            "payroll_effect": "-₹1,333 Ded. (Approved)" if leave.get("category_code") == "LOP" else "Salary Protected"
        }
    elif new_status == "REJECTED":
        update = {
            "status": "Rejected",
            "status_type": "danger",
            "approved_by": f"Rejected by {admin_name}",
            "rejected_at": datetime.utcnow().isoformat(),
            "payroll_effect": "No Impact (Rejected)"
        }
    else:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED.")

    await store.update_one("leaves", {"id": leave_id, "organization_id": org_id}, update)
    leave.update(update)
    return leave
