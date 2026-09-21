from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from app.models.schemas import Employee, EmployeeCreate, User, UserRole, AuditLog

IST_TZ = timezone(timedelta(hours=5, minutes=30))
from app.core.security import require_org_admin, require_tenant_context, get_password_hash
from app.db.store import store
from app.services.face_service import decode_base64_image, extract_face_embedding, compute_average_embedding

router = APIRouter(prefix="/employees", tags=["Employee Management & Biometric Enrollment"])

class FaceEnrollmentPayload(BaseModel):
    samples: List[str]  # 3 to 5 base64 images captured via webcam
    consent_given: bool
    client_ip: Optional[str] = "127.0.0.1"

class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    employment_type: Optional[str] = None
    shift_type: Optional[str] = None
    target_daily_hours: Optional[float] = None
    daily_wage_rate: Optional[float] = None
    half_day_salary: Optional[float] = None
    aadhar_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    joining_date: Optional[str] = None
    account_holder_name: Optional[str] = None
    upi_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    shift_hours: Optional[str] = None
    assigned_shift: Optional[str] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    base_salary: Optional[float] = None
    hourly_rate: Optional[float] = None
    statutory_deductions: Optional[float] = None
    permissions: Optional[List[str]] = None

@router.get("/me")
async def get_my_employee_profile(
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    """Returns the authenticated user's own employee record (including compensation structure)."""
    org_id = auth_ctx["org_id"]
    email = auth_ctx.get("email")
    emp_id = auth_ctx.get("emp_id")

    emp = None
    if emp_id:
        emp = await store.find_one("employees", {"id": emp_id, "organization_id": org_id, "is_active": True})
    if not emp and email:
        emp = await store.find_one("employees", {"email": email, "organization_id": org_id, "is_active": True})
    if not emp:
        user = await store.find_one("users", {"email": email, "organization_id": org_id})
        if user and user.get("employee_id"):
            emp = await store.find_one("employees", {"id": user["employee_id"], "organization_id": org_id})

    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    c = dict(emp)
    face_embs = c.get("face_embeddings") or []
    c["has_biometric"] = len(face_embs) > 0
    c["samples_count"] = len(face_embs)
    c["face_embeddings"] = None
    return c

@router.get("")
@router.get("/")
async def list_employees(
    department: Optional[str] = None,
    search: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_tenant_context)
):
    """List all employees belonging to the caller's organization (or caller's own record if staff)."""
    org_id = auth_ctx["org_id"]
    is_admin = auth_ctx.get("role") in ("org_admin", "super_admin")

    if not is_admin:
        # Non-admin employee: return strictly their own employee profile
        email = auth_ctx.get("email")
        emp_id = auth_ctx.get("emp_id")
        emp = None
        if emp_id:
            emp = await store.find_one("employees", {"id": emp_id, "organization_id": org_id, "is_active": True})
        if not emp and email:
            emp = await store.find_one("employees", {"email": email, "organization_id": org_id, "is_active": True})
        if not emp:
            user = await store.find_one("users", {"email": email, "organization_id": org_id})
            if user and user.get("employee_id"):
                emp = await store.find_one("employees", {"id": user["employee_id"], "organization_id": org_id})
        if emp:
            c = dict(emp)
            face_embs = c.get("face_embeddings") or []
            c["has_biometric"] = len(face_embs) > 0
            c["samples_count"] = len(face_embs)
            c["face_embeddings"] = None
            return [c]
        return []

    query = {"organization_id": org_id, "is_active": True}
    if department:
        query["department"] = department

    employees = await store.find_many("employees", query, sort_key="first_name")
    
    # Filter search if provided
    if search:
        s = search.lower()
        employees = [
            e for e in employees 
            if s in e.get("first_name", "").lower() 
            or s in e.get("last_name", "").lower() 
            or s in e.get("employee_code", "").lower() 
            or s in e.get("department", "").lower()
        ]

    # Mask embedding vectors in list response for payload efficiency
    cleaned = []
    for emp in employees:
        c = dict(emp)
        face_embs = c.get("face_embeddings") or []
        c["has_biometric"] = len(face_embs) > 0
        c["samples_count"] = len(face_embs)
        c["face_embeddings"] = None  # Don't send raw vectors in list
        cleaned.append(c)
    return cleaned

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Add new employee to the organization."""
    org_id = auth_ctx["org_id"]

    # Auto-generate employee code if missing
    emp_code = (payload.employee_code or "").strip()
    if not emp_code:
        count = await store.count("employees", {"organization_id": org_id})
        emp_code = f"ARG-{count + 101}"

    # Split name if full name provided in first_name and last_name is empty
    first_name = (payload.first_name or "").strip()
    last_name = (payload.last_name or "").strip()
    if " " in first_name and not last_name:
        parts = first_name.split(" ", 1)
        first_name = parts[0].strip()
        last_name = parts[1].strip()

    # Check unique employee_code within organization
    existing = await store.find_one("employees", {
        "organization_id": org_id, 
        "employee_code": emp_code
    })
    if existing:
        if existing.get("is_active") is False:
            # Stale soft-deleted employee: purge completely to allow clean re-enrollment
            await store.delete_many("employees", {"id": existing["id"], "organization_id": org_id})
            await store.delete_many("users", {"employee_id": existing["id"], "organization_id": org_id})
            if existing.get("email"):
                await store.delete_many("users", {"email": existing["email"], "organization_id": org_id})
            await store.delete_many("attendance", {"employee_id": existing["id"], "organization_id": org_id})
            if existing.get("employee_code"):
                await store.delete_many("kiosk_stream", {"employee_code": existing.get("employee_code"), "organization_id": org_id})
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee code '{emp_code}' already exists in your organization."
            )

    # Check unique email within organization
    target_email = payload.email.strip().lower() if payload.email and payload.email.strip() else None
    if target_email:
        existing_email_emp = await store.find_one("employees", {
            "organization_id": org_id,
            "email": target_email
        })
        if existing_email_emp:
            if existing_email_emp.get("is_active") is False:
                await store.delete_many("employees", {"id": existing_email_emp["id"], "organization_id": org_id})
                await store.delete_many("users", {"employee_id": existing_email_emp["id"], "organization_id": org_id})
                await store.delete_many("users", {"email": target_email, "organization_id": org_id})
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"An employee with email '{target_email}' already exists in your organization."
                )

    default_perms = payload.permissions if payload.permissions is not None else ["/admin", "/kiosk", "/leave-apply", "/advance-money", "/payroll"]

    daily_wage = payload.daily_wage_rate if payload.daily_wage_rate is not None else 600.0
    half_day_sal = payload.half_day_salary if payload.half_day_salary is not None else round(daily_wage / 2.0, 2)
    emp_designation = (payload.designation or "").strip() or payload.department or "Production"

    emp_dict = Employee(
        organization_id=org_id,
        employee_code=emp_code,
        first_name=first_name,
        last_name=last_name,
        email=target_email,
        department=payload.department or "Operations",
        designation=emp_designation,
        phone=payload.phone,
        hourly_rate=payload.hourly_rate if payload.hourly_rate is not None else 250.0,
        daily_wage_rate=daily_wage,
        half_day_salary=half_day_sal,
        aadhar_number=payload.aadhar_number,
        emergency_contact=payload.emergency_contact,
        joining_date=payload.joining_date,
        account_holder_name=payload.account_holder_name,
        upi_number=payload.upi_number,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        ifsc_code=payload.ifsc_code,
        shift_hours=payload.shift_hours or "08:00",
        employment_type=payload.employment_type or "FULL_TIME",
        shift_type=payload.shift_type or "FIXED",
        target_daily_hours=payload.target_daily_hours if payload.target_daily_hours is not None else (4.0 if payload.employment_type == "PART_TIME" else 8.5),
        assigned_shift=payload.assigned_shift or "General Shift (09:00 AM – 05:30 PM • 8.5h)",
        shift_start=payload.shift_start or "09:00",
        shift_end=payload.shift_end or "17:30",
        base_salary=payload.base_salary if payload.base_salary is not None else 40000.0,
        statutory_deductions=payload.statutory_deductions if payload.statutory_deductions is not None else 3000.0,
        permissions=default_perms
    ).dict()
    await store.insert_one("employees", emp_dict)

    # Automatically create an employee user portal login
    login_email = target_email or f"{emp_code.lower()}@argus.internal"
    existing_user = await store.find_one("users", {"email": login_email})
    if not existing_user:
        user_dict = User(
            organization_id=org_id,
            name=f"{first_name} {last_name}".strip(),
            email=login_email,
            hashed_password=get_password_hash("Argus@123"), # Default temp password
            role=UserRole.EMPLOYEE,
            employee_id=emp_dict["id"],
            permissions=default_perms
        ).dict()
        await store.insert_one("users", user_dict)
    else:
        await store.update_one("users", {"id": existing_user["id"]}, {
            "employee_id": emp_dict["id"],
            "permissions": default_perms
        })

    # Audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="CREATE_EMPLOYEE",
        target_resource="Employee",
        target_id=emp_dict["id"],
        details={"name": f"{payload.first_name} {payload.last_name}", "code": payload.employee_code}
    ).dict()
    await store.insert_one("audit_logs", audit)

    return emp_dict

@router.post("/{employee_id}/enroll-face")
async def enroll_face(
    employee_id: str,
    payload: FaceEnrollmentPayload,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """
    Biometric Face Vector Enrollment (Privacy-compliant).
    1. Validates explicit employee biometric consent.
    2. Ingests 3–5 camera sample frames in RAM.
    3. Extracts normalized 128-d face feature vectors.
    4. Stores ONLY mathematical vectors in database; immediately destroys raw frames.
    """
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found in your organization.")

    if not payload.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Biometric consent is mandatory before capturing facial recognition embeddings."
        )

    if len(payload.samples) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least 1-3 camera sample frames."
        )

    embeddings = []
    failed_samples = 0

    for idx, sample_b64 in enumerate(payload.samples):
        try:
            img = decode_base64_image(sample_b64)
            vec = extract_face_embedding(img)
            if vec is not None and len(vec) == 128:
                embeddings.append(vec)
            else:
                failed_samples += 1
        except Exception:
            failed_samples += 1

    if not embeddings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No clear faces detected in the provided samples. Ensure good lighting and look directly into the camera."
        )

    # Compute high-accuracy consensus vector
    consensus_vector = compute_average_embedding(embeddings)
    all_stored_embeddings = embeddings + [consensus_vector]

    update_payload = {
        "consent_given": True,
        "consent_timestamp": datetime.utcnow().isoformat(),
        "consent_ip": payload.client_ip,
        "face_embeddings": all_stored_embeddings
    }

    await store.update_one("employees", {"id": employee_id, "organization_id": org_id}, update_payload)

    # Audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="ENROLL_BIOMETRIC",
        target_resource="Employee",
        target_id=employee_id,
        details={
            "valid_samples_captured": len(embeddings),
            "consent_recorded": True,
            "vectors_stored": len(all_stored_embeddings)
        }
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {
        "status": "success",
        "message": f"Successfully enrolled face with {len(embeddings)} high-quality samples. Vectors stored safely.",
        "valid_samples": len(embeddings)
    }

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Completely and permanently removes an employee and all associated credentials/records from the database."""
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": employee_id, "organization_id": org_id})
    if not emp:
        # Check if already deleted or exists by id
        emp = await store.find_one("employees", {"id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

    emp_email = emp.get("email")
    emp_code = emp.get("employee_code")

    # 1. Completely delete employee document from DB
    await store.delete_many("employees", {"id": employee_id, "organization_id": org_id})
    await store.delete_many("employees", {"id": employee_id})

    # 2. Completely delete associated user account from DB
    if emp_email:
        await store.delete_many("users", {"email": emp_email})
    await store.delete_many("users", {"employee_id": employee_id})

    # 3. Completely delete attendance records, kiosk stream, advances, overrides, and leaves
    await store.delete_many("attendance", {"employee_id": employee_id})
    if emp_code:
        await store.delete_many("kiosk_stream", {"employee_code": emp_code})
    await store.delete_many("advances", {"employee_id": employee_id})
    await store.delete_many("manual_overrides", {"employee_id": employee_id})
    await store.delete_many("leaves", {"employee_id": employee_id})
    await store.delete_many("salary_payouts", {"employee_id": employee_id})
    await store.delete_many("financial_entries", {"employee_id": employee_id})

    # 4. Record audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="DELETE_EMPLOYEE",
        target_resource="Employee",
        target_id=employee_id,
        details={"email": emp_email, "code": emp_code, "name": f"{emp.get('first_name')} {emp.get('last_name')}"}
    ).dict()
    await store.insert_one("audit_logs", audit)

    return {"status": "success", "message": "Employee and all associated records permanently removed from database."}

@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Update employee details and synchronize associated user account."""
    org_id = auth_ctx["org_id"]
    emp = await store.find_one("employees", {"id": employee_id, "organization_id": org_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_fields = {}
    if payload.employee_code and payload.employee_code != emp.get("employee_code"):
        existing_code = await store.find_one("employees", {
            "organization_id": org_id,
            "employee_code": payload.employee_code,
            "id": {"$ne": employee_id}
        })
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Employee code '{payload.employee_code}' already belongs to another employee."
            )
        update_fields["employee_code"] = payload.employee_code

    if payload.first_name is not None:
        update_fields["first_name"] = payload.first_name.strip()
    if payload.last_name is not None:
        update_fields["last_name"] = payload.last_name.strip()
    if payload.email is not None:
        clean_email = str(payload.email).strip().lower()
        update_fields["email"] = clean_email if clean_email else None
    if payload.department is not None:
        update_fields["department"] = payload.department.strip()
    if payload.designation is not None:
        update_fields["designation"] = payload.designation.strip()
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.employment_type is not None:
        update_fields["employment_type"] = payload.employment_type.strip()
    if payload.shift_type is not None:
        update_fields["shift_type"] = payload.shift_type.strip()
    if payload.target_daily_hours is not None:
        update_fields["target_daily_hours"] = float(payload.target_daily_hours)
    if payload.daily_wage_rate is not None:
        update_fields["daily_wage_rate"] = float(payload.daily_wage_rate)
    if payload.half_day_salary is not None:
        update_fields["half_day_salary"] = float(payload.half_day_salary)
    if payload.aadhar_number is not None:
        update_fields["aadhar_number"] = payload.aadhar_number.strip()
    if payload.emergency_contact is not None:
        update_fields["emergency_contact"] = payload.emergency_contact.strip()
    if payload.joining_date is not None:
        update_fields["joining_date"] = payload.joining_date.strip()
    if payload.account_holder_name is not None:
        update_fields["account_holder_name"] = payload.account_holder_name.strip()
    if payload.upi_number is not None:
        update_fields["upi_number"] = payload.upi_number.strip()
    if payload.bank_name is not None:
        update_fields["bank_name"] = payload.bank_name.strip()
    if payload.account_number is not None:
        update_fields["account_number"] = payload.account_number.strip()
    if payload.ifsc_code is not None:
        update_fields["ifsc_code"] = payload.ifsc_code.strip()
    if payload.shift_hours is not None:
        update_fields["shift_hours"] = payload.shift_hours.strip()
    if payload.assigned_shift is not None:
        update_fields["assigned_shift"] = payload.assigned_shift.strip()
    if payload.shift_start is not None:
        update_fields["shift_start"] = payload.shift_start.strip()
    if payload.shift_end is not None:
        update_fields["shift_end"] = payload.shift_end.strip()
    if payload.base_salary is not None:
        update_fields["base_salary"] = float(payload.base_salary)
    if payload.hourly_rate is not None:
        update_fields["hourly_rate"] = float(payload.hourly_rate)
    if payload.statutory_deductions is not None:
        update_fields["statutory_deductions"] = float(payload.statutory_deductions)
    if payload.permissions is not None:
        update_fields["permissions"] = payload.permissions

    if not update_fields:
        return emp

    update_fields["updated_at"] = datetime.utcnow().isoformat()
    await store.update_one("employees", {"id": employee_id, "organization_id": org_id}, update_fields)

    # Compute new details for cascade
    fn = update_fields.get("first_name", emp.get("first_name", ""))
    ln = update_fields.get("last_name", emp.get("last_name", ""))
    new_full_name = f"{fn} {ln}".strip()
    new_code = update_fields.get("employee_code", emp.get("employee_code"))
    new_dept = update_fields.get("department", emp.get("department"))
    old_code = emp.get("employee_code")
    old_email = emp.get("email")
    new_email = update_fields.get("email", old_email)

    # 1. Sync name, email, and permissions in users collection
    user_updates = {}
    if "email" in update_fields:
        user_updates["email"] = new_email
    if "first_name" in update_fields or "last_name" in update_fields:
        user_updates["name"] = new_full_name
    if "permissions" in update_fields:
        user_updates["permissions"] = update_fields["permissions"]
    
    if user_updates:
        await store.update_many("users", {
            "organization_id": org_id,
            "$or": [{"employee_id": employee_id}, {"email": old_email}]
        }, user_updates)

    # 2. Cascade employee_name, employee_code, department across attendance collection
    att_updates = {}
    if "first_name" in update_fields or "last_name" in update_fields:
        att_updates["employee_name"] = new_full_name
    if "employee_code" in update_fields:
        att_updates["employee_code"] = new_code
    if "department" in update_fields:
        att_updates["department"] = new_dept
    if att_updates:
        await store.update_many("attendance", {
            "organization_id": org_id,
            "employee_id": employee_id
        }, att_updates)

    # 3. Cascade across attendance_events (kiosk live stream)
    evt_updates = {}
    if "first_name" in update_fields or "last_name" in update_fields:
        evt_updates["employee_name"] = new_full_name
        initials = ((fn[:1] if fn else "") + (ln[:1] if ln else "")).upper() or "EM"
        evt_updates["avatar"] = initials
    if "employee_code" in update_fields:
        evt_updates["employee_code"] = new_code
    if "department" in update_fields:
        evt_updates["department"] = new_dept
    if evt_updates:
        query_evt = {
            "organization_id": org_id,
            "$or": [{"employee_id": employee_id}, {"employee_code": old_code}]
        }
        await store.update_many("attendance_events", query_evt, evt_updates)

    # 4. Cascade across manual_overrides
    ovr_updates = {}
    if "first_name" in update_fields or "last_name" in update_fields:
        ovr_updates["employee_name"] = new_full_name
    if "employee_code" in update_fields:
        ovr_updates["employee_code"] = new_code
    if "department" in update_fields:
        ovr_updates["department"] = new_dept
    if ovr_updates:
        await store.update_many("manual_overrides", {
            "organization_id": org_id,
            "employee_id": employee_id
        }, ovr_updates)

    # 5. Cascade across advances
    adv_updates = {}
    if "first_name" in update_fields or "last_name" in update_fields:
        adv_updates["name"] = new_full_name
    if "employee_code" in update_fields:
        adv_updates["emp_code"] = new_code
    if "department" in update_fields:
        adv_updates["dept"] = new_dept
    if adv_updates:
        await store.update_many("advances", {
            "organization_id": org_id,
            "employee_id": employee_id
        }, adv_updates)

    # 6. Cascade across leaves
    lvr_updates = {}
    if "first_name" in update_fields or "last_name" in update_fields:
        lvr_updates["name"] = new_full_name
    if "employee_code" in update_fields:
        lvr_updates["emp_code"] = new_code
    if lvr_updates:
        await store.update_many("leaves", {
            "organization_id": org_id,
            "employee_id": employee_id
        }, lvr_updates)

    # Audit log
    audit = AuditLog(
        organization_id=org_id,
        actor_id=auth_ctx["sub"],
        actor_name=auth_ctx.get("name", "Admin"),
        actor_role=auth_ctx.get("role", "org_admin"),
        action="UPDATE_EMPLOYEE",
        target_resource="Employee",
        target_id=employee_id,
        details=update_fields
    ).dict()
    await store.insert_one("audit_logs", audit)

    updated_emp = await store.find_one("employees", {"id": employee_id, "organization_id": org_id})
    if updated_emp:
        face_embs = updated_emp.get("face_embeddings") or []
        updated_emp["has_biometric"] = len(face_embs) > 0
        updated_emp["face_embeddings"] = None
    return updated_emp

