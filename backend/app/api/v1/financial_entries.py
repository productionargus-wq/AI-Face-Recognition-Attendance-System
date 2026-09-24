from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from app.core.security import require_tenant_context, require_org_admin
from app.db.store import store
from app.models.schemas import FinancialEntryCreate, FinancialEntryUpdate

financial_entries_router = APIRouter(prefix="/financial-entries", tags=["Payroll: Financial Entries"])

VALID_REASONS = [
    "Advance Repayment",
    "Salary Advance",
    "Salary",
    "Incentive",
    "Allowance",
    "Other Earnings",
    "Other Deductions"
]

VALID_PAYMENT_TYPES = [
    "UPI",
    "Cash",
    "Net Banking",
    "Mobile Banking",
    "Repayment",
    "Others"
]

def derive_entry_type(reason: str, explicit_type: Optional[str] = None) -> str:
    if explicit_type and explicit_type.upper() in ("BONUS", "DEDUCTION", "REIMBURSEMENT", "ADVANCE", "REPAYMENT"):
        return explicit_type.upper()
    r = (reason or "").strip()
    if r in ("Salary Advance", "Advance"):
        return "ADVANCE"
    elif r in ("Incentive", "Bonus"):
        return "BONUS"
    elif r in ("Allowance", "Reimbursement"):
        return "REIMBURSEMENT"
    elif r == "Salary":
        return "SALARY"
    elif r in ("Advance Repayment", "Repayment"):
        return "REPAYMENT"
    elif r in ("Other Deductions", "Deduction"):
        return "DEDUCTION"
    elif r == "Other Earnings":
        return "BONUS"
    return "OTHER"

