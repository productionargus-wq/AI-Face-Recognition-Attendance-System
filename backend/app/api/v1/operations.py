from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from app.core.security import require_org_admin, require_tenant_context
from app.db.store import store
from app.models.schemas import AuditLog

# Standard Indian Standard Time (UTC+5:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))

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
    cycle: Optional[str] = None

class StatusUpdatePayload(BaseModel):
    status: str  # 'APPROVED', 'REJECTED'
    comment: Optional[str] = None

@operations_router.get("/advances")
async def list_advances(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")
    all_emps = await store.find_many("employees", {"organization_id": org_id})
    emp_map = {e["id"]: e for e in all_emps}
    
    query = {"organization_id": org_id}
    if not is_admin:
        emp = await store.find_one("employees", {"email": auth_ctx.get("email"), "organization_id": org_id})
        if emp:
            query["employee_id"] = emp["id"]

    advances = await store.find_many(
        "advances", 
        query, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=200
    )
    
    res = []
    current_month_cycle = datetime.now().strftime("%B %Y")
    for a in advances:
        # Guarantee cycle is populated
        if not a.get("cycle"):
            a["cycle"] = current_month_cycle
            
        is_pending = (
            a.get("approval_type") == "pending" or 
            "pending" in str(a.get("approval", "")).lower()
        )

        # For admins, pending approvals should ALWAYS be visible so no requests get lost!
        # Otherwise filter by cycle if provided
        if cycle and cycle.lower() not in ("all", ""):
            if is_admin:
                if not (a.get("cycle") == cycle or is_pending):
                    continue
            else:
                if not (a.get("cycle") == cycle or is_pending or a.get("approval_type") == "active"):
                    continue

        # Enrich with latest employee details if available, but preserve existing record fields as fallback
        if a.get("employee_id") in emp_map:
            emp = emp_map[a["employee_id"]]
            full_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            if full_name:
                a["name"] = full_name
            a["emp_code"] = emp.get("employee_code", a.get("emp_code"))
            a["dept"] = emp.get("department", a.get("dept"))
            a["email"] = emp.get("email", a.get("email"))

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
        # Fallback: check by email
        emp = await store.find_one("employees", {"email": auth_ctx.get("email"), "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee record not found.")

    months = max(1, payload.installments)
    monthly_deduction = round(payload.total_advance / months, 2)
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

    approval_text = "Approved & Active" if is_admin else "Pending Approval"
    approval_type = "active" if is_admin else "pending"
    current_cycle = payload.cycle or datetime.now().strftime("%B %Y")

    record = {
        "id": f"ADV-{uuid.uuid4().hex[:6].upper()}",
        "organization_id": org_id,
        "employee_id": emp["id"],
        "name": emp_name,
        "emp_code": emp.get("employee_code", "EMP"),
        "dept": emp.get("department", "General"),
        "email": emp.get("email", auth_ctx.get("email", "")),
        "total_advance": payload.total_advance,
        "next_deduction": monthly_deduction,
        "instalment_text": f"Instalment 1/{months}",
        "progress_text": f"0 of {months} mos",
        "progress_percent": 0,
        "balance": payload.total_advance,
        "approval": approval_text,
        "approval_type": approval_type,
        "cycle": current_cycle,
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

    # Insert notification for employee
    status_label = "Approved & Active" if new_status == "APPROVED" else "Rejected"
    notif = {
        "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
        "organization_id": org_id,
        "employee_id": adv["employee_id"],
        "employee_email": adv.get("email"),
        "type": "ADVANCE_STATUS",
        "title": f"Advance Request {status_label}",
        "message": f"Your salary advance request of ₹{adv.get('total_advance', 0):,.2f} has been {status_label.lower()} by {admin_name}.",
        "amount": adv.get("total_advance", 0),
        "status": new_status,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    }
    await store.insert_one("notifications", notif)

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


# ----------------- 4. NOTIFICATIONS & SALARY DISBURSEMENT -----------------

class SalaryDisbursementPayload(BaseModel):
    employee_id: str
    cycle: str
    amount: float
    base_salary: Optional[float] = None
    overtime_pay: Optional[float] = None
    performance_bonus: Optional[float] = None
    advance_deduction: Optional[float] = None
    statutory_deductions: Optional[float] = None
    net_salary: Optional[float] = None
    note: Optional[str] = "Monthly Salary Credited"
    employment_type: Optional[str] = None
    calculation_basis: Optional[str] = None
    logged_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    days_present: Optional[int] = None

async def check_and_create_overdue_punch_reminders(org_id: str, emp_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Checks if employees are still clocked in (is_currently_in == True) past their shift_end
    (or >8.5h for flexible/daily wage workers), and triggers a punch-out reminder notification.
    """
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(IST_TZ)
    today_str = now_local.strftime("%Y-%m-%d")
    cur_mins = now_local.hour * 60 + now_local.minute

    query = {"organization_id": org_id, "date": today_str, "is_currently_in": True}
    if emp_id:
        query["employee_id"] = emp_id

    active_attendances = await store.find_many("attendance", query)
    created_reminders = []

    for att in active_attendances:
        target_emp_id = att.get("employee_id")
        emp = await store.find_one("employees", {"id": target_emp_id, "organization_id": org_id})
        if not emp:
            continue

        emp_type = (emp.get("employment_type") or "FULL_TIME").upper()
        shift_type = (emp.get("shift_type") or "FIXED").upper()
        is_flexible = shift_type == "FLEXIBLE" or emp_type == "DAILY_WAGE" or "flexible" in (emp.get("assigned_shift") or "").lower()

        is_overdue = False
        shift_info = ""

        if is_flexible:
            check_in_str = att.get("check_in")
            if check_in_str:
                try:
                    dt = datetime.fromisoformat(check_in_str.replace("Z", "+00:00"))
                    elapsed_hours = (now_utc - dt).total_seconds() / 3600.0
                    if elapsed_hours >= 8.5:
                        is_overdue = True
                        shift_info = f"{round(elapsed_hours, 1)} hrs logged"
                except Exception:
                    pass
        else:
            shift_end = emp.get("shift_end") or "17:30"
            try:
                end_h, end_m = map(int, shift_end.split(":"))
                end_mins = end_h * 60 + end_m + 10  # 10 minute grace after scheduled end
                if cur_mins >= end_mins:
                    is_overdue = True
                    shift_info = f"shift ended at {shift_end}"
            except Exception:
                pass

        if is_overdue:
            # Check if reminder already issued for today
            existing = await store.find_one("notifications", {
                "organization_id": org_id,
                "employee_id": target_emp_id,
                "type": "PUNCH_OUT_REMINDER",
                "date": today_str
            })
            if not existing:
                first_name = emp.get("first_name", "Employee")
                punch_in_time = att.get("check_in_time") or "earlier today"
                notif = {
                    "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
                    "organization_id": org_id,
                    "employee_id": target_emp_id,
                    "employee_email": emp.get("email"),
                    "type": "PUNCH_OUT_REMINDER",
                    "title": "Punch-Out Reminder: Shift Overdue",
                    "message": f"Hello {first_name}, your {shift_info}. You are still clocked in from {punch_in_time}. Please punch out before leaving!",
                    "action_required": True,
                    "date": today_str,
                    "is_read": False,
                    "created_at": now_utc.isoformat()
                }
                await store.insert_one("notifications", notif)
                created_reminders.append(notif)

    return created_reminders

@operations_router.get("/notifications")
async def list_notifications(
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")
    
    # Auto-check for overdue punch reminders for this tenant or employee
    emp_id = None
    email = auth_ctx.get("email")
    if not is_admin:
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
        emp_id = emp["id"] if emp else None

    await check_and_create_overdue_punch_reminders(org_id, emp_id=emp_id)

    # Retrieve all notifications for this tenant
    all_notifs = await store.find_many(
        "notifications", 
        {"organization_id": org_id}, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    
    if is_admin:
        return all_notifs

    # For employee, filter notifications meant for them
    filtered = []
    for n in all_notifs:
        if (emp_id and n.get("employee_id") == emp_id) or (email and n.get("employee_email") == email):
            filtered.append(n)
        elif not n.get("employee_id") and not n.get("employee_email"):
            # Broadcast notification
            filtered.append(n)
            
    return filtered

@operations_router.post("/notifications/check-overdue-punches")
async def trigger_overdue_punch_check(
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")
    emp_id = None if is_admin else auth_ctx.get("emp_id")
    reminders = await check_and_create_overdue_punch_reminders(org_id, emp_id=emp_id)
    return {"status": "success", "reminders_created": len(reminders), "reminders": reminders}

@operations_router.post("/notifications/disburse-salary")
async def disburse_salary(
    payload: SalaryDisbursementPayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    admin_name = auth_ctx.get("name", "Payroll Administrator")
    emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    net_amount = payload.net_salary if payload.net_salary is not None else payload.amount

    # 1. Create a persistent salary disbursement transaction record
    disb_record = {
        "id": f"PAY-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{emp.get('employee_code', 'EMP')}",
        "organization_id": org_id,
        "employee_id": emp["id"],
        "employee_name": emp_name,
        "employee_code": emp.get("employee_code"),
        "cycle": payload.cycle,
        "base_salary": payload.base_salary or emp.get("base_salary", 40000.0),
        "overtime_pay": payload.overtime_pay or 0.0,
        "bonus": payload.performance_bonus or 0.0,
        "advance_deduction": payload.advance_deduction or 0.0,
        "statutory_deductions": payload.statutory_deductions or emp.get("statutory_deductions", 3000.0),
        "net_salary": net_amount,
        "employment_type": payload.employment_type or emp.get("employment_type", "FULL_TIME"),
        "calculation_basis": payload.calculation_basis,
        "logged_hours": payload.logged_hours,
        "hourly_rate": payload.hourly_rate,
        "days_present": payload.days_present,
        "status": "PAID",
        "disbursed_by": admin_name,
        "disbursed_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    await store.insert_one("salary_payouts", disb_record)

    # 2. If advance deduction was applied, update active advance amortization progress
    if payload.advance_deduction and payload.advance_deduction > 0:
        active_adv = await store.find_one("advances", {
            "employee_id": emp["id"], 
            "organization_id": org_id,
            "approval_type": "active"
        })
        if active_adv:
            new_bal = max(0.0, float(active_adv.get("balance", 0.0)) - float(payload.advance_deduction))
            adv_update = {"balance": new_bal}
            if new_bal <= 0:
                adv_update["approval"] = "Completed & Paid Off"
                adv_update["approval_type"] = "completed"
            await store.update_one("advances", {"id": active_adv["id"]}, adv_update)

    # 3. Create high-priority notification for employee
    notif = {
        "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
        "organization_id": org_id,
        "employee_id": emp["id"],
        "employee_email": emp.get("email"),
        "type": "SALARY_CREDITED",
        "title": f"Salary Credited for {payload.cycle}",
        "message": f"Dear {emp.get('first_name', 'Employee')}, your net salary of ₹{net_amount:,.2f} for {payload.cycle} has been processed and credited to your account.",
        "amount": net_amount,
        "cycle": payload.cycle,
        "payout_id": disb_record["id"],
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    }
    await store.insert_one("notifications", notif)

    return {
        "status": "success",
        "message": f"Salary for {emp_name} credited successfully.",
        "payout": disb_record,
        "notification": notif
    }

@operations_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    await store.update_one(
        "notifications", 
        {"id": notification_id, "organization_id": org_id},
        {"is_read": True, "read_at": datetime.utcnow().isoformat()}
    )
    return {"status": "ok"}

@operations_router.patch("/notifications/mark-all-read")
async def mark_all_notifications_read(
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    email = auth_ctx.get("email")
    emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
    emp_id = emp["id"] if emp else None
    
    all_notifs = await store.find_many("notifications", {"organization_id": org_id, "is_read": False})
    for n in all_notifs:
        if n.get("employee_email") == email or (emp_id and n.get("employee_id") == emp_id):
            await store.update_one("notifications", {"id": n["id"]}, {"is_read": True})
            
    return {"status": "ok"}

@operations_router.get("/salary-payouts/history")
async def get_payout_history(
    employee_id: Optional[str] = None,
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

    payouts = await store.find_many(
        "salary_payouts", 
        query, 
        sort_key="created_at", 
        sort_desc=True, 
        limit=100
    )
    return payouts

