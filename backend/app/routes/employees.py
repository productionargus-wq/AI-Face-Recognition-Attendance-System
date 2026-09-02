from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.schemas import Employee, EmployeeCreate, User, UserRole, AuditLog
from app.core.security import require_org_admin, require_tenant_context, get_password_hash
from app.db.store import store
from app.services.face_service import decode_base64_image, extract_face_embedding, compute_average_embedding

router = APIRouter(prefix="/employees", tags=["Employee Management & Biometric Enrollment"])

class FaceEnrollmentPayload(BaseModel):
    samples: List[str]  # 3 to 5 base64 images captured via webcam
    consent_given: bool
    client_ip: Optional[str] = "127.0.0.1"

@router.get("/")
async def list_employees(
    department: Optional[str] = None,
    search: Optional[str] = None,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """List all employees belonging strictly to the caller's organization."""
    org_id = auth_ctx["org_id"]
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
        c["has_biometric"] = len(c.get("face_embeddings", [])) > 0
        c["samples_count"] = len(c.get("face_embeddings", []))
        c["face_embeddings"] = None  # Don't send raw vectors in list
        cleaned.append(c)
    return cleaned

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    auth_ctx: Dict[str, Any] = Depends(require_org_admin)
):
    """Add new employee to the organization."""
    org_id = auth_ctx["org_id"]

    # Check unique employee_code within organization
    existing = await store.find_one("employees", {
        "organization_id": org_id, 
        "employee_code": payload.employee_code
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee code '{payload.employee_code}' already exists in your organization."
        )

    emp_dict = Employee(
        organization_id=org_id,
        employee_code=payload.employee_code,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        department=payload.department,
        designation=payload.designation,
        phone=payload.phone
    ).dict()
    await store.insert_one("employees", emp_dict)

    # Automatically create an employee user portal login
    existing_user = await store.find_one("users", {"email": payload.email})
    if not existing_user:
        user_dict = User(
            organization_id=org_id,
            name=f"{payload.first_name} {payload.last_name}",
            email=payload.email,
            hashed_password=get_password_hash("Argus@123"), # Default temp password
            role=UserRole.EMPLOYEE,
            employee_id=emp_dict["id"]
        ).dict()
        await store.insert_one("users", user_dict)

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
    """Soft deletes or deactivates an employee."""
    org_id = auth_ctx["org_id"]
    res = await store.update_one("employees", {"id": employee_id, "organization_id": org_id}, {"is_active": False})
    if not res:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"status": "success", "message": "Employee removed successfully."}
