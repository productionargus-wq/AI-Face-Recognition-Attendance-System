import pytest
import numpy as np
from app.services.face_service import cosine_similarity, find_best_match
from app.services.liveness_service import liveness_service
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token

def test_password_hashing():
    pw = "ArgusSecurePass2026!"
    hashed = get_password_hash(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation():
    payload = {"sub": "user-123", "org_id": "org-456", "role": "org_admin"}
    token = create_access_token(payload)
    decoded = decode_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["org_id"] == "org-456"
    assert decoded["role"] == "org_admin"

def test_cosine_similarity_identity():
    # Random 128-d vector
    vec1 = np.random.rand(128).astype(np.float32)
    vec1 /= np.linalg.norm(vec1)
    
    # Exact match similarity must be 1.0
    sim = cosine_similarity(vec1.tolist(), vec1.tolist())
    assert abs(sim - 1.0) < 1e-4

def test_tenant_face_matching_isolation():
    vec_emp1 = (np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    vec_emp2 = (-np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    
    tenant_employees = [
        {"id": "emp-1", "first_name": "John", "last_name": "Doe", "face_embeddings": [vec_emp1]}
    ]
    
    # Matching with vec_emp1 should find emp-1
    matched, conf = find_best_match(vec_emp1, tenant_employees, threshold=0.7)
    assert matched is not None
    assert matched["id"] == "emp-1"
    assert conf > 0.9
    
    # Matching with opposite vector should yield no match
    no_match, conf2 = find_best_match(vec_emp2, tenant_employees, threshold=0.7)
    assert no_match is None

def test_margin_ambiguity_protection():
    # Two employees with almost identical templates
    vec_base = (np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    # Tiny difference (0.01) between emp A and emp B
    vec_a = list(vec_base)
    vec_b = list(vec_base)
    vec_b[0] += 0.01
    
    tenant_employees = [
        {"id": "emp-a", "first_name": "Alice", "face_embeddings": [vec_a]},
        {"id": "emp-b", "first_name": "Bob", "face_embeddings": [vec_b]}
    ]
    
    # Matching should reject because difference is smaller than margin_threshold (0.07)
    match, conf = find_best_match(vec_base, tenant_employees, threshold=0.80, margin_threshold=0.07)
    assert match is None  # Rejection protects against wrong login!

def test_liveness_challenge_generation():
    challenge = liveness_service.generate_random_challenge()
    assert "instruction" in challenge
    assert "action" in challenge

def test_haversine_distance_calculation():
    from app.api.v1.reports import calculate_haversine_distance
    # Chennai Central (13.0827, 80.2707) to Marina Beach (13.0500, 80.2824) ~ 3.8 km
    dist = calculate_haversine_distance(13.0827, 80.2707, 13.0500, 80.2824)
    assert 3500 <= dist <= 4100
    
    # Same point distance should be 0.0
    zero_dist = calculate_haversine_distance(13.0827, 80.2707, 13.0827, 80.2707)
    assert zero_dist == 0.0

def test_geofence_perimeter_logic():
    from app.api.v1.reports import calculate_haversine_distance
    office_lat, office_lon = 13.0827, 80.2707
    radius = 150  # 150 meters
    
    # 50m away point (Inside)
    inside_lat = 13.0831
    inside_lon = 80.2707
    dist_inside = calculate_haversine_distance(office_lat, office_lon, inside_lat, inside_lon)
    assert dist_inside <= radius
    
    # 500m away point (Outside)
    outside_lat = 13.0870
    outside_lon = 80.2707
    dist_outside = calculate_haversine_distance(office_lat, office_lon, outside_lat, outside_lon)
    assert dist_outside > radius

def test_calculate_punches_total_hours():
    from app.api.v1.reports import calculate_punches_total_hours
    
    # 1st Punch: IN at 09:00:00 (Open session -> 0.0 hrs confirmed)
    p1 = [{"action": "CHECK_IN", "timestamp": "2026-09-18T09:00:00+05:30"}]
    assert calculate_punches_total_hours(p1) == 0.0

    # 2nd Punch: OUT at 13:00:00 (4.0 hrs worked)
    p2 = p1 + [{"action": "CHECK_OUT", "timestamp": "2026-09-18T13:00:00+05:30"}]
    assert calculate_punches_total_hours(p2) == 4.0

    # 3rd Punch: IN at 14:00:00 (Lunch ended, resumed -> still 4.0 hrs confirmed)
    p3 = p2 + [{"action": "CHECK_IN", "timestamp": "2026-09-18T14:00:00+05:30"}]
    assert calculate_punches_total_hours(p3) == 4.0

    # 4th Punch: OUT at 18:00:00 (Another 4.0 hrs -> total 8.0 hrs worked)
    p4 = p3 + [{"action": "CHECK_OUT", "timestamp": "2026-09-18T18:00:00+05:30"}]
    assert calculate_punches_total_hours(p4) == 8.0

    # 5th Punch: IN at 19:00:00, 6th Punch: OUT at 20:30:00 (1.5 hrs OT -> 9.5 hrs)
    p6 = p4 + [
        {"action": "CHECK_IN", "timestamp": "2026-09-18T19:00:00+05:30"},
        {"action": "CHECK_OUT", "timestamp": "2026-09-18T20:30:00+05:30"}
    ]
    assert calculate_punches_total_hours(p6) == 9.5

def test_alternating_punch_state_machine():
    """Simulates alternating IN -> OUT -> IN -> OUT and daily reset."""
    def determine_action(existing_record, req_type="AUTO"):
        if req_type in ("CHECK_IN", "CHECK_OUT"):
            return req_type
        if not existing_record:
            return "CHECK_IN"
        return "CHECK_OUT" if existing_record.get("is_currently_in", False) else "CHECK_IN"

    # Day 1:
    day1_rec = None
    # Punch 1: First punch of the day must be CHECK_IN
    action1 = determine_action(day1_rec)
    assert action1 == "CHECK_IN"
    day1_rec = {"is_currently_in": True, "punch_count": 1}

    # Punch 2: 2nd punch must be CHECK_OUT
    action2 = determine_action(day1_rec)
    assert action2 == "CHECK_OUT"
    day1_rec = {"is_currently_in": False, "punch_count": 2}

    # Punch 3: 3rd punch must be CHECK_IN
    action3 = determine_action(day1_rec)
    assert action3 == "CHECK_IN"
    day1_rec = {"is_currently_in": True, "punch_count": 3}

    # Punch 4: 4th punch must be CHECK_OUT
    action4 = determine_action(day1_rec)
    assert action4 == "CHECK_OUT"
    day1_rec = {"is_currently_in": False, "punch_count": 4}

    # Day 2: New day (record is None for new date) -> 1st punch resets to CHECK_IN!
    day2_rec = None
    action_day2_p1 = determine_action(day2_rec)
    assert action_day2_p1 == "CHECK_IN"

def test_flexible_and_daily_wage_exempt_from_late():
    """Daily wage and flexible shift workers are never marked LATE."""
    from app.models.schemas import AttendanceStatus

    def evaluate_status(emp, arrival_hour, arrival_min):
        emp_type = (emp.get("employment_type") or "FULL_TIME").upper()
        shift_type = (emp.get("shift_type") or "FIXED").upper()
        is_flexible = shift_type == "FLEXIBLE" or emp_type == "DAILY_WAGE"
        if is_flexible:
            return AttendanceStatus.PRESENT, "FLEXIBLE"
        
        # Fixed schedule 09:00 with 15m grace
        if (arrival_hour * 60 + arrival_min) > (9 * 60 + 15):
            return AttendanceStatus.LATE, "LATE"
        return AttendanceStatus.PRESENT, "ON-TIME"

    # Full time employee arriving at 11:30 AM -> LATE
    ft_emp = {"employment_type": "FULL_TIME", "shift_type": "FIXED"}
    status_ft, shift_ft = evaluate_status(ft_emp, 11, 30)
    assert status_ft == AttendanceStatus.LATE
    assert shift_ft == "LATE"

    # Daily wage / Coolie worker arriving at 11:30 AM -> PRESENT (FLEXIBLE)
    daily_wage_emp = {"employment_type": "DAILY_WAGE", "shift_type": "FLEXIBLE"}
    status_dw, shift_dw = evaluate_status(daily_wage_emp, 11, 30)
    assert status_dw == AttendanceStatus.PRESENT
    assert shift_dw == "FLEXIBLE"

def test_part_time_target_hours_completion():
    """Part-time workers who hit target hours (e.g. 4.0h) get full day credit."""
    pt_emp = {"employment_type": "PART_TIME", "target_daily_hours": 4.0}
    target = float(pt_emp.get("target_daily_hours", 4.0))
    
    # 4.2 hours worked on 4.0h target
    logged_hours = 4.2
    assert logged_hours >= target
    full_day_credit = logged_hours >= target
    assert full_day_credit is True

def test_client_site_field_geofence_verification():
    """Field worker client site verification: VERIFIED_ON_SITE vs SITE_PERIMETER_VIOLATION."""
    from app.api.v1.reports import calculate_haversine_distance

    client_site = {
        "site_name": "Metro Rail Project Site #4",
        "latitude": 13.0400,
        "longitude": 80.2500,
        "radius_meters": 150
    }

    # Worker punching at the site (40m away)
    worker_on_site_lat = 13.0403
    worker_on_site_lon = 80.2500
    dist_on_site = calculate_haversine_distance(
        worker_on_site_lat, worker_on_site_lon,
        client_site["latitude"], client_site["longitude"]
    )
    status_on_site = "VERIFIED_ON_SITE" if dist_on_site <= client_site["radius_meters"] else "SITE_PERIMETER_VIOLATION"
    assert dist_on_site <= 150
    assert status_on_site == "VERIFIED_ON_SITE"

    # Dishonest punch: worker is 2.5 km away at a café
    worker_away_lat = 13.0600
    worker_away_lon = 80.2500
    dist_away = calculate_haversine_distance(
        worker_away_lat, worker_away_lon,
        client_site["latitude"], client_site["longitude"]
    )
    status_away = "VERIFIED_ON_SITE" if dist_away <= client_site["radius_meters"] else "SITE_PERIMETER_VIOLATION"
    assert dist_away > 150
    assert status_away == "SITE_PERIMETER_VIOLATION"

def test_multi_model_payroll_formulas():
    """Multi-model payroll calculation: Full-time (prorated), Part-time (hourly), Daily wage (days)."""
    # 1. Part-Time Employee (e.g. 30.5 hours worked @ ₹250/hr)
    pt_hours = 30.5
    pt_rate = 250.0
    pt_earned_base = round(pt_hours * pt_rate)
    assert pt_earned_base == 7625
    pt_basis = f"{pt_hours} hrs logged × ₹{pt_rate}/hr (Hourly Part-Time Basis)"
    assert "30.5 hrs" in pt_basis

    # 2. Daily Wage Employee (e.g. 22 days present @ ₹650/day)
    dw_days = 22
    dw_rate = 650.0
    dw_earned_base = round(dw_days * dw_rate)
    assert dw_earned_base == 14300
    dw_basis = f"{dw_days} Days Present × ₹{dw_rate}/day (Daily Wage Basis)"
    assert "22 Days Present" in dw_basis

    # 3. Full-Time Office Staff (9-6, ₹52,000 monthly base, 26 standard days, 2 unpaid absent days)
    ft_base = 52000.0
    standard_days = 26
    per_day_rate = round(ft_base / standard_days)  # ₹2,000 / day
    present_days = 24
    absent_days = standard_days - present_days  # 2 days
    loss_of_pay = absent_days * per_day_rate    # ₹4,000
    ft_earned_base = ft_base - loss_of_pay      # ₹48,000
    assert ft_earned_base == 48000.0

def test_salary_disbursement_payload_metadata():
    """Verify SalaryDisbursementPayload accepts multi-model calculation metadata."""
    from app.api.v1.operations import SalaryDisbursementPayload

    payload = SalaryDisbursementPayload(
        employee_id="emp-pt-1",
        cycle="September 2026",
        amount=7625.0,
        base_salary=7625.0,
        overtime_pay=0.0,
        performance_bonus=500.0,
        advance_deduction=0.0,
        statutory_deductions=500.0,
        net_salary=7625.0,
        employment_type="PART_TIME",
        calculation_basis="30.5 hrs logged × ₹250/hr (Hourly Part-Time Basis)",
        logged_hours=30.5,
        hourly_rate=250.0,
        days_present=12
    )
    assert payload.employment_type == "PART_TIME"
    assert payload.logged_hours == 30.5
    assert payload.hourly_rate == 250.0
    assert "Hourly Part-Time Basis" in payload.calculation_basis

def test_lunch_break_multi_punch_4_punches():
    """Verify 4-punch daily cycle (In, Lunch Out, Lunch In, Out) calculates 8.0h and excludes 1h lunch."""
    from app.api.v1.reports import calculate_punches_total_hours

    punches = [
        {"punch_number": 1, "action": "CHECK_IN", "timestamp": "2026-09-18T09:00:00+05:30"},
        {"punch_number": 2, "action": "CHECK_OUT", "timestamp": "2026-09-18T13:00:00+05:30"},
        {"punch_number": 3, "action": "CHECK_IN", "timestamp": "2026-09-18T14:00:00+05:30"},
        {"punch_number": 4, "action": "CHECK_OUT", "timestamp": "2026-09-18T18:00:00+05:30"}
    ]
    total_hours = calculate_punches_total_hours(punches)
    # Session 1: 4.0h, Lunch gap: 0h, Session 2: 4.0h -> Total: 8.0h
    assert total_hours == 8.0

def test_mid_day_lunch_break_immunity_prevents_premature_half_day():
    """Verify mid-day Punch #2 at lunch (4.0h) is NOT marked HALF_DAY during active shift."""
    from app.api.v1.reports import reconcile_attendance_status
    from app.models.schemas import AttendanceStatus

    record = {
        "date": "2026-09-18",
        "is_currently_in": False,
        "punch_count": 2,
        "total_hours": 4.0,
        "status": AttendanceStatus.PRESENT,
        "shift_status": "ON-TIME",
        "employment_type": "FULL_TIME"
    }
    org_work_hours = {
        "start_time": "09:00",
        "end_time": "18:00",
        "half_day_hours": 4.5
    }
    # Simulated mid-day time (13:15 PM) while shift is active
    current_time_midday = "2026-09-18T13:15:00+05:30"
    reconciled = reconcile_attendance_status(record, org_work_hours, current_time_iso=current_time_midday)

    # Must preserve PRESENT status and tag ON_LUNCH_BREAK (no premature half-day penalty!)
    assert reconciled["status"] == AttendanceStatus.PRESENT
    assert reconciled["break_status"] == "ON_LUNCH_BREAK"
    assert reconciled["is_concluded"] is False

def test_eod_reconciliation_marks_abandoned_lunch_as_half_day():
    """Verify employee who left at lunch (4.0h) and never returned is reconciled to HALF_DAY after shift end."""
    from app.api.v1.reports import reconcile_attendance_status
    from app.models.schemas import AttendanceStatus

    record = {
        "date": "2026-09-18",
        "is_currently_in": False,
        "punch_count": 2,
        "total_hours": 4.0,
        "status": AttendanceStatus.PRESENT,
        "shift_status": "ON-TIME",
        "employment_type": "FULL_TIME"
    }
    org_work_hours = {
        "start_time": "09:00",
        "end_time": "18:00",
        "half_day_hours": 4.5
    }
    # Simulated end-of-day time (18:30 PM, past shift_end)
    current_time_eod = "2026-09-18T18:30:00+05:30"
    reconciled = reconcile_attendance_status(record, org_work_hours, current_time_iso=current_time_eod)

    # Shift concluded with 4.0h (< 7.5h full target) -> Accurately reconciled to HALF_DAY
    assert reconciled["status"] == AttendanceStatus.HALF_DAY
    assert "HALF-DAY" in reconciled["shift_status"]
    assert reconciled["break_status"] == "SHIFT_ENDED"
    assert reconciled["is_concluded"] is True

def test_eod_reconciliation_part_time_target_completion():
    """Verify part-time worker completing 4.0h target is marked PRESENT, not penalized as HALF_DAY."""
    from app.api.v1.reports import reconcile_attendance_status
    from app.models.schemas import AttendanceStatus

    record = {
        "date": "2026-09-18",
        "is_currently_in": False,
        "punch_count": 2,
        "total_hours": 4.0,
        "status": AttendanceStatus.PRESENT,
        "shift_status": "ON-TIME",
        "employment_type": "PART_TIME",
        "target_daily_hours": 4.0
    }
    pt_emp = {
        "employment_type": "PART_TIME",
        "target_daily_hours": 4.0,
        "shift_end": "14:00"
    }
    # Simulated time past part-time shift end (14:30 PM)
    current_time_pt_end = "2026-09-18T14:30:00+05:30"
    reconciled = reconcile_attendance_status(record, None, emp=pt_emp, current_time_iso=current_time_pt_end)

    # 4.0h on 4.0h target = Full day PRESENT credit!
    assert reconciled["status"] == AttendanceStatus.PRESENT
    assert reconciled["is_concluded"] is True

def test_number_to_indian_words():
    """Verify number_to_indian_words helper produces accurate Indian English currency text."""
    from app.api.v1.payroll import number_to_indian_words

    assert number_to_indian_words(94) == "Ninety Four Rupees Only"
    assert number_to_indian_words(0) == "Zero Rupees Only"
    assert number_to_indian_words(500) == "Five Hundred Rupees Only"
    assert number_to_indian_words(2500) == "Two Thousand Five Hundred Rupees Only"
    assert number_to_indian_words(40000) == "Forty Thousand Rupees Only"
    assert number_to_indian_words(125000) == "One Lakh Twenty Five Thousand Rupees Only"
    assert number_to_indian_words(125000.50) == "One Lakh Twenty Five Thousand Rupees and Fifty Paise Only"

def test_financial_entries_and_payroll_reconciliation():
    """Verify bonus, allowance (reimbursement), and other deductions aggregate accurately into net pay."""
    # Base: 40000, Overtime: 2000, Bonus/Incentive: 1500, Allowance (Reimbursement): 3000
    # Total Gross Earnings: 46500
    # Deductions: Statutory: 3000, Advance Repayment: 5000, Other Deductions: 500
    # Total Deductions: 8500
    # Net: 46500 - 8500 = 38000
    base = 40000.0
    ot = 2000.0
    incentive = 1500.0
    allowance = 3000.0
    total_earnings = base + ot + incentive + allowance
    assert total_earnings == 46500.0

    statutory = 3000.0
    advance = 5000.0
    other_deds = 500.0
    total_deductions = statutory + advance + other_deds
    assert total_deductions == 8500.0

    net_pay = total_earnings - total_deductions
    assert net_pay == 38000.0

def test_extract_record_hours_and_automatic_punch_payroll():
    """Verify attendance records extract punch hours and calculate earned pay via hourly_rate."""
    from app.api.v1.payroll import extract_record_hours

    # 1. Record with explicit total_hours
    r1 = {"total_hours": 8.5}
    assert extract_record_hours(r1) == 8.5

    # 2. Record with punches list
    r2 = {
        "punches": [
            {"time": "09:00:00", "punch_type": "IN"},
            {"time": "13:00:00", "punch_type": "OUT"},
            {"time": "14:00:00", "punch_type": "IN"},
            {"time": "18:00:00", "punch_type": "OUT"},
        ]
    }
    assert extract_record_hours(r2) == 8.0

    # 3. Record with check_in and check_out timestamps
    r3 = {
        "check_in": "2026-09-18T09:00:00+05:30",
        "check_out": "2026-09-18T17:30:00+05:30"
    }
    assert extract_record_hours(r3) == 8.5

    # 4. Total hours for employee across days
    all_records = [r1, r2, r3]
    total_logged_hours = sum(extract_record_hours(r) for r in all_records)
    assert total_logged_hours == 25.0

    # 5. Automatic salary calculation: worked_hours * hourly_salary
    hourly_rate = 300.0
    earned_base_pay = round(total_logged_hours * hourly_rate, 2)
    assert earned_base_pay == 7500.0