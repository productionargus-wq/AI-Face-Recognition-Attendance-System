from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime
import io
import pandas as pd
from app.models.schemas import Attendance, AttendanceStatus
from app.core.security import require_tenant_context, require_org_admin
from app.db.store import store
from app.services.face_service import decode_base64_image, extract_face_embedding, find_best_match
from app.services.liveness_service import liveness_service
from app.core.config import settings
from pydantic import BaseModel

reports_router = APIRouter(prefix="/reports", tags=["Export Reports"])
attendance_router = APIRouter(prefix="/attendance", tags=["Attendance Capture & Logs"])

# ----------------- ATTENDANCE ENDPOINTS -----------------

class KioskPunchPayload(BaseModel):
    organization_slug_or_id: str
    image_sample: str
    punch_type: str = "AUTO"
    liveness_challenge_response: Optional[str] = "VERIFIED"
    kiosk_id: Optional[str] = "default-kiosk"

@attendance_router.get("/liveness-challenge")
def get_liveness_challenge():
    return liveness_service.generate_random_challenge()

@attendance_router.post("/kiosk-punch")
async def kiosk_punch(payload: KioskPunchPayload):
    org = await store.find_one("organizations", {"id": payload.organization_slug_or_id})
    if not org:
        org = await store.find_one("organizations", {"slug": payload.organization_slug_or_id})
    if not org:
        raise HTTPException(
            status_code=404,
            detail=f"Organization '{payload.organization_slug_or_id}' not found."
        )

    org_id = org["id"]

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
            detail="No face clearly detected. Please center your face inside the circle."
        )

    employees = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    if not employees:
        raise HTTPException(
            status_code=404, 
            detail="No registered employees found in this organization."
        )

    matched_emp, confidence = find_best_match(
        live_vector=live_vector,
        tenant_employees=employees,
        threshold=settings.SIMILARITY_THRESHOLD
    )

    if not matched_emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Face not recognized in {org.get('name')}. Please make sure you are enrolled."
        )

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    now_dt = datetime.utcnow()
    
    existing_record = await store.find_one("attendance", {
        "organization_id": org_id,
        "employee_id": matched_emp["id"],
        "date": today_str
    })

    punch_action = "CHECK_IN"
    record_status = AttendanceStatus.PRESENT

    work_start = org.get("work_hours", {}).get("start_time", "09:00")
    grace = org.get("work_hours", {}).get("late_grace_minutes", 15)
    
    start_h, start_m = map(int, work_start.split(":"))
    cur_h, cur_m = now_dt.hour, now_dt.minute
    total_start_mins = start_h * 60 + start_m + grace
    total_cur_mins = cur_h * 60 + cur_m

    if total_cur_mins > total_start_mins:
        record_status = AttendanceStatus.LATE

    if not existing_record:
        punch_action = "CHECK_IN"
        new_att = Attendance(
            organization_id=org_id,
            employee_id=matched_emp["id"],
            employee_code=matched_emp["employee_code"],
            employee_name=f"{matched_emp['first_name']} {matched_emp['last_name']}",
            department=matched_emp.get("department", "General"),
            date=today_str,
            check_in=now_dt,
            status=record_status,
            verification_mode="FACE_KIOSK",
            confidence_score=confidence,
            liveness_verified=True,
            kiosk_id=payload.kiosk_id
        ).dict()
        await store.insert_one("attendance", new_att)
        res_record = new_att
    else:
        punch_action = "CHECK_OUT"
        check_in_time = existing_record.get("check_in")
        if isinstance(check_in_time, str):
            try:
                check_in_time = datetime.fromisoformat(check_in_time.replace("Z", "+00:00"))
            except Exception:
                check_in_time = now_dt
        elif not isinstance(check_in_time, datetime):
            check_in_time = now_dt

        duration_sec = (now_dt - check_in_time).total_seconds()
        total_hours = round(max(0.1, duration_sec / 3600.0), 2)
        
        await store.update_one("attendance", {"id": existing_record["id"]}, {
            "check_out": now_dt.isoformat(),
            "total_hours": total_hours,
            "confidence_score": max(confidence, existing_record.get("confidence_score", 0))
        })
        existing_record["check_out"] = now_dt
        existing_record["total_hours"] = total_hours
        res_record = existing_record

    return {
        "status": "success",
        "action": punch_action,
        "employee_name": f"{matched_emp['first_name']} {matched_emp['last_name']}",
        "employee_code": matched_emp["employee_code"],
        "department": matched_emp.get("department", "General"),
        "timestamp": now_dt.strftime("%I:%M:%S %p"),
        "date": today_str,
        "attendance_status": res_record.get("status", "PRESENT"),
        "confidence": round(confidence * 100, 1),
        "total_hours": res_record.get("total_hours", 0.0)
    }

@attendance_router.get("/today")
async def get_today_attendance(auth_ctx: Dict[str, Any] = Depends(require_org_admin)):
    org_id = auth_ctx["org_id"]
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    records = await store.find_many("attendance", {
        "organization_id": org_id,
        "date": today_str
    }, sort_key="check_in", sort_desc=True)

    all_emps = await store.find_many("employees", {"organization_id": org_id, "is_active": True})
    total_emps_count = len(all_emps)
    
    present_count = len([r for r in records if r.get("status") in [AttendanceStatus.PRESENT, AttendanceStatus.LATE]])
    late_count = len([r for r in records if r.get("status") == AttendanceStatus.LATE])
    absent_count = max(0, total_emps_count - present_count)

    return {
        "date": today_str,
        "summary": {
            "total_employees": total_emps_count,
            "present": present_count,
            "late": late_count,
            "absent": absent_count,
            "on_time_rate": round(((present_count - late_count) / max(1, present_count)) * 100, 1) if present_count > 0 else 0
        },
        "records": records
    }

@attendance_router.get("/history")
async def get_attendance_history(
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

    records = await store.find_many("attendance", query, sort_key="date", sort_desc=True, limit=500)
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

    records = await store.find_many("attendance", {
        "organization_id": org_id,
        "employee_id": emp_id
    }, sort_key="date", sort_desc=True, limit=60)
    return records

# ----------------- REPORTS ENDPOINTS -----------------

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

    records = await store.find_many("attendance", query, sort_key="date", sort_desc=True)
    
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

    records = await store.find_many("attendance", query, sort_key="date", sort_desc=True)
    
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
