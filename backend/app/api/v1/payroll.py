from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import calendar
import uuid
from app.core.security import require_tenant_context, require_org_admin
from app.db.store import store
from app.models.schemas import PayrollComputeResult

from app.api.v1.reports import calculate_punches_total_hours

payroll_router = APIRouter(prefix="/payroll", tags=["Payroll"])

def extract_record_hours(r: Dict[str, Any]) -> float:
    """Extracts actual worked hours from total_hours, alternating punches, or check-in/out."""
    th = r.get("total_hours")
    if th is not None:
        try:
            val = float(th)
            if val > 0:
                return round(val, 2)
        except Exception:
            pass
    punches = r.get("punches") or []
    if punches:
        norm_punches = []
        rec_date = r.get("date", "2026-09-01")
        for p in punches:
            action = (p.get("action") or p.get("punch_type") or p.get("type") or "").upper()
            if action in ("IN", "CHECKIN", "CHECK_IN"):
                action = "CHECK_IN"
            elif action in ("OUT", "CHECKOUT", "CHECK_OUT"):
                action = "CHECK_OUT"
            ts = p.get("timestamp") or p.get("time")
            if ts and len(str(ts)) <= 8 and ":" in str(ts):
                ts = f"{rec_date}T{ts}+05:30"
            norm_punches.append({"action": action, "timestamp": str(ts) if ts else None})
        calc_h = calculate_punches_total_hours(norm_punches)
        if calc_h > 0:
            return round(calc_h, 2)
    ci = r.get("check_in")
    co = r.get("check_out")
    if ci and co:
        try:
            ci_dt = datetime.fromisoformat(ci.replace("Z", "+00:00"))
            co_dt = datetime.fromisoformat(co.replace("Z", "+00:00"))
            diff_h = (co_dt - ci_dt).total_seconds() / 3600.0
            if diff_h > 0:
                return round(diff_h, 2)
        except Exception:
            pass
    return 0.0

# Standard Indian Standard Time (UTC+5:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))

