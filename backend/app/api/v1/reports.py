from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import io
import math
import pandas as pd
from app.models.schemas import Attendance, AttendanceStatus
from app.core.security import require_tenant_context, require_org_admin
from app.db.store import store
from app.services.face_service import decode_base64_image, extract_face_embedding, find_best_match
from app.services.liveness_service import liveness_service
from app.core.config import settings
from pydantic import BaseModel

# Standard Indian Standard Time (UTC+5:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))

reports_router = APIRouter(prefix="/reports", tags=["Export Reports"])
attendance_router = APIRouter(prefix="/attendance", tags=["Attendance Capture & Logs"])

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle geodesic distance between two GPS coordinates in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)

def calculate_punches_total_hours(punches: List[Dict[str, Any]]) -> float:
    """
    Computes cumulative worked hours from alternating IN/OUT punch sessions.
    Each completed (CHECK_IN -> CHECK_OUT) pair contributes its duration.
    """
    if not punches:
        return 0.0
    total_seconds = 0.0
    last_in_dt = None
    for p in punches:
        action = (p.get("action") or "").upper()
        ts_str = p.get("timestamp")
        if not ts_str:
            continue
        try:
            ts_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            continue

        if action == "CHECK_IN":
            last_in_dt = ts_dt
        elif action == "CHECK_OUT" and last_in_dt:
            diff = (ts_dt - last_in_dt).total_seconds()
            if diff > 0:
                total_seconds += diff
            last_in_dt = None

    hours = total_seconds / 3600.0
    if total_seconds > 0 and hours < 0.01:
        return 0.01
    return round(hours, 2)