@financial_entries_router.post("", status_code=status.HTTP_201_CREATED)
@financial_entries_router.post("/", status_code=status.HTTP_201_CREATED)
async def create_financial_entry(
    payload: FinancialEntryCreate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": payload.employee_id, "organization_id": org_id})
    if not emp:
        # Fallback by employee_code
        emp = await store.find_one("employees", {"employee_code": payload.employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in your organization.")

    # Determine date and cycle
    now = datetime.utcnow()
    date_str = payload.date.strip() if payload.date else now.strftime("%Y-%m-%d")
    cycle_str = payload.cycle.strip() if payload.cycle else date_str[:7]

    entry_type = derive_entry_type(payload.reason, payload.type)
    entry_id = f"PAY-{uuid.uuid4().hex[:6].upper()}"
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() or emp.get("name") or "Employee"

    record = {
        "id": entry_id,
        "organization_id": org_id,
        "employee_id": emp["id"],
        "employee_name": emp_name,
        "employee_code": emp.get("employee_code", "EMP"),
        "department": emp.get("department", "Operations"),
        "amount": round(float(payload.amount), 2),
        "date": date_str,
        "cycle": cycle_str,
        "bank": (payload.bank or "").strip(),
        "payment_type": (payload.payment_type or "UPI").strip(),
        "reason": (payload.reason or "Salary").strip(),
        "type": entry_type,
        "receipt": payload.receipt,
        "receipt_filename": payload.receipt_filename,
        "created_by": auth_ctx.get("name", "Admin"),
        "created_at": now.isoformat(),
        "timestamp": now.strftime("%Y-%m-%d %I:%M %p")
    }

    await store.insert_one("financial_entries", record)

    # If this is a Salary Advance, also allocate it into the advances collection as an active advance
    if record["reason"] in ("Salary Advance", "Advance") or record.get("type") == "ADVANCE":
        existing_adv = await store.find_one("advances", {"id": record["id"], "organization_id": org_id})
        if not existing_adv:
            adv_record = {
                "id": record["id"],
                "organization_id": org_id,
                "employee_id": emp["id"],
                "name": emp_name,
                "emp_code": emp.get("employee_code", "EMP"),
                "dept": emp.get("department", "Operations"),
                "email": emp.get("email", ""),
                "total_advance": record["amount"],
                "next_deduction": record["amount"],
                "balance": record["amount"],
                "approval": "Approved & Active",
                "approval_type": "active",
                "cycle": cycle_str,
                "date": date_str,
                "bank": record["bank"],
                "payment_type": record["payment_type"],
                "receipt": record["receipt"],
                "receipt_filename": record["receipt_filename"],
                "cycle_impact": f"Will deduct ₹{record['amount']:,.0f} in monthly payslip",
                "reason": "Salary Advance",
                "created_at": now.isoformat()
            }
            await store.insert_one("advances", adv_record)

    # If this is an Advance Repayment, also apply it towards the employee's active advance balance if one exists
    if record["reason"] == "Advance Repayment" or record["payment_type"] == "Repayment":
        advances = await store.find_many("advances", {
            "organization_id": org_id,
            "employee_id": emp["id"],
            "approval_type": "active"
        }, sort_key="created_at", sort_desc=False)
        remaining = record["amount"]
        for adv in advances:
            cur_bal = float(adv.get("balance", 0.0))
            if cur_bal > 0 and remaining > 0:
                deduct = min(cur_bal, remaining)
                new_bal = round(cur_bal - deduct, 2)
                remaining = round(remaining - deduct, 2)
                upd = {"balance": new_bal}
                if new_bal <= 0:
                    upd["approval_type"] = "completed"
                    upd["approval"] = "Completed & Paid Off"
                    upd["status"] = "Completed"
                await store.update_one("advances", {"id": adv["id"], "organization_id": org_id}, upd)

    return record

@financial_entries_router.get("")
@financial_entries_router.get("/")
async def list_financial_entries(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    cycle: Optional[str] = None,
    bank: Optional[str] = None,
    payment_type: Optional[str] = None,
    reason: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")

    query: Dict[str, Any] = {"organization_id": org_id}
    if not is_admin:
        email = auth_ctx.get("email")
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
        if emp:
            query["employee_id"] = emp["id"]
        else:
            return []
    elif employee_id and employee_id != "All":
        query["employee_id"] = employee_id

    if cycle:
        query["cycle"] = cycle.strip()

    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}

    if bank and bank != "All":
        query["bank"] = bank.strip()

    if payment_type and payment_type != "All":
        query["payment_type"] = payment_type.strip()

    if reason and reason != "All":
        query["reason"] = reason.strip()

    if type and type != "All":
        query["type"] = type.strip().upper()

    entries = await store.find_many("financial_entries", query, sort_key="created_at", sort_desc=True)

    # In-memory search filter if provided
    if search and search.strip():
        q = search.strip().lower()
        entries = [
            e for e in entries
            if q in (e.get("employee_name") or "").lower()
            or q in (e.get("employee_code") or "").lower()
            or q in (e.get("bank") or "").lower()
            or q in (e.get("payment_type") or "").lower()
            or q in (e.get("reason") or "").lower()
            or q in str(e.get("amount") or "")
            or q in (e.get("date") or "")
        ]

    return entries

@financial_entries_router.put("/{entry_id}")
async def update_financial_entry(
    entry_id: str,
    payload: FinancialEntryUpdate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    entry = await store.find_one("financial_entries", {"id": entry_id, "organization_id": org_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Payment entry not found.")

    update_fields: Dict[str, Any] = {}
    if payload.amount is not None:
        update_fields["amount"] = round(float(payload.amount), 2)
    if payload.reason is not None:
        update_fields["reason"] = payload.reason.strip()
        update_fields["type"] = derive_entry_type(payload.reason)
    if payload.date is not None:
        update_fields["date"] = payload.date.strip()
        update_fields["cycle"] = payload.date.strip()[:7]
    if payload.bank is not None:
        update_fields["bank"] = payload.bank.strip()
    if payload.payment_type is not None:
        update_fields["payment_type"] = payload.payment_type.strip()
    if payload.receipt is not None:
        update_fields["receipt"] = payload.receipt
    if payload.receipt_filename is not None:
        update_fields["receipt_filename"] = payload.receipt_filename

    if update_fields:
        await store.update_one("financial_entries", {"id": entry_id, "organization_id": org_id}, {"$set": update_fields})
        entry.update(update_fields)

    return entry

@financial_entries_router.delete("/{entry_id}")
async def delete_financial_entry(
    entry_id: str,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    entry = await store.find_one("financial_entries", {"id": entry_id, "organization_id": org_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Payment entry not found.")

    await store.delete_many("financial_entries", {"id": entry_id, "organization_id": org_id})
    return {"status": "success", "message": f"Payment entry {entry_id} deleted."}

@financial_entries_router.get("/balance-summary")
async def get_balance_summary(auth_ctx: Dict[str, Any] = Depends(require_tenant_context)):
    """
    Computes an organizational overview of all payments, advances disbursed, repayments made, and net outstanding balance.
    """
    org_id = auth_ctx["org_id"]
    
    # 1. All financial entries
    entries = await store.find_many("financial_entries", {"organization_id": org_id})
    
    # 2. All advances
    advances = await store.find_many("advances", {"organization_id": org_id})
    
    # 3. All employees
    employees = await store.find_many("employees", {"organization_id": org_id})
    emp_map = {e["id"]: e for e in employees}

    total_paid = sum(float(e.get("amount") or 0.0) for e in entries)
    total_advances_given = sum(float(a.get("total_advance") or a.get("amount") or a.get("advance_amount") or 0.0) for a in advances)
    total_repayments = sum(
        float(e.get("amount") or 0.0) for e in entries 
        if e.get("reason") == "Advance Repayment" or e.get("payment_type") == "Repayment"
    )
    total_active_advance_balance = sum(float(a.get("balance") or 0.0) for a in advances if a.get("approval_type") == "active")

    # Employee breakdown
    employee_balances = []
    for emp_id, emp in emp_map.items():
        emp_adv = [a for a in advances if a.get("employee_id") == emp_id]
        emp_ent = [e for e in entries if e.get("employee_id") == emp_id]
        adv_bal = sum(float(a.get("balance") or 0.0) for a in emp_adv if a.get("approval_type") == "active")
        adv_received = sum(float(a.get("total_advance") or a.get("amount") or 0.0) for a in emp_adv)
        adv_repaid = sum(
            float(e.get("amount") or 0.0) for e in emp_ent 
            if e.get("reason") == "Advance Repayment" or e.get("payment_type") == "Repayment"
        )
        total_emp_paid = sum(float(e.get("amount") or 0.0) for e in emp_ent)
        if adv_bal > 0 or adv_received > 0 or total_emp_paid > 0:
            fn = emp.get("first_name", "")
            ln = emp.get("last_name", "")
            name = f"{fn} {ln}".strip() or emp.get("name", "Employee")
            employee_balances.append({
                "employee_id": emp_id,
                "employee_name": name,
                "employee_code": emp.get("employee_code", "EMP"),
                "department": emp.get("department", "Operations"),
                "active_advance_balance": round(adv_bal, 2),
                "total_advances_received": round(adv_received, 2),
                "total_advance_repaid": round(adv_repaid, 2),
                "total_payments_logged": round(total_emp_paid, 2)
            })

    return {
        "total_payments_logged": round(total_paid, 2),
        "total_advances_disbursed": round(total_advances_given, 2),
        "total_advance_repaid": round(total_repayments, 2),
        "outstanding_advance_balance": round(total_active_advance_balance, 2),
        "employee_balances": employee_balances
    }