def number_to_indian_words(num: float) -> str:
    """
    Converts a currency number into Indian English words.
    Example: 94 -> 'Ninety Four Rupees Only'
             37500 -> 'Thirty Seven Thousand Five Hundred Rupees Only'
    """
    if num is None:
        return "Zero Rupees Only"
    val = round(float(num), 2)
    if val < 0:
        return f"Minus {number_to_indian_words(-val)}"
    rupees = int(val)
    paise = int(round((val - rupees) * 100))

    if rupees == 0 and paise == 0:
        return "Zero Rupees Only"

    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
             "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_two_digits(n: int) -> str:
        if n < 20:
            return units[n]
        rem = n % 10
        return tens[n // 10] + (" " + units[rem] if rem > 0 else "")

    def convert_three_digits(n: int) -> str:
        res = ""
        h = n // 100
        rem = n % 100
        if h > 0:
            res += units[h] + " Hundred"
            if rem > 0:
                res += " and "
        if rem > 0:
            res += convert_two_digits(rem)
        return res

    parts = []
    # Crores (>= 1,00,00,000)
    crores = rupees // 10000000
    rupees %= 10000000
    if crores > 0:
        parts.append(convert_three_digits(crores) + " Crore")

    # Lakhs (>= 1,00,000)
    lakhs = rupees // 100000
    rupees %= 100000
    if lakhs > 0:
        parts.append(convert_two_digits(lakhs) + " Lakh")

    # Thousands (>= 1,000)
    thousands = rupees // 1000
    rupees %= 1000
    if thousands > 0:
        parts.append(convert_two_digits(thousands) + " Thousand")

    # Hundreds and below (< 1,000)
    if rupees > 0:
        parts.append(convert_three_digits(rupees))

    rupees_str = " ".join(parts).strip() if parts else "Zero"
    result = f"{rupees_str} Rupees"

    if paise > 0:
        paise_str = convert_two_digits(paise)
        result += f" and {paise_str} Paise"

    return result + " Only"


async def compute_single_employee_payroll(org_id: str, emp: Dict[str, Any], cycle: str) -> Dict[str, Any]:
    """
    Core payroll computation engine linking attendance, manual financial entries,
    and advances for an employee in a designated billing cycle (YYYY-MM).
    """
    # 1. Date calculation for cycle
    try:
        parts = cycle.split("-")
        year, month = int(parts[0]), int(parts[1])
    except Exception:
        now = datetime.now(IST_TZ)
        year, month = now.year, now.month
        cycle = f"{year:04d}-{month:02d}"

    _, total_days_of_month = calendar.monthrange(year, month)
    start_date = f"{year:04d}-{month:02d}-01"
    end_date = f"{year:04d}-{month:02d}-{total_days_of_month:02d}"

    emp_id = emp["id"]
    emp_type = (emp.get("employment_type") or "FULL_TIME").upper()

    # 2. Fetch Attendance Records for this Cycle
    all_att = await store.find_many("attendance", {
        "organization_id": org_id,
        "employee_id": emp_id
    })
    # Filter by cycle dates
    cycle_records = [
        r for r in all_att 
        if r.get("date") and start_date <= r["date"] <= end_date
    ]

    present_days = len([r for r in cycle_records if r.get("status") in ("PRESENT", "LATE")])
    half_days = len([r for r in cycle_records if r.get("status") == "HALF_DAY"])
    paid_leaves = len([r for r in cycle_records if r.get("status") == "LEAVE"])
    effective_present_days = present_days + (0.5 * half_days)

    manual_salary_records = [
        r for r in cycle_records 
        if r.get("mode") == "Salary" or (r.get("manual_salary") is not None and float(r.get("manual_salary") or 0) > 0)
    ]
    hourly_records = [
        r for r in cycle_records 
        if r not in manual_salary_records
    ]

    hours_from_punches = round(sum(extract_record_hours(r) for r in hourly_records), 2)
    direct_manual_salaries = round(sum(float(r.get("manual_salary") or 0.0) for r in manual_salary_records), 2)
    total_logged_hours = round(hours_from_punches + sum(extract_record_hours(r) for r in manual_salary_records), 2)
    
    # Working Days & Leave Days
    working_days = present_days + half_days
    standard_working_days = 26
    # Leave days count (unworked days within standard working quota)
    leave_days = max(0, int(standard_working_days - working_days))

    # Overtime calculation: excess hours over 8.0h per effective present day
    if total_logged_hours > 0 and effective_present_days > 0:
        auto_ot = max(0.0, round(total_logged_hours - (effective_present_days * 8.0), 1))
    else:
        auto_ot = 0.0

    # 3. Wage & Rate Structure
    hourly_rate = float(emp.get("hourly_rate") if emp.get("hourly_rate") is not None else 250.0)
    daily_wage_rate = float(emp.get("daily_wage_rate") if emp.get("daily_wage_rate") is not None else round(hourly_rate * 8.0, 2))
    half_day_salary = float(emp.get("half_day_salary") if emp.get("half_day_salary") is not None else round(daily_wage_rate / 2.0, 2))
    base_salary = float(emp.get("base_salary") if emp.get("base_salary") is not None else 40000.0)
    statutory_deductions = float(emp.get("statutory_deductions") if emp.get("statutory_deductions") is not None else 3000.0)

    # 4. Multi-Model Calculation Logic
    # Automatic concept: calculate earned salary from actual punch timings: hours_from_punches * hourly_rate + direct_manual_salaries
    earned_base_pay = round((hours_from_punches * hourly_rate) + direct_manual_salaries, 2)
    if direct_manual_salaries > 0 and hours_from_punches > 0:
        calculation_basis = f"{hours_from_punches:.1f} hrs logged (@₹{hourly_rate:.2f}/hr) + ₹{direct_manual_salaries:,.2f} manual day salary"
    elif direct_manual_salaries > 0:
        calculation_basis = f"₹{direct_manual_salaries:,.2f} (from {len(manual_salary_records)} manual day salary override{'s' if len(manual_salary_records) > 1 else ''})"
    else:
        calculation_basis = f"{total_logged_hours:.1f} hrs logged × ₹{hourly_rate:.2f}/hr (Punch-Hours Basis)"
    lop_days = 0.0

    if emp_type == "DAILY_WAGE":
        standard_present_days = len([r for r in hourly_records if r.get("status") in ("PRESENT", "LATE")])
        standard_half_days = len([r for r in hourly_records if r.get("status") == "HALF_DAY"])
        wage_from_days = round((standard_present_days * daily_wage_rate) + (standard_half_days * half_day_salary), 2)
        earned_base_pay = round(wage_from_days + direct_manual_salaries, 2)
        calculation_basis = f"{standard_present_days} Full Days (@₹{daily_wage_rate}) + {standard_half_days} Half-Days (@₹{half_day_salary})" + (f" + ₹{direct_manual_salaries:,.2f} manual salary" if direct_manual_salaries > 0 else "")
    elif emp_type == "PART_TIME":
        earned_base_pay = round((hours_from_punches * hourly_rate) + direct_manual_salaries, 2)
        if direct_manual_salaries > 0:
            calculation_basis = f"{hours_from_punches:.1f} hrs logged × ₹{hourly_rate:.2f}/hr + ₹{direct_manual_salaries:,.2f} manual salary"
        else:
            calculation_basis = f"{total_logged_hours:.1f} hrs logged × ₹{hourly_rate:.2f}/hr (Hourly Part-Time Basis)"
    elif emp_type == "FIELD_WORKER":
        if total_logged_hours > 0 or direct_manual_salaries > 0:
            earned_base_pay = round((hours_from_punches * hourly_rate) + direct_manual_salaries, 2)
            calculation_basis = f"{hours_from_punches:.1f} hrs logged × ₹{hourly_rate:.2f}/hr" + (f" + ₹{direct_manual_salaries:,.2f} manual salary" if direct_manual_salaries > 0 else "")
        else:
            earned_base_pay = base_salary
            calculation_basis = f"Field Worker Base Pay: ₹{base_salary:,.2f}"
    else:
        # Standard FULL_TIME: If punch records or manual salary entries exist, automatically compute
        if hours_from_punches > 0 or direct_manual_salaries > 0:
            earned_base_pay = round((hours_from_punches * hourly_rate) + direct_manual_salaries, 2)
            if direct_manual_salaries > 0 and hours_from_punches > 0:
                calculation_basis = f"{hours_from_punches:.1f} hrs logged (@₹{hourly_rate:.2f}/hr) + ₹{direct_manual_salaries:,.2f} manual day salary"
            elif direct_manual_salaries > 0:
                calculation_basis = f"₹{direct_manual_salaries:,.2f} (from {len(manual_salary_records)} manual day salary override{'s' if len(manual_salary_records) > 1 else ''})"
            else:
                calculation_basis = f"{total_logged_hours:.1f} hrs logged × ₹{hourly_rate:.2f}/hr (Punch-Hours Basis)"
        else:
            per_day_rate = round(base_salary / standard_working_days, 2)
            explicit_absents = len([r for r in cycle_records if r.get("status") == "ABSENT"])
            lop_days = round(explicit_absents + (half_days * 0.5), 1)
            loss_of_pay = round(lop_days * per_day_rate, 2)
            earned_base_pay = max(0.0, round(base_salary - loss_of_pay, 2))
            calculation_basis = (
                f"Fixed Monthly ₹{base_salary:,.2f} (26 days base; -{lop_days} absent/half-day LOP @ ₹{per_day_rate}/day)"
                if lop_days > 0 else f"Fixed Monthly ₹{base_salary:,.2f} (Awaiting cycle punches)"
            )

    # 5. Overtime Compensation
    overtime_pay = round(auto_ot * hourly_rate * 1.5, 2)

    # 6. Query Manual Financial Adjustments (Bonus, Deduction, Reimbursement, Salary, Incentive, Allowance, Other Earnings, Advance Repayment, Other Deductions)
    fin_entries = await store.find_many("financial_entries", {
        "organization_id": org_id,
        "employee_id": emp_id,
        "cycle": cycle
    })

    # Classify by reason and type dynamically
    manual_salary = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") == "Salary")
    manual_bonus = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") in ("Incentive", "Bonus") or e.get("type") == "BONUS")
    manual_allowance = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") == "Allowance" or e.get("type") == "REIMBURSEMENT")
    manual_other_earnings = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") == "Other Earnings")
    
    manual_advance_repayment = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") == "Advance Repayment")
    manual_other_deductions = sum(float(e.get("amount") or 0.0) for e in fin_entries if e.get("reason") in ("Other Deductions", "Deduction") or e.get("type") == "DEDUCTION")

    # Add manual salary additions to base pay
    earned_base_pay = round(earned_base_pay + manual_salary, 2)

    # Incentive = Manual Bonus + Automatic Punctuality Reward (if >= 20 present days)
    auto_punctuality = 2500.0 if effective_present_days >= 20 else 0.0
    incentive = round(manual_bonus + auto_punctuality, 2)

    # Allowance
    allowance = round(manual_allowance, 2)

    # Others Earnings = Overtime pay + manual other earnings
    others_earnings = round(overtime_pay + manual_other_earnings, 2)

    # Total Gross Earnings
    total_earnings = round(earned_base_pay + allowance + incentive + others_earnings, 2)

    # 7. Check Payout Disbursement Status
    cycle_label_pattern = cycle  # "2026-09"
    month_name_cycle = f"{calendar.month_name[month]} {year}"
    
    payouts = await store.find_many("salary_payouts", {
        "organization_id": org_id,
        "employee_id": emp_id
    })
    
    existing_payout = next(
        (p for p in payouts if p.get("cycle") in (cycle_label_pattern, month_name_cycle) or cycle_label_pattern in str(p.get("cycle", ""))),
        None
    )
    payout_status = "PAID" if existing_payout else "PENDING"

    # 8. Advance Deduction: If already paid, use recorded deduction; otherwise query active advance balance
    if existing_payout:
        advance_repayment = float(existing_payout.get("advance_repayment") or existing_payout.get("advance_deduction") or 0.0)
    else:
        emp_advances = await store.find_many("advances", {
            "organization_id": org_id,
            "employee_id": emp_id,
            "approval_type": "active"
        })
        total_active_advance_bal = sum(float(adv.get("balance", 0.0)) for adv in emp_advances)
        # Advance deduction is the employee's active advance balance, capped at available net earnings
        available_for_advance = max(0.0, total_earnings - statutory_deductions)
        advance_repayment = round(min(total_active_advance_bal, available_for_advance), 2)

    # 9. Deductions: Statutory PF/taxes capped at gross earnings so net cannot be negative
    paid_salary = min(statutory_deductions, total_earnings) if total_earnings > 0 else 0.0
    other_deductions = round(manual_other_deductions, 2)
    total_deductions = round(paid_salary + advance_repayment + other_deductions, 2)

    # 10. Net Pay
    net_pay = max(0.0, round(total_earnings - total_deductions, 2))
    net_pay_words = number_to_indian_words(net_pay)

    fn = emp.get("first_name", "")
    ln = emp.get("last_name", "")
    full_name = f"{fn} {ln}".strip() or "Employee"

    # Total working hours in HH:MM format
    hours_int = int(total_logged_hours)
    mins_int = int(round((total_logged_hours - hours_int) * 60))
    total_hours_formatted = f"{hours_int:02d}:{mins_int:02d}"

    # Build itemized daily punch-to-wage breakdown for the billing cycle
    daily_breakdown = []
    sorted_cycle_records = sorted(cycle_records, key=lambda x: (x.get("date") or "", x.get("check_in") or ""))
    for r in sorted_cycle_records:
        r_date = r.get("date", "")
        r_day_name = ""
        if r_date:
            try:
                dt_obj = datetime.strptime(r_date, "%Y-%m-%d")
                r_day_name = dt_obj.strftime("%A")
            except Exception:
                pass

        hrs = extract_record_hours(r)
        mode = r.get("mode", "Hours")
        manual_sal = float(r.get("manual_salary") or 0.0) if r.get("manual_salary") is not None else 0.0
        st = r.get("status", "PRESENT")

        if mode == "Salary" or manual_sal > 0:
            rate_label = "Manual Day Wage"
            daily_earned = manual_sal
        elif emp_type == "DAILY_WAGE":
            if st == "HALF_DAY":
                rate_label = f"₹{half_day_salary:.2f} (Half-Day)"
                daily_earned = half_day_salary
            else:
                rate_label = f"₹{daily_wage_rate:.2f} (Full Day)"
                daily_earned = daily_wage_rate
        else:
            rate_label = f"₹{hourly_rate:.2f}/hr"
            daily_earned = round(hrs * hourly_rate, 2)

        ci_time = r.get("check_in_time")
        if not ci_time and r.get("check_in"):
            ci_val = str(r.get("check_in"))
            if "T" in ci_val:
                try:
                    ci_time = datetime.fromisoformat(ci_val.replace("Z", "+00:00")).strftime("%I:%M %p")
                except Exception:
                    ci_time = ci_val
            else:
                ci_time = ci_val

        co_time = r.get("check_out_time")
        if not co_time and r.get("check_out"):
            co_val = str(r.get("check_out"))
            if "T" in co_val:
                try:
                    co_time = datetime.fromisoformat(co_val.replace("Z", "+00:00")).strftime("%I:%M %p")
                except Exception:
                    co_time = co_val
            else:
                co_time = co_val

        shift_label = r.get("shift")
        if not shift_label:
            s_start = r.get("shift_start")
            s_end = r.get("shift_end")
            if s_start and s_end:
                shift_label = f"{s_start} - {s_end}"
            else:
                shift_label = "Regular Shift"

        daily_breakdown.append({
            "id": r.get("id"),
            "date": r_date,
            "day_name": r_day_name,
            "shift": shift_label,
            "check_in_time": ci_time or "—",
            "check_out_time": co_time or "—",
            "hours": hrs,
            "status": st,
            "mode": mode,
            "rate_label": rate_label,
            "daily_earned": round(daily_earned, 2),
            "verification_mode": r.get("verification_mode", "FACE_KIOSK")
        })

    return {
        "employee_id": emp_id,
        "employee_name": full_name,
        "employee_code": emp.get("employee_code", "EMP"),
        "department": emp.get("department", "Operations"),
        "designation": emp.get("designation") or emp.get("department") or "Production",
        "phone": emp.get("phone") or "—",
        "aadhar_number": emp.get("aadhar_number") or emp.get("employee_code", "—"),
        "employment_type": emp_type,
        "cycle": cycle,
        "cycle_display": month_name_cycle,
        # Metadata / Attendance summary
        "total_days_of_month": total_days_of_month,
        "total_working_days": standard_working_days,
        "working_days": working_days,
        "days_present": present_days,
        "half_days": half_days,
        "paid_leaves": paid_leaves,
        "leave_days": leave_days,
        "lop_days": lop_days,
        "total_logged_hours": round(total_logged_hours, 1),
        "total_working_hours_formatted": total_hours_formatted,
        "overtime_hours": auto_ot,
        # Rates
        "hourly_rate": hourly_rate,
        "hours_salary": hourly_rate,
        "day_salary": daily_wage_rate,
        "half_day_salary": half_day_salary,
        # Earnings Breakdown
        "base_salary": earned_base_pay,
        "basic_salary": earned_base_pay,
        "allowance": allowance,
        "incentive": incentive,
        "others_earnings": others_earnings,
        "total_earnings": total_earnings,
        # Deductions Breakdown
        "paid_salary": paid_salary,
        "advance_repayment": advance_repayment,
        "other_deductions": other_deductions,
        "total_deductions": total_deductions,
        # Net
        "net_pay": net_pay,
        "net_pay_words": net_pay_words,
        "calculation_basis": calculation_basis,
        "daily_breakdown": daily_breakdown,
        "financial_entries": fin_entries,
        "payment_entries": fin_entries,
        "payout_status": payout_status,
        "payout_id": existing_payout.get("id") if existing_payout else None,
        "disbursed_at": existing_payout.get("disbursed_at") if existing_payout else None,
        # Banking Details
        "banking": {
            "account_holder_name": emp.get("account_holder_name") or full_name,
            "bank_name": emp.get("bank_name") or "—",
            "account_number": emp.get("account_number") or "—",
            "ifsc_code": emp.get("ifsc_code") or "—",
            "upi_number": emp.get("upi_number") or "—"
        }
    }


@payroll_router.get("/compute/{employee_id}")
async def get_employee_payroll_computation(
    employee_id: str,
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")

    if not is_admin:
        email = auth_ctx.get("email")
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
        if not emp or emp["id"] != employee_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to payroll profile.")
    else:
        emp = await store.find_one("employees", {"id": employee_id, "organization_id": org_id})

    if not emp:
        raise HTTPException(status_code=404, detail="Employee record not found.")

    if not cycle:
        now = datetime.now(IST_TZ)
        cycle = f"{now.year:04d}-{now.month:02d}"

    result = await compute_single_employee_payroll(org_id, emp, cycle)
    return result


@payroll_router.get("/register")
async def get_payroll_register(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    if not cycle:
        now = datetime.now(IST_TZ)
        cycle = f"{now.year:04d}-{now.month:02d}"

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    register = []
    for emp in employees:
        comp = await compute_single_employee_payroll(org_id, emp, cycle)
        register.append(comp)

    return register


@payroll_router.get("/bank-advice")
async def get_bank_advice(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """
    Generates structured bank disbursement advice for corporate net banking uploads.
    """
    org_id = auth_ctx["org_id"]
    if not cycle:
        now = datetime.now(IST_TZ)
        cycle = f"{now.year:04d}-{now.month:02d}"

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    advice = []
    for emp in employees:
        comp = await compute_single_employee_payroll(org_id, emp, cycle)
        b = comp.get("banking", {})
        advice.append({
            "employee_code": comp["employee_code"],
            "employee_name": comp["employee_name"],
            "account_holder_name": b.get("account_holder_name") or comp["employee_name"],
            "bank_name": b.get("bank_name") or "—",
            "account_number": b.get("account_number") or "—",
            "ifsc_code": b.get("ifsc_code") or "—",
            "upi_number": b.get("upi_number") or "—",
            "net_payable": comp["net_pay"],
            "cycle": cycle,
            "status": comp["payout_status"]
        })
    return advice


class DisburseRequestPayload(BaseModel):
    cycle: Optional[str] = None
    employee_ids: Optional[List[str]] = None

@payroll_router.post("/disburse")
@payroll_router.post("/batch-disburse")
async def disburse_payroll_payouts(
    payload: Optional[DisburseRequestPayload] = None,
    cycle: Optional[str] = Query(None),
    employee_ids: Optional[List[str]] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """
    Disburses monthly salary for specified (or all) employees for a designated billing cycle.
    Creates salary_payouts records, amortizes active advances, records financial deduction entry, and sends employee notifications.
    """
    org_id = auth_ctx["org_id"]
    admin_name = auth_ctx.get("name", "Payroll Administrator")

    target_cycle = (payload.cycle if payload and payload.cycle else cycle) or datetime.utcnow().strftime("%Y-%m")
    target_emp_ids = (payload.employee_ids if payload and payload.employee_ids is not None else employee_ids)

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    if target_emp_ids:
        employees = [e for e in employees if e["id"] in target_emp_ids or e.get("employee_code") in target_emp_ids]

    disbursed = []
    skipped = []

    for emp in employees:
        comp = await compute_single_employee_payroll(org_id, emp, target_cycle)
        if comp["payout_status"] == "PAID":
            skipped.append(comp["employee_code"])
            continue

        emp_name = comp["employee_name"]
        net_amount = comp["net_pay"]
        payout_id = f"PAY-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{comp['employee_code']}"

        disb_record = {
            "id": payout_id,
            "organization_id": org_id,
            "employee_id": emp["id"],
            "employee_name": emp_name,
            "employee_code": comp["employee_code"],
            "cycle": comp.get("cycle_display") or cycle,
            "cycle_code": cycle,
            "base_salary": comp["basic_salary"],
            "overtime_pay": comp["others_earnings"],
            "bonus": comp["incentive"],
            "allowance": comp["allowance"],
            "incentive": comp["incentive"],
            "others_earnings": comp["others_earnings"],
            "advance_deduction": comp["advance_repayment"],
            "advance_repayment": comp["advance_repayment"],
            "statutory_deductions": comp["paid_salary"],
            "paid_salary": comp["paid_salary"],
            "other_deductions": comp["other_deductions"],
            "total_earnings": comp["total_earnings"],
            "total_deductions": comp["total_deductions"],
            "net_salary": net_amount,
            "net_pay": net_amount,
            "net_pay_words": comp["net_pay_words"],
            "employment_type": comp["employment_type"],
            "calculation_basis": comp["calculation_basis"],
            "logged_hours": comp["total_logged_hours"],
            "hourly_rate": comp["hours_salary"],
            "hours_salary": comp["hours_salary"],
            "day_salary": comp["day_salary"],
            "half_day_salary": comp["half_day_salary"],
            "working_days": comp["working_days"],
            "days_present": comp["days_present"],
            "half_days": comp["half_days"],
            "leave_days": comp["leave_days"],
            "daily_breakdown": comp.get("daily_breakdown", []),
            "status": "PAID",
            "disbursed_by": admin_name,
            "disbursed_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
        await store.insert_one("salary_payouts", disb_record)

        # Amortize active advances if advance_repayment > 0
        if comp["advance_repayment"] > 0:
            rem_to_settle = float(comp["advance_repayment"])
            emp_advs = await store.find_many("advances", {
                "employee_id": emp["id"],
                "organization_id": org_id,
                "approval_type": "active"
            }, sort_key="created_at", sort_desc=False)
            for adv in emp_advs:
                cur_b = float(adv.get("balance", 0.0))
                if cur_b > 0 and rem_to_settle > 0:
                    ded = min(cur_b, rem_to_settle)
                    nb = round(cur_b - ded, 2)
                    rem_to_settle = round(rem_to_settle - ded, 2)
                    adv_upd = {"balance": nb}
                    if nb <= 0:
                        adv_upd["approval"] = "Completed & Paid Off"
                        adv_upd["approval_type"] = "completed"
                    await store.update_one("advances", {"id": adv["id"], "organization_id": org_id}, adv_upd)

            # Record this advance repayment in financial_entries
            now_ts = datetime.utcnow()
            await store.insert_one("financial_entries", {
                "id": f"PAY-REP-{uuid.uuid4().hex[:6].upper()}",
                "organization_id": org_id,
                "employee_id": emp["id"],
                "employee_name": emp_name,
                "employee_code": comp["employee_code"],
                "department": comp.get("department", "Operations"),
                "amount": comp["advance_repayment"],
                "type": "DEDUCTION",
                "reason": "Advance Repayment",
                "payment_type": "Salary Deduction",
                "bank": "Payroll Deduction",
                "cycle": comp.get("cycle_display") or cycle,
                "date": now_ts.strftime("%Y-%m-%d"),
                "created_by": admin_name,
                "created_at": now_ts.isoformat(),
                "timestamp": now_ts.strftime("%Y-%m-%d %I:%M %p")
            })

        # Dispatch notification
        notif = {
            "id": f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
            "organization_id": org_id,
            "employee_id": emp["id"],
            "employee_email": emp.get("email"),
            "type": "SALARY_CREDITED",
            "title": f"Salary Credited for {comp.get('cycle_display', cycle)}",
            "message": f"Dear {emp_name}, your net salary of ₹{net_amount:,.2f} for {comp.get('cycle_display', cycle)} has been disbursed to your bank account.",
            "amount": net_amount,
            "cycle": comp.get("cycle_display", cycle),
            "payout_id": payout_id,
            "is_read": False,
            "created_at": datetime.utcnow().isoformat()
        }
        await store.insert_one("notifications", notif)
        disbursed.append(comp["employee_code"])

    return {
        "status": "success",
        "cycle": target_cycle,
        "disbursed_count": len(disbursed),
        "disbursed_employees": disbursed,
        "skipped_count": len(skipped),
        "skipped_employees": skipped,
        "message": f"Successfully processed payroll disbursement for {len(disbursed)} employees."
    }

# Backward compatibility alias
batch_disburse_payroll = disburse_payroll_payouts

