from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from app.models.schemas import Organization, OrganizationCreate, User, UserCreate, UserRole, AuditLog
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user_payload
from app.db.store import store
import re
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication & Onboarding"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    organization: Optional[Dict[str, Any]] = None

@router.post("/register-organization", response_model=LoginResponse)
async def register_organization(payload: OrganizationCreate):
    """
    1-Click Organization Self-Registration & Tenant Onboarding.
    Creates Tenant + Organization Admin account.
    """
    # 1. Generate slug
    slug = payload.slug or re.sub(r'[^a-zA-Z0-9]', '-', payload.name.lower()).strip('-')
    
    existing_org = await store.find_one("organizations", {"slug": slug})
    if existing_org:
        # Append unique suffix if conflict
        slug = f"{slug}-{int(datetime.utcnow().timestamp()) % 10000}"

    # Check if this email is currently registered as an active employee in any organization
    active_employee = await store.find_one("employees", {
        "email": payload.contact_email,
        "is_active": True
    })
    if active_employee:
        org_info = await store.find_one("organizations", {"id": active_employee.get("organization_id")})
        org_name = org_info.get("name", "another organization") if org_info else "another organization"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This email is registered as an active employee under '{org_name}'. You cannot create a new organization until your profile is removed by your employer."
        )

    existing_user = await store.find_one("users", {
        "email": payload.contact_email,
        "is_active": True
    })
    if existing_user:
        if existing_user.get("role") == UserRole.EMPLOYEE:
            org_info = await store.find_one("organizations", {"id": existing_user.get("organization_id")})
            org_name = org_info.get("name", "another organization") if org_info else "another organization"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"This email is registered as an active employee under '{org_name}'. You cannot create a new organization until your profile is removed by your employer."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active user with this contact email already exists."
        )

    # 2. Create Organization
    org_dict = Organization(
        name=payload.name,
        slug=slug,
        contact_email=payload.contact_email,
        work_hours=payload.work_hours
    ).dict()
    await store.insert_one("organizations", org_dict)

    # 3. Create Org Admin User
    user_dict = User(
        organization_id=org_dict["id"],
        name=payload.admin_name,
        email=payload.contact_email,
        hashed_password=get_password_hash(payload.admin_password),
        role=UserRole.ORG_ADMIN
    ).dict()
    await store.insert_one("users", user_dict)

    # 4. Create Audit Log
    audit = AuditLog(
        organization_id=org_dict["id"],
        actor_id=user_dict["id"],
        actor_name=user_dict["name"],
        actor_role=UserRole.ORG_ADMIN,
        action="REGISTER_ORGANIZATION",
        target_resource="Organization",
        target_id=org_dict["id"],
        details={"name": org_dict["name"], "slug": slug}
    ).dict()
    await store.insert_one("audit_logs", audit)

    # 5. Issue JWT
    token_data = {
        "sub": user_dict["id"],
        "email": user_dict["email"],
        "name": user_dict["name"],
        "role": user_dict["role"],
        "org_id": org_dict["id"]
    }
    token = create_access_token(token_data)

    user_out = {k: v for k, v in user_dict.items() if k != "hashed_password"}
    return LoginResponse(access_token=token, user=user_out, organization=org_dict)

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    """Login with Email & Password. Auto-detects Super Admin, Org Admin, or Employee."""
    user = await store.find_one("users", {"email": req.email})
    if not user or not verify_password(req.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact administrator."
        )

    org = None
    if user.get("organization_id"):
        org = await store.find_one("organizations", {"id": user["organization_id"]})

    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "org_id": user.get("organization_id"),
        "emp_id": user.get("employee_id")
    }
    token = create_access_token(token_data)
    user_out = {k: v for k, v in user.items() if k != "hashed_password"}
    return LoginResponse(access_token=token, user=user_out, organization=org)

@router.get("/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user_payload)):
    """Returns the authenticated user details and organization information."""
    user = await store.find_one("users", {"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    org = None
    if user.get("organization_id"):
        org = await store.find_one("organizations", {"id": user["organization_id"]})
    user_out = {k: v for k, v in user.items() if k != "hashed_password"}
    return {"user": user_out, "organization": org}
