from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, Dict, Any
import io
import pandas as pd
from app.core.security import require_org_admin
from app.db.store import store

router = APIRouter(prefix="/reports", tags=["Export Reports"])

@router.get("/export-csv")
async def export_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    if start_date and end_date:
        query["date"] = {"": start_date, "": end_date}
    elif start_date:
        query["date"] = {"": start_date}
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

@router.get("/export-excel")
async def export_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    department: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    org_id = auth_ctx["org_id"]
    query = {"organization_id": org_id}
    if start_date and end_date:
        query["date"] = {"": start_date, "": end_date}
    elif start_date:
        query["date"] = {"": start_date}
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