def reconcile_attendance_status(
    record: Dict[str, Any],
    org_work_hours: Optional[Dict[str, Any]] = None,
    emp: Optional[Dict[str, Any]] = None,
    current_time_iso: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates cumulative work hours and determines accurate attendance status:
    - Avoids premature HALF_DAY during active workday / mid-day break (Punch #2).
    - If employee completed regular shift target (>= 7.5h or part-time target) -> PRESENT (or LATE if arrival was late).
    - If employee completed >= half_day_hours (default 4.5h) but < target -> HALF_DAY.
    - If employee completed < half_day_hours and shift concluded -> HALF_DAY (per org threshold).
    - Accurately tags break_status: 'WORKING', 'ON_LUNCH_BREAK', 'ON_BREAK', or 'SHIFT_ENDED'.
    """
    cfg = org_work_hours or {}
    half_day_threshold = float(cfg.get("half_day_hours") or 4.5)
    default_full_target = 7.5

    emp_type = ((emp.get("employment_type") if emp else None) or record.get("employment_type") or "FULL_TIME").upper()

    if emp_type == "PART_TIME":
        target_hours = float((emp.get("target_daily_hours") if emp else None) or record.get("target_daily_hours") or 4.0)
        half_day_threshold = round(target_hours * 0.5, 2)
    else:
        target_hours = default_full_target

    total_hours = float(record.get("total_hours") or 0.0)
    is_currently_in = bool(record.get("is_currently_in", False))
    punch_count = int(record.get("punch_count") or len(record.get("punches") or []))

    # Parse current or simulated time
    if current_time_iso:
        try:
            now_dt = datetime.fromisoformat(current_time_iso.replace("Z", "+00:00"))
        except Exception:
            now_dt = datetime.now(IST_TZ)
    else:
        now_dt = datetime.now(IST_TZ)

    record_date = record.get("date")
    today_str = now_dt.strftime("%Y-%m-%d")
    is_past_day = bool(record_date and record_date < today_str)

    # Shift end boundary
    shift_end_str = (emp.get("shift_end") if emp else None) or cfg.get("end_time", "18:00")
    try:
        end_parts = shift_end_str.split(":")
        shift_end_time = datetime.min.time().replace(hour=int(end_parts[0]), minute=int(end_parts[1]))
    except Exception:
        shift_end_time = datetime.min.time().replace(hour=18, minute=0)

    # Is shift concluded?
    # Shift is concluded if:
    # 1. It is a past date
    # 2. Punch count >= 4 and employee is not currently clocked in (evening check-out done)
    # 3. Employee is clocked out and current time is past shift end
    is_concluded = (
        is_past_day or
        (punch_count >= 4 and not is_currently_in) or
        (not is_currently_in and now_dt.time() >= shift_end_time)
    )

    existing_status = record.get("status", AttendanceStatus.PRESENT)
    existing_shift_status = record.get("shift_status", "ON-TIME")
    was_late = (existing_status == AttendanceStatus.LATE or "LATE" in str(existing_shift_status).upper())

    # Determine break / presence state
    if is_currently_in:
        break_status = "WORKING"
    elif is_concluded:
        break_status = "SHIFT_ENDED"
    elif punch_count == 2:
        break_status = "ON_LUNCH_BREAK"
    elif punch_count > 0:
        break_status = "ON_BREAK"
    else:
        break_status = "NOT_STARTED"

    # Evaluate Status
    if is_currently_in:
        # Currently working - preserve presence
        status = AttendanceStatus.LATE if was_late else AttendanceStatus.PRESENT
        shift_status = "LATE" if was_late else ("ON-TIME" if existing_shift_status != "FLEXIBLE" else "FLEXIBLE")
    elif not is_concluded:
        # Active workday immunity window (e.g. Lunch break between Punch 2 and 3)
        # NEVER downgrade to HALF_DAY mid-day!
        status = AttendanceStatus.LATE if was_late else AttendanceStatus.PRESENT
        shift_status = "LATE" if was_late else ("ON-TIME" if existing_shift_status != "FLEXIBLE" else "FLEXIBLE")
    else:
        # Shift has concluded: Evaluate cumulative worked hours
        if total_hours >= target_hours:
            status = AttendanceStatus.LATE if was_late else AttendanceStatus.PRESENT
            shift_status = "LATE" if was_late else ("ON-TIME" if existing_shift_status != "FLEXIBLE" else "FLEXIBLE")
        elif total_hours >= half_day_threshold:
            status = AttendanceStatus.HALF_DAY
            shift_status = "LATE & HALF-DAY" if was_late else "HALF-DAY"
        elif total_hours > 0:
            status = AttendanceStatus.HALF_DAY
            shift_status = f"HALF-DAY ({total_hours}h)"
        else:
            status = AttendanceStatus.ABSENT
            shift_status = "ABSENT"

    return {
        "status": status,
        "shift_status": shift_status,
        "break_status": break_status,
        "is_concluded": is_concluded,
        "total_hours": total_hours
    }

# ----------------- ATTENDANCE ENDPOINTS -----------------

class KioskPunchPayload(BaseModel):
    organization_slug_or_id: Optional[str] = None
    image_sample: str
    punch_type: str = "AUTO"
    liveness_challenge_response: Optional[str] = "VERIFIED"
    kiosk_id: Optional[str] = "default-kiosk"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None

class FieldPunchPayload(BaseModel):
    client_site_id: str
    image_sample: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    notes: Optional[str] = None
    punch_type: str = "AUTO"

@attendance_router.get("/liveness-challenge")
def get_liveness_challenge():
    return liveness_service.generate_random_challenge()

@attendance_router.post("/kiosk-punch")
async def kiosk_punch(payload: KioskPunchPayload):
    target_org = (payload.organization_slug_or_id or "").strip()
    org = None
    if target_org and target_org.upper() not in ("AUTO", "ALL"):
        org = await store.find_one("organizations", {"id": target_org})
        if not org:
            org = await store.find_one("organizations", {"slug": target_org})
        if not org:
            raise HTTPException(
                status_code=404,
                detail=f"Organization '{target_org}' not found."
            )

    try:
        image = decode_base64_image(payload.image_sample)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image payload.")

    quality = liveness_service.check_liveness_quality(image)
    if not quality.get("passed", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Face quality check failed. Please look straight into camera with good lighting."
        )

    live_vector = extract_face_embedding(image)
    if live_vector is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face clearly detected. Please center your face inside the reticle."
        )

    if org:
        employees = await store.find_many("employees", {"organization_id": org["id"], "is_active": True})
        if not employees:
            raise HTTPException(
                status_code=404, 
                detail=f"No registered employees found in {org.get('name', 'this organization')}."
            )
    else:
        # Cross-organization auto-detection across all active enrolled employees
        employees = await store.find_many("employees", {"is_active": True})
        if not employees:
            raise HTTPException(
                status_code=404, 
                detail="No registered employees found in system."
            )

    matched_emp, confidence = find_best_match(
        live_vector=live_vector,
        tenant_employees=employees,
        threshold=settings.SIMILARITY_THRESHOLD
    )

    if not matched_emp:
        org_name = org.get("name") if org else "the system"
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Face not recognized in {org_name}. Please ensure you are enrolled."
        )

    org_id = matched_emp["organization_id"]
    if not org or org.get("id") != org_id:
        org = await store.find_one("organizations", {"id": org_id})
        if not org:
            raise HTTPException(status_code=404, detail="Employee organization record not found.")

    # Calculate exact local time in organization's timezone
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(IST_TZ)
    today_str = now_local.strftime("%Y-%m-%d")
    time_str = now_local.strftime("%I:%M:%S %p")

    existing_record = await store.find_one("attendance", {
        "organization_id": org_id,
        "employee_id": matched_emp["id"],
        "date": today_str
    })

    # 1. Determine punch action
    req_type = (payload.punch_type or "AUTO").upper()
    if req_type in ("CHECK_IN", "CHECK_OUT"):
        punch_action = req_type
    else:
        # Alternating Multi-Punch State Machine:
        # If no record exists for today -> 1st punch is always CHECK_IN.
        # If record exists: if currently clocked in -> CHECK_OUT, otherwise CHECK_IN.
        if not existing_record:
            punch_action = "CHECK_IN"
        else:
            is_currently_in = existing_record.get("is_currently_in", False)
            punch_action = "CHECK_OUT" if is_currently_in else "CHECK_IN"

    # 2. Worker Classification & Late Arrival / Shift Status Evaluation
    emp_type = (matched_emp.get("employment_type") or "FULL_TIME").upper()
    shift_type = (matched_emp.get("shift_type") or "FIXED").upper()
    assigned_shift_str = (matched_emp.get("assigned_shift") or "").lower()

    is_flexible = (
        shift_type == "FLEXIBLE" or 
        emp_type == "DAILY_WAGE" or 
        "flexible" in assigned_shift_str or
        "coolie" in assigned_shift_str
    )

    if is_flexible:
        # Flexible and Daily Wage workers are NEVER penalized as LATE
        record_status = AttendanceStatus.PRESENT
        shift_status = "FLEXIBLE"
    else:
        if not existing_record:
            # First punch of the day: Check against shift start + grace
            work_start = matched_emp.get("shift_start") or org.get("work_hours", {}).get("start_time", "09:00")
            grace = org.get("work_hours", {}).get("late_grace_minutes", 15)
            
            start_h, start_m = map(int, work_start.split(":"))
            cur_h, cur_m = now_local.hour, now_local.minute
            total_start_mins = start_h * 60 + start_m + grace
            total_cur_mins = cur_h * 60 + cur_m

            if total_cur_mins > total_start_mins:
                record_status = AttendanceStatus.LATE
                shift_status = "LATE"
            else:
                record_status = AttendanceStatus.PRESENT
                shift_status = "ON-TIME"
        else:
            # Preserve existing daily arrival status on subsequent punches
            record_status = existing_record.get("status", AttendanceStatus.PRESENT)
            shift_status = existing_record.get("shift_status", "ON-TIME")

    # Geofence validation & distance calculation
    geofence_cfg = org.get("geofence") if org else None
    geofence_status = "DISABLED"
    distance_meters = None

    if geofence_cfg and geofence_cfg.get("is_enabled"):
        target_lat = geofence_cfg.get("latitude")
        target_lon = geofence_cfg.get("longitude")
        radius = geofence_cfg.get("radius_meters", 150)
        strict = geofence_cfg.get("strict_enforcement", False)

        if payload.latitude is not None and payload.longitude is not None and target_lat is not None and target_lon is not None:
            distance_meters = calculate_haversine_distance(payload.latitude, payload.longitude, target_lat, target_lon)
            if distance_meters <= radius:
                geofence_status = "INSIDE"
            else:
                geofence_status = "OUTSIDE"
                if strict:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Geofence Enforcement: Punch rejected. You are {int(distance_meters)}m away from the designated perimeter (allowed radius: {radius}m)."
                    )
        else:
            geofence_status = "NO_GPS"
            if strict:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Geofence Enforcement: Location access is required to verify on-site attendance. Please enable device GPS."
                )

    # 3. Assemble Sequential Punch List
    existing_punches = list(existing_record.get("punches") or []) if existing_record else []
    punch_num = len(existing_punches) + 1

    punch_entry = {
        "punch_number": punch_num,
        "action": punch_action,
        "time": time_str,
        "timestamp": now_utc.isoformat(),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accuracy": payload.accuracy,
        "geofence_status": geofence_status,
        "distance_meters": distance_meters
    }
    all_punches = existing_punches + [punch_entry]

    # Calculate cumulative total hours across all completed sessions
    total_hours = calculate_punches_total_hours(all_punches)
    new_is_currently_in = (punch_action == "CHECK_IN")

    # Part-time threshold check: if part-time and target hours reached, ensure PRESENT
    if emp_type == "PART_TIME":
        target_hours = float(matched_emp.get("target_daily_hours") or 4.0)
        if total_hours >= target_hours and record_status != AttendanceStatus.LATE:
            shift_status = "ON-TIME"

    if not existing_record:
        new_att = {
            "id": f"ATT-{now_utc.strftime('%Y%m%d%H%M%S')}-{matched_emp['employee_code']}",
            "organization_id": org_id,
            "employee_id": matched_emp["id"],
            "employee_code": matched_emp["employee_code"],
            "employee_name": f"{matched_emp['first_name']} {matched_emp['last_name']}",
            "department": matched_emp.get("department", "General"),
            "employment_type": emp_type,
            "shift_type": shift_type,
            "date": today_str,
            "check_in": now_utc.isoformat(),
            "check_in_time": time_str,
            "check_out": now_utc.isoformat() if punch_action == "CHECK_OUT" else None,
            "check_out_time": time_str if punch_action == "CHECK_OUT" else None,
            "total_hours": total_hours,
            "is_currently_in": new_is_currently_in,
            "punch_count": punch_num,
            "punches": all_punches,
            "last_punch_time": time_str,
            "last_punch_action": punch_action,
            "break_status": "WORKING" if new_is_currently_in else "NOT_STARTED",
            "status": record_status,
            "shift_status": shift_status,
            "verification_mode": "FACE_KIOSK",
            "confidence_score": confidence,
            "liveness_verified": True,
            "kiosk_id": payload.kiosk_id,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "accuracy": payload.accuracy,
            "geofence_status": geofence_status,
            "distance_meters": distance_meters
        }
        await store.insert_one("attendance", new_att)
        res_record = new_att
    else:
        update_fields = {
            "is_currently_in": new_is_currently_in,
            "punch_count": punch_num,
            "punches": all_punches,
            "last_punch_time": time_str,
            "last_punch_action": punch_action,
            "total_hours": total_hours,
            "confidence_score": max(confidence, existing_record.get("confidence_score", 0))
        }
        if punch_action == "CHECK_OUT":
            update_fields["check_out"] = now_utc.isoformat()
            update_fields["check_out_time"] = time_str
        
        if payload.latitude is not None:
            update_fields["latitude"] = payload.latitude
            update_fields["longitude"] = payload.longitude
            update_fields["geofence_status"] = geofence_status
            update_fields["distance_meters"] = distance_meters

        # Reconcile status to handle lunch break immunity vs EOD half-day
        cand_record = {
            **existing_record,
            **update_fields,
            "total_hours": total_hours,
            "punch_count": punch_num,
            "is_currently_in": new_is_currently_in
        }
        reconciled = reconcile_attendance_status(
            cand_record,
            org.get("work_hours") if org else None,
            matched_emp,
            current_time_iso=now_utc.isoformat()
        )
        update_fields["status"] = reconciled["status"]
        update_fields["shift_status"] = reconciled["shift_status"]
        update_fields["break_status"] = reconciled["break_status"]

        await store.update_one("attendance", {"id": existing_record["id"]}, update_fields)
        existing_record.update(update_fields)
        res_record = existing_record

    # Record persistent punch stream event for LIVE PUNCH EVENT STREAM
    fn = matched_emp.get("first_name", "")
    ln = matched_emp.get("last_name", "")
    initials = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or "EM"

    operation_label = f"PUNCH #{punch_num} [{punch_action.replace('CHECK_', '')}]"

    # Format entry distance for live stream display
    office_name = (geofence_cfg.get("office_name") if geofence_cfg else None) or (org.get("name") if org else "Office")
    if distance_meters is not None:
        radius = geofence_cfg.get("radius_meters", 150) if geofence_cfg else 150
        if geofence_status == "INSIDE" or distance_meters <= radius:
            entry_dist_str = f"{int(distance_meters)}m (Within {office_name})"
        else:
            entry_dist_str = f"{int(distance_meters)}m (Off-Site)"
    else:
        entry_dist_str = f"0m ({office_name} Kiosk)"

    punch_event = {
        "id": f"EVT-{now_utc.strftime('%Y%m%d%H%M%S%f')}",
        "organization_id": org_id,
        "employee_id": matched_emp["id"],
        "employee_name": f"{fn} {ln}".strip(),
        "employee_code": matched_emp["employee_code"],
        "employment_type": emp_type,
        "shift_type": shift_type,
        "department": matched_emp.get("department", "Operations"),
        "time": time_str,
        "date": today_str,
        "timestamp": now_utc.isoformat(),
        "operation": operation_label,
        "action": punch_action,
        "punch_number": punch_num,
        "is_in": new_is_currently_in,
        "avatar": initials,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "geofence_status": geofence_status,
        "distance_meters": distance_meters,
        "entry_distance": entry_dist_str
    }
    await store.insert_one("attendance_events", punch_event)

    return {
        "status": "success",
        "action": punch_action,
        "punch_number": punch_num,
        "punch_count": punch_num,
        "is_currently_in": new_is_currently_in,
        "employee_name": f"{matched_emp['first_name']} {matched_emp['last_name']}",
        "employee_code": matched_emp["employee_code"],
        "employment_type": emp_type,
        "shift_type": shift_type,
        "department": matched_emp.get("department", "General"),
        "organization_id": org_id,
        "organization_name": org.get("name", "Argus Enterprise"),
        "timestamp": time_str,
        "date": today_str,
        "attendance_status": res_record.get("status", "PRESENT"),
        "shift_status": res_record.get("shift_status", shift_status),
        "confidence": round(confidence * 100, 1),
        "total_hours": res_record.get("total_hours", 0.0),
        "geofence_status": geofence_status,
        "distance_meters": distance_meters,
        "entry_distance": entry_dist_str
    }

@attendance_router.post("/field-punch")
async def field_visit_punch(
    payload: FieldPunchPayload,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    """
    Field worker client site punch with live GPS vs. client site geofencing and facial biometrics.
    """
    org_id = auth_ctx["org_id"]
    email = auth_ctx.get("email")
    emp_id = auth_ctx.get("emp_id")

    emp = None
    if emp_id:
        emp = await store.find_one("employees", {"id": emp_id, "organization_id": org_id})
    if not emp and email:
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id})
    if not emp:
        user = await store.find_one("users", {"email": email, "organization_id": org_id})
        if user and user.get("employee_id"):
            emp = await store.find_one("employees", {"id": user["employee_id"], "organization_id": org_id})
    
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    site = await store.find_one("client_sites", {"id": payload.client_site_id, "organization_id": org_id, "is_active": True})
    if not site:
        raise HTTPException(status_code=404, detail="Client project site not found or deactivated.")

    try:
        image = decode_base64_image(payload.image_sample)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid camera frame.")

    quality = liveness_service.check_liveness_quality(image)
    if not quality.get("passed", False):
        raise HTTPException(
            status_code=400,
            detail="Biometric verification failed: Ensure face is clearly centered in good lighting."
        )

    live_vector = extract_face_embedding(image)
    if live_vector is None:
        raise HTTPException(status_code=400, detail="No face detected in capture.")

    # Match against employee's enrolled face embeddings
    matched, confidence = find_best_match(live_vector, [emp], threshold=settings.SIMILARITY_THRESHOLD)
    if not matched:
        raise HTTPException(status_code=401, detail="Facial biometric mismatch. You can only punch your own site visit.")

    # Calculate distance to designated client site
    distance = calculate_haversine_distance(
        payload.latitude, payload.longitude,
        site["latitude"], site["longitude"]
    )
    radius = site.get("radius_meters", 150)
    is_on_site = distance <= radius
    geofence_status = "VERIFIED_ON_SITE" if is_on_site else "SITE_PERIMETER_VIOLATION"

    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(IST_TZ)
    today_str = now_local.strftime("%Y-%m-%d")
    time_str = now_local.strftime("%I:%M:%S %p")

    # Find today's attendance record
    existing_record = await store.find_one("attendance", {
        "organization_id": org_id,
        "employee_id": emp["id"],
        "date": today_str
    })

    # Alternating punch state
    if not existing_record:
        punch_action = "CHECK_IN"
    else:
        is_currently_in = existing_record.get("is_currently_in", False)
        punch_action = "CHECK_OUT" if is_currently_in else "CHECK_IN"

    existing_punches = list(existing_record.get("punches") or []) if existing_record else []
    punch_num = len(existing_punches) + 1

    punch_entry = {
        "punch_number": punch_num,
        "action": punch_action,
        "time": time_str,
        "timestamp": now_utc.isoformat(),
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "accuracy": payload.accuracy,
        "geofence_status": geofence_status,
        "distance_meters": distance,
        "client_site_id": site["id"],
        "client_site_name": site["site_name"],
        "site_visit_verified": is_on_site,
        "notes": payload.notes
    }
    all_punches = existing_punches + [punch_entry]
    total_hours = calculate_punches_total_hours(all_punches)
    new_is_in = (punch_action == "CHECK_IN")

    if not existing_record:
        new_att = {
            "id": f"ATT-{now_utc.strftime('%Y%m%d%H%M%S')}-{emp['employee_code']}",
            "organization_id": org_id,
            "employee_id": emp["id"],
            "employee_code": emp["employee_code"],
            "employee_name": f"{emp['first_name']} {emp['last_name']}",
            "department": emp.get("department", "Field Operations"),
            "employment_type": emp.get("employment_type", "FIELD_WORKER"),
            "shift_type": emp.get("shift_type", "FLEXIBLE"),
            "date": today_str,
            "check_in": now_utc.isoformat(),
            "check_in_time": time_str,
            "check_out": now_utc.isoformat() if punch_action == "CHECK_OUT" else None,
            "check_out_time": time_str if punch_action == "CHECK_OUT" else None,
            "total_hours": total_hours,
            "is_currently_in": new_is_in,
            "punch_count": punch_num,
            "punches": all_punches,
            "last_punch_time": time_str,
            "last_punch_action": punch_action,
            "status": "PRESENT",
            "shift_status": "ON-SITE" if is_on_site else "OUTSIDE-SITE",
            "verification_mode": "FIELD_CLIENT_SITE",
            "confidence_score": confidence,
            "liveness_verified": True,
            "client_site_id": site["id"],
            "client_site_name": site["site_name"],
            "site_visit_verified": is_on_site,
            "break_status": "WORKING" if new_is_in else "NOT_STARTED",
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "accuracy": payload.accuracy,
            "geofence_status": geofence_status,
            "distance_meters": distance,
            "notes": payload.notes
        }
        await store.insert_one("attendance", new_att)
        res_record = new_att
    else:
        update_fields = {
            "is_currently_in": new_is_in,
            "punch_count": punch_num,
            "punches": all_punches,
            "last_punch_time": time_str,
            "last_punch_action": punch_action,
            "total_hours": total_hours,
            "client_site_id": site["id"],
            "client_site_name": site["site_name"],
            "site_visit_verified": is_on_site,
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "geofence_status": geofence_status,
            "distance_meters": distance,
            "notes": payload.notes or existing_record.get("notes")
        }
        if punch_action == "CHECK_OUT":
            update_fields["check_out"] = now_utc.isoformat()
            update_fields["check_out_time"] = time_str

        # Reconcile status to handle break immunity vs EOD half-day
        cand_record = {
            **existing_record,
            **update_fields,
            "total_hours": total_hours,
            "punch_count": punch_num,
            "is_currently_in": new_is_in
        }
        reconciled = reconcile_attendance_status(
            cand_record,
            org.get("work_hours") if org else None,
            emp,
            current_time_iso=now_utc.isoformat()
        )
        update_fields["status"] = reconciled["status"]
        update_fields["shift_status"] = reconciled["shift_status"]
        update_fields["break_status"] = reconciled["break_status"]

        await store.update_one("attendance", {"id": existing_record["id"]}, update_fields)
        existing_record.update(update_fields)
        res_record = existing_record

    # Stream event
    fn = emp.get("first_name", "")
    ln = emp.get("last_name", "")
    initials = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or "FW"
    event_label = f"FIELD PUNCH #{punch_num} [{punch_action.replace('CHECK_', '')}]: {site['site_name']}"
    event = {
        "id": f"EVT-{now_utc.strftime('%Y%m%d%H%M%S%f')}",
        "organization_id": org_id,
        "employee_name": f"{fn} {ln}".strip(),
        "employee_code": emp["employee_code"],
        "employment_type": emp.get("employment_type", "FIELD_WORKER"),
        "department": emp.get("department", "Field Operations"),
        "time": time_str,
        "date": today_str,
        "timestamp": now_utc.isoformat(),
        "operation": event_label,
        "action": punch_action,
        "punch_number": punch_num,
        "is_in": new_is_in,
        "avatar": initials,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "client_site_id": site["id"],
        "client_site_name": site["site_name"],
        "site_visit_verified": is_on_site,
        "geofence_status": geofence_status,
        "distance_meters": distance
    }
    await store.insert_one("attendance_events", event)

    return {
        "status": "success",
        "action": punch_action,
        "punch_number": punch_num,
        "punch_count": punch_num,
        "is_currently_in": new_is_in,
        "site_name": site["site_name"],
        "client_name": site["client_name"],
        "site_visit_verified": is_on_site,
        "geofence_status": geofence_status,
        "distance_meters": distance,
        "allowed_radius": radius,
        "honesty_status": "HONEST ON-SITE VISIT" if is_on_site else f"VIOLATION: {int(distance)}m AWAY FROM SITE",
        "employee_name": f"{fn} {ln}".strip(),
        "timestamp": time_str,
        "date": today_str,
        "total_hours": res_record.get("total_hours", 0.0)
    }

@attendance_router.get("/kiosk-stream")
async def get_kiosk_stream(organization_slug_or_id: Optional[str] = None, organization_id: Optional[str] = None):
    """Retrieve persisted live punch event stream records for kiosk display."""
    target = organization_slug_or_id or organization_id
    today_str = datetime.now(IST_TZ).strftime("%Y-%m-%d")

    if not target or target.upper() in ("AUTO", "ALL"):
        events = await store.find_many("attendance_events", {"date": today_str}, sort_key="timestamp", sort_desc=True, limit=20)
        if not events:
            events = await store.find_many("attendance_events", {}, sort_key="timestamp", sort_desc=True, limit=20)
        return events
        
    org = await store.find_one("organizations", {"slug": target})
    if not org:
        org = await store.find_one("organizations", {"id": target})
    org_id = org["id"] if org else target

    active_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    active_emp_ids = {e["id"] for e in active_emps}
    active_emp_codes = {e.get("employee_code") for e in active_emps if e.get("employee_code")}
    emp_map_by_id = {e["id"]: e for e in active_emps}
    emp_map_by_code = {e.get("employee_code"): e for e in active_emps if e.get("employee_code")}

    events = await store.find_many("attendance_events", {
        "organization_id": org_id,
        "date": today_str
    }, sort_key="timestamp", sort_desc=True, limit=20)
    events = [e for e in events if e.get("employee_id") in active_emp_ids or e.get("employee_code") in active_emp_codes]

    geofence_cfg = (org.get("geofence") if org else None) or {
        "is_enabled": True,
        "latitude": 13.0827,
        "longitude": 80.2707,
        "radius_meters": 200,
        "office_name": org.get("name", "Headquarters") if org else "Headquarters"
    }
    base_lat = geofence_cfg.get("latitude", 13.0827)
    base_lon = geofence_cfg.get("longitude", 80.2707)
    radius = geofence_cfg.get("radius_meters", 200)
    office_name = geofence_cfg.get("office_name") or (org.get("name") if org else "Headquarters")

    # Dynamically resolve latest employee details and entry_distance on events
    for ev in events:
        emp = emp_map_by_id.get(ev.get("employee_id")) or emp_map_by_code.get(ev.get("employee_code"))
        if emp:
            fn = emp.get("first_name", "")
            ln = emp.get("last_name", "")
            ev["employee_name"] = f"{fn} {ln}".strip()
            ev["employee_code"] = emp.get("employee_code", ev.get("employee_code"))
            ev["department"] = emp.get("department", ev.get("department"))
            ev["avatar"] = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or "EM"

        if not ev.get("entry_distance"):
            dist = ev.get("distance_meters")
            if dist is None and ev.get("latitude") is not None and ev.get("longitude") is not None and base_lat is not None and base_lon is not None:
                try:
                    dist = calculate_haversine_distance(float(ev["latitude"]), float(ev["longitude"]), float(base_lat), float(base_lon))
                    ev["distance_meters"] = dist
                except Exception:
                    dist = None

            if dist is not None:
                if dist <= radius:
                    ev["entry_distance"] = f"{int(dist)}m (Within {office_name})"
                else:
                    ev["entry_distance"] = f"{int(dist)}m (Off-Site)"
            else:
                ev["entry_distance"] = f"0m ({office_name} Kiosk)"
                ev["distance_meters"] = 0.0

    if not events:
        # Graceful fallback: construct event list from today's attendance table
        raw_records = await store.find_many("attendance", {
            "organization_id": org_id,
            "date": today_str
        }, sort_key="check_in", sort_desc=True, limit=20)
        records = [r for r in raw_records if r.get("employee_id") in active_emp_ids]

        fallback_events = []
        for r in records:
            emp = emp_map_by_id.get(r.get("employee_id")) or emp_map_by_code.get(r.get("employee_code"))
            if emp:
                fn = emp.get("first_name", "")
                ln = emp.get("last_name", "")
                name = f"{fn} {ln}".strip()
                code = emp.get("employee_code", r.get("employee_code"))
                dept = emp.get("department", r.get("department"))
                av = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or "EM"
            else:
                name = r.get("employee_name", "Employee")
                code = r.get("employee_code", "EMP")
                dept = r.get("department", "Operations")
                name_parts = name.split()
                av = (name_parts[0][:1] + (name_parts[1][:1] if len(name_parts) > 1 else "")).upper() or "EM"

            rec_dist = r.get("distance_meters")
            rec_entry_dist = r.get("entry_distance")
            if not rec_entry_dist:
                if rec_dist is not None:
                    rec_entry_dist = f"{int(rec_dist)}m (Within {office_name})" if rec_dist <= radius else f"{int(rec_dist)}m (Off-Site)"
                else:
                    rec_entry_dist = f"0m ({office_name} Kiosk)"
                    rec_dist = 0.0

            if r.get("check_out_time"):
                fallback_events.append({
                    "id": f"{r['id']}-out",
                    "employee_name": name,
                    "employee_code": code,
                    "department": dept,
                    "time": r.get("check_out_time"),
                    "date": r.get("date"),
                    "timestamp": r.get("check_out") or r.get("date"),
                    "operation": "SHIFT END [OUT]",
                    "is_in": False,
                    "avatar": av,
                    "entry_distance": rec_entry_dist,
                    "distance_meters": rec_dist
                })
            if r.get("check_in_time"):
                fallback_events.append({
                    "id": f"{r['id']}-in",
                    "employee_name": name,
                    "employee_code": code,
                    "department": dept,
                    "time": r.get("check_in_time"),
                    "date": r.get("date"),
                    "timestamp": r.get("check_in") or r.get("date"),
                    "operation": "SHIFT START [IN]",
                    "is_in": True,
                    "avatar": av,
                    "entry_distance": rec_entry_dist,
                    "distance_meters": rec_dist
                })
        fallback_events.sort(key=lambda x: str(x.get("timestamp") or ""), reverse=True)
        return fallback_events[:10]

    return events[:10]

@attendance_router.get("/today")
async def get_today_attendance(
    date: Optional[str] = Query(None),
    client_date: Optional[str] = Query(None),
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    raw_org_id = auth_ctx.get("org_id")
    org = await store.find_one("organizations", {"id": raw_org_id})
    if not org:
        org = await store.find_one("organizations", {"slug": raw_org_id})
    org_id = org["id"] if org else raw_org_id
    org_slug = org.get("slug") if org else None
    org_ids = list(set(filter(None, [org_id, org_slug, raw_org_id])))

    ist_today = datetime.now(IST_TZ).strftime("%Y-%m-%d")
    utc_today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target_dates = list(set(filter(None, [date, client_date, ist_today, utc_today])))
    primary_date = date or client_date or ist_today

    all_emps = await store.find_many("employees", {"organization_id": {"$in": org_ids} if len(org_ids) > 1 else org_id})
    emp_map = {e["id"]: e for e in all_emps}
    emp_map_by_code = {e.get("employee_code"): e for e in all_emps if e.get("employee_code")}
    total_emps_count = len([e for e in all_emps if e.get("is_active") is not False])

    query = {
        "organization_id": {"$in": org_ids} if len(org_ids) > 1 else org_id,
        "date": {"$in": target_dates} if len(target_dates) > 1 else primary_date
    }
    raw_records = await store.find_many("attendance", query, sort_key="check_in", sort_desc=True)

    org_work_hours = org.get("work_hours") if org else None

    # Geofence configuration for distance calculation
    geofence_cfg = (org.get("geofence") if org else None) or {
        "is_enabled": True,
        "latitude": 13.0827,
        "longitude": 80.2707,
        "radius_meters": 200,
        "office_name": org.get("name", "Headquarters") if org else "Headquarters"
    }
    base_lat = geofence_cfg.get("latitude", 13.0827)
    base_lon = geofence_cfg.get("longitude", 80.2707)
    radius = geofence_cfg.get("radius_meters", 200)
    office_name = geofence_cfg.get("office_name") or (org.get("name") if org else "Headquarters")

    # Dynamically resolve employee details and reconcile status without dropping any record
    records = []
    for r in raw_records:
        emp = emp_map.get(r.get("employee_id")) or emp_map_by_code.get(r.get("employee_code"))
        if emp:
            fn = emp.get('first_name', '')
            ln = emp.get('last_name', '')
            full_name = f"{fn} {ln}".strip()
            if full_name:
                r["employee_name"] = full_name
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))

        reconciled = reconcile_attendance_status(r, org_work_hours, emp)
        r["status"] = reconciled["status"]
        r["shift_status"] = reconciled["shift_status"]
        r["break_status"] = reconciled["break_status"]

        # Calculate entry distance from designated location for all employees
        dist = None
        if r.get("distance_meters") is not None:
            try:
                dist = round(float(r["distance_meters"]), 1)
            except Exception:
                dist = None
        elif r.get("latitude") is not None and r.get("longitude") is not None and base_lat is not None and base_lon is not None:
            try:
                dist = calculate_haversine_distance(float(r["latitude"]), float(r["longitude"]), float(base_lat), float(base_lon))
                r["distance_meters"] = dist
            except Exception:
                dist = None

        if r.get("verification_mode") == "MANUAL_OVERRIDE":
            r["entry_distance"] = "0m (HQ Authorized)"
            r["distance_meters"] = 0.0
        elif dist is not None:
            if dist <= radius:
                r["entry_distance"] = f"{int(dist)}m (Within {office_name})"
            else:
                r["entry_distance"] = f"{int(dist)}m (Off-Site)"
        elif r.get("site_visit_verified") or r.get("client_site_name"):
            r["entry_distance"] = f"0m ({r.get('client_site_name', 'Client Site')})"
            r["distance_meters"] = 0.0
        elif r.get("kiosk_id") or r.get("verification_mode") == "FACE_KIOSK":
            r["entry_distance"] = f"0m ({office_name} Kiosk)"
            r["distance_meters"] = 0.0
        else:
            r["entry_distance"] = f"0m (Within {office_name})"
            r["distance_meters"] = 0.0

        records.append(r)

    present_count = len([r for r in records if r.get("status") in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]])
    half_day_count = len([r for r in records if r.get("status") == AttendanceStatus.HALF_DAY])
    late_count = len([r for r in records if r.get("status") == AttendanceStatus.LATE or "LATE" in str(r.get("shift_status", ""))])
    absent_count = max(0, total_emps_count - (present_count + half_day_count))

    return {
        "date": primary_date,
        "summary": {
            "total_employees": total_emps_count,
            "present": present_count,
            "half_day": half_day_count,
            "late": late_count,
            "absent": absent_count,
            "on_time_rate": round(((present_count - late_count) / max(1, present_count)) * 100, 1) if present_count > 0 else 0
        },
        "records": records
    }

@attendance_router.get("/map-punches")
async def get_map_punches(auth_ctx: Dict[str, Any] = Depends(require_tenant_context)):
    """
    Retrieves today's attendance check-ins tagged with GPS coordinates for realtime map tracking.
    """
    org_id = auth_ctx["org_id"]
    today_str = datetime.now(IST_TZ).strftime("%Y-%m-%d")

    org = await store.find_one("organizations", {"id": org_id})
    geofence_cfg = (org.get("geofence") if org else None) or {
        "is_enabled": True,
        "latitude": 13.0827,
        "longitude": 80.2707,
        "radius_meters": 200,
        "strict_enforcement": False,
        "office_name": org.get("name", "Headquarters") if org else "Headquarters"
    }

    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}

    records = await store.find_many("attendance", {
        "organization_id": org_id,
        "date": today_str
    }, sort_key="check_in", sort_desc=True)

    events = await store.find_many("attendance_events", {
        "organization_id": org_id,
        "date": today_str
    }, sort_key="timestamp", sort_desc=True)

    map_items = []
    base_lat = geofence_cfg.get("latitude", 13.0827)
    base_lon = geofence_cfg.get("longitude", 80.2707)

    client_sites = await store.find_many("client_sites", {"organization_id": org_id, "is_active": True})

    for idx, r in enumerate(records):
        emp_id = r.get("employee_id")
        emp = emp_map.get(emp_id, {})
        lat = r.get("latitude")
        lon = r.get("longitude")

        if lat is None or lon is None:
            ev = next((e for e in events if e.get("employee_code") == r.get("employee_code")), None)
            if ev and ev.get("latitude") is not None:
                lat = ev.get("latitude")
                lon = ev.get("longitude")

        fn = emp.get("first_name", "")
        ln = emp.get("last_name", "")
        name = f"{fn} {ln}".strip() or r.get("employee_name", "Employee")
        initials = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or name[:2].upper()

        status_val = r.get("geofence_status")
        dist = r.get("distance_meters")

        # Graceful location fallback for testing / earlier records
        if lat is None or lon is None:
            # Deterministic small offset within office perimeter based on index
            angle = (idx * 45) * (math.pi / 180)
            offset_dist = 0.0003 * ((idx % 3) + 1)
            lat = base_lat + (offset_dist * math.cos(angle))
            lon = base_lon + (offset_dist * math.sin(angle))
            status_val = "INSIDE"
            dist = round(offset_dist * 111000, 1)

        if not status_val or status_val == "DISABLED":
            status_val = "INSIDE" if r.get("status") == "PRESENT" else "OUTSIDE"

        map_items.append({
            "id": r.get("id"),
            "employee_id": emp_id,
            "employee_name": name,
            "employee_code": r.get("employee_code", emp.get("employee_code", "—")),
            "department": emp.get("department", r.get("department", "Operations")),
            "designation": emp.get("designation", "Staff"),
            "employment_type": emp.get("employment_type", "FULL_TIME"),
            "client_site_id": r.get("client_site_id"),
            "client_site_name": r.get("client_site_name"),
            "site_visit_verified": r.get("site_visit_verified"),
            "avatar": initials,
            "latitude": lat,
            "longitude": lon,
            "check_in_time": r.get("check_in_time") or r.get("check_in"),
            "check_out_time": r.get("check_out_time") or r.get("check_out"),
            "shift_status": r.get("shift_status", "ON-TIME"),
            "geofence_status": status_val,
            "distance_meters": dist,
            "timestamp": r.get("check_in") or r.get("date")
        })

    inside_count = len([m for m in map_items if m.get("geofence_status") in ("INSIDE", "VERIFIED_ON_SITE")])
    violation_count = len([m for m in map_items if m.get("geofence_status") in ("OUTSIDE", "SITE_PERIMETER_VIOLATION")])

    return {
        "date": today_str,
        "geofence": geofence_cfg,
        "client_sites": client_sites,
        "punches": map_items,
        "total_punches": len(map_items),
        "inside_count": inside_count,
        "violation_count": violation_count
    }

@attendance_router.get("/history")
async def get_attendance_history(
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    raw_org_id = auth_ctx.get("org_id")
    org = await store.find_one("organizations", {"id": raw_org_id})
    if not org:
        org = await store.find_one("organizations", {"slug": raw_org_id})
    org_id = org["id"] if org else raw_org_id
    org_slug = org.get("slug") if org else None
    org_ids = list(set(filter(None, [org_id, org_slug, raw_org_id])))

    query = {"organization_id": {"$in": org_ids} if len(org_ids) > 1 else org_id}
    
    if employee_id:
        query["employee_id"] = employee_id

    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}

    if department:
        query["department"] = department

    raw_records = await store.find_many("attendance", query, sort_key="date", sort_desc=True, limit=500)
    all_emps = await store.find_many("employees", {"organization_id": {"$in": org_ids} if len(org_ids) > 1 else org_id})
    emp_map = {e["id"]: e for e in all_emps}
    emp_map_by_code = {e.get("employee_code"): e for e in all_emps if e.get("employee_code")}

    records = []
    for r in raw_records:
        emp = emp_map.get(r.get("employee_id")) or emp_map_by_code.get(r.get("employee_code"))
        if emp:
            fn = emp.get('first_name', '')
            ln = emp.get('last_name', '')
            full_name = f"{fn} {ln}".strip()
            if full_name:
                r["employee_name"] = full_name
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))
            if not r.get("shift"):
                r["shift"] = emp.get("assigned_shift", "General Shift")
        records.append(r)

    for r in records:
        if not r.get("shift_status"):
            if r.get("status") == AttendanceStatus.HALF_DAY:
                r["shift_status"] = "HALF-DAY"
            elif r.get("status") == AttendanceStatus.LATE:
                r["shift_status"] = "LATE"
            elif r.get("status") == AttendanceStatus.PRESENT or r.get("check_in"):
                r["shift_status"] = "ON-TIME"
            else:
                r["shift_status"] = "—"
    return records

@attendance_router.get("/my-history")
async def get_my_attendance(auth_ctx: Dict[str, Any] = Depends(require_tenant_context)):
    emp_id = auth_ctx.get("emp_id")
    org_id = auth_ctx.get("org_id")
    
    if not emp_id:
        user = await store.find_one("users", {"id": auth_ctx["sub"]})
        emp_id = user.get("employee_id") if user else None

    if not emp_id:
        emp = await store.find_one("employees", {"email": auth_ctx["email"], "organization_id": org_id})
        if emp:
            emp_id = emp["id"]

    if not emp_id:
        return []

    emp = await store.find_one("employees", {"id": emp_id, "organization_id": org_id})
    raw_records = await store.find_many("attendance", {
        "organization_id": org_id,
        "employee_id": emp_id
    }, sort_key="date", sort_desc=True, limit=60)
    if emp:
        fn = emp.get("first_name", "")
        ln = emp.get("last_name", "")
        emp_name = f"{fn} {ln}".strip()
        for r in raw_records:
            r["employee_name"] = emp_name
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))
    return raw_records

# ----------------- REPORTS ROUTER (CSV/EXCEL) -----------------

@reports_router.get("/export-csv")
async def export_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    if department:
        query["department"] = department

    raw_records = await store.find_many("attendance", query, sort_key="date", sort_desc=True)
    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}
    records = []
    for r in raw_records:
        if r.get("employee_id") in emp_map:
            emp = emp_map[r["employee_id"]]
            r["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))
            records.append(r)
    
    rows = []
    for r in records:
        rows.append({
            "Date": r.get("date"),
            "Employee Code": r.get("employee_code"),
            "Employee Name": r.get("employee_name"),
            "Department": r.get("department"),
            "Check In": str(r.get("check_in", ""))[:19] if r.get("check_in") else "N/A",
            "Check Out": str(r.get("check_out", ""))[:19] if r.get("check_out") else "N/A",
            "Hours Worked": r.get("total_hours", 0.0),
            "Status": r.get("status", "PRESENT"),
            "Verification": r.get("verification_mode", "FACE_KIOSK")
        })

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=argus_attendance_report.csv"
    return response

@reports_router.get("/export-excel")
async def export_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    if department:
        query["department"] = department

    raw_records = await store.find_many("attendance", query, sort_key="date", sort_desc=True)
    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    emp_map = {e["id"]: e for e in all_emps}
    records = []
    for r in raw_records:
        if r.get("employee_id") in emp_map:
            emp = emp_map[r["employee_id"]]
            r["employee_name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            r["employee_code"] = emp.get("employee_code", r.get("employee_code"))
            r["department"] = emp.get("department", r.get("department"))
            records.append(r)
    
    rows = []
    for r in records:
        rows.append({
            "Date": r.get("date"),
            "Employee Code": r.get("employee_code"),
            "Employee Name": r.get("employee_name"),
            "Department": r.get("department"),
            "Check In": str(r.get("check_in", ""))[:19] if r.get("check_in") else "N/A",
            "Check Out": str(r.get("check_out", ""))[:19] if r.get("check_out") else "N/A",
            "Hours Worked": r.get("total_hours", 0.0),
            "Status": r.get("status", "PRESENT"),
            "Verification": r.get("verification_mode", "FACE_KIOSK")
        })

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Attendance')
    output.seek(0)

    response = StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response.headers["Content-Disposition"] = "attachment; filename=argus_attendance_report.xlsx"
    return response

@reports_router.get("/export-payroll-csv")
async def export_payroll_csv(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    from app.api.v1.payroll import compute_single_employee_payroll
    org_id = auth_ctx["org_id"]
    if not cycle:
        now = datetime.now(IST_TZ)
        cycle = f"{now.year:04d}-{now.month:02d}"

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    rows = []
    for emp in employees:
        comp = await compute_single_employee_payroll(org_id, emp, cycle)
        rows.append({
            "Employee Code": comp["employee_code"],
            "Employee Name": comp["employee_name"],
            "Department": comp["department"],
            "Designation": comp["designation"],
            "Employment Type": comp["employment_type"],
            "Cycle": comp.get("cycle_display") or cycle,
            "Working Days": comp["working_days"],
            "Days Present": comp["days_present"],
            "Half Days": comp["half_days"],
            "Leave Days": comp["leave_days"],
            "Logged Hours": comp["total_logged_hours"],
            "Overtime Hours": comp["overtime_hours"],
            "Basic Salary": comp["basic_salary"],
            "Allowance": comp["allowance"],
            "Incentive": comp["incentive"],
            "Others Earnings": comp["others_earnings"],
            "Total Earnings": comp["total_earnings"],
            "Paid Salary (PF/Taxes)": comp["paid_salary"],
            "Advance Repayment": comp["advance_repayment"],
            "Other Deductions": comp["other_deductions"],
            "Total Deductions": comp["total_deductions"],
            "Net Pay (INR)": comp["net_pay"],
            "Net Pay In Words": comp["net_pay_words"],
            "Payout Status": comp["payout_status"]
        })

    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=argus_payroll_{cycle}.csv"
    return response

@reports_router.get("/export-payroll-excel")
async def export_payroll_excel(
    cycle: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    from app.api.v1.payroll import compute_single_employee_payroll
    org_id = auth_ctx["org_id"]
    if not cycle:
        now = datetime.now(IST_TZ)
        cycle = f"{now.year:04d}-{now.month:02d}"

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    register_rows = []
    bank_rows = []

    for emp in employees:
        comp = await compute_single_employee_payroll(org_id, emp, cycle)
        b = comp.get("banking", {})
        register_rows.append({
            "Employee Code": comp["employee_code"],
            "Employee Name": comp["employee_name"],
            "Department": comp["department"],
            "Designation": comp["designation"],
            "Employment Type": comp["employment_type"],
            "Cycle": comp.get("cycle_display") or cycle,
            "Working Days": comp["working_days"],
            "Days Present": comp["days_present"],
            "Half Days": comp["half_days"],
            "Leave Days": comp["leave_days"],
            "Logged Hours": comp["total_logged_hours"],
            "Overtime Hours": comp["overtime_hours"],
            "Basic Salary": comp["basic_salary"],
            "Allowance": comp["allowance"],
            "Incentive": comp["incentive"],
            "Others Earnings": comp["others_earnings"],
            "Total Earnings": comp["total_earnings"],
            "Paid Salary (PF/Taxes)": comp["paid_salary"],
            "Advance Repayment": comp["advance_repayment"],
            "Other Deductions": comp["other_deductions"],
            "Total Deductions": comp["total_deductions"],
            "Net Pay (INR)": comp["net_pay"],
            "Net Pay In Words": comp["net_pay_words"],
            "Payout Status": comp["payout_status"]
        })
        bank_rows.append({
            "Employee Code": comp["employee_code"],
            "Employee Name": comp["employee_name"],
            "Account Holder Name": b.get("account_holder_name") or comp["employee_name"],
            "Bank Name": b.get("bank_name") or "—",
            "Account Number": b.get("account_number") or "—",
            "IFSC Code": b.get("ifsc_code") or "—",
            "UPI Number": b.get("upi_number") or "—",
            "Net Payable (INR)": comp["net_pay"],
            "Cycle": comp.get("cycle_display") or cycle,
            "Payout Status": comp["payout_status"]
        })

    df_reg = pd.DataFrame(register_rows)
    df_bank = pd.DataFrame(bank_rows)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df_reg.to_excel(writer, index=False, sheet_name='Payroll Register')
        df_bank.to_excel(writer, index=False, sheet_name='Bank NEFT Advice')
    output.seek(0)

    response = StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response.headers["Content-Disposition"] = f"attachment; filename=argus_payroll_{cycle}.xlsx"
    return response

