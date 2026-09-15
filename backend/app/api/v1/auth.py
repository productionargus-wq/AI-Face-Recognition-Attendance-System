from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from app.models.schemas import (
    Organization, OrganizationCreate, User, UserCreate, UserRole, AuditLog,
    GoogleLoginRequest, GoogleRegisterOrgRequest
)
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user_payload
from app.db.store import store
import re
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication & Onboarding"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None

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
    """
    Login endpoint supporting:
    1. Org Admins (Email + Password)
    2. Registered Employees (Passwordless with Work Email)
    """
    # 1. If password is provided, attempt standard password verification
    if req.password:
        user = await store.find_one("users", {"email": req.email})
        if not user or not verify_password(req.password, user.get("hashed_password", "")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Please contact administrator."
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

    # 2. Passwordless Flow (For Registered Employees)
    # Check if this email is an active registered employee in any organization
    emp = await store.find_one("employees", {"email": req.email, "is_active": True})
    user = await store.find_one("users", {"email": req.email, "is_active": True})

    # If this is an admin account trying to log in without a password, prompt for password
    if user and user.get("role") in [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts require a password. Please switch to the Admin tab and enter your password."
        )

    if not emp and not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered employee found with this email. Please ensure you are enrolled by your organization."
        )

    org_id = emp["organization_id"] if emp else user.get("organization_id")
    org = await store.find_one("organizations", {"id": org_id}) if org_id else None

    # Guarantee an active employee user record exists
    if not user:
        user = User(
            organization_id=org_id,
            name=f"{emp['first_name']} {emp['last_name']}",
            email=req.email,
            hashed_password=get_password_hash("Argus@123"),
            role=UserRole.EMPLOYEE,
            employee_id=emp["id"]
        ).dict()
        await store.insert_one("users", user)

    token_data = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": UserRole.EMPLOYEE,
        "org_id": org_id,
        "emp_id": emp["id"] if emp else user.get("employee_id")
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

@router.post("/google-register-org", response_model=LoginResponse)
async def google_register_organization(payload: GoogleRegisterOrgRequest):
    """
    Onboard a new organization via Google OAuth.
    Captures Organisation Name, GSTIN number, and uses the verified Google email and name.
    Creates Tenant + Org Admin user.
    """
    org_name = payload.org_name.strip()
    gstin = payload.gstin.strip().upper()
    email = payload.email.strip().lower()
    admin_name = (payload.name or email.split("@")[0]).strip()

    if not org_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organisation name is required.")
    if not gstin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company GSTIN number is required.")

    # 1. Check if organization with this GSTIN already exists
    existing_gstin = await store.find_one("organizations", {"gstin": gstin})
    if existing_gstin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An organization with GSTIN '{gstin}' is already registered ({existing_gstin.get('name')})."
        )

    # 2. Check if this email is already registered as an active employee in another organization
    active_employee = await store.find_one("employees", {"email": email, "is_active": True})
    if active_employee:
        org_info = await store.find_one("organizations", {"id": active_employee.get("organization_id")})
        org_name_str = org_info.get("name", "another organization") if org_info else "another organization"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This Google account is already registered as an active employee under '{org_name_str}'. You cannot register a new organization with this email."
        )

    # 3. Check if an active user with this email already exists
    existing_user = await store.find_one("users", {"email": email, "is_active": True})
    if existing_user and existing_user.get("role") == UserRole.ORG_ADMIN:
        existing_org = await store.find_one("organizations", {"id": existing_user.get("organization_id")})
        token_data = {
            "sub": existing_user["id"],
            "email": existing_user["email"],
            "name": existing_user["name"],
            "role": UserRole.ORG_ADMIN,
            "org_id": existing_user.get("organization_id")
        }
        token = create_access_token(token_data)
        user_out = {k: v for k, v in existing_user.items() if k != "hashed_password"}
        return LoginResponse(access_token=token, user=user_out, organization=existing_org)

    # 4. Generate unique slug
    slug = re.sub(r'[^a-zA-Z0-9]', '-', org_name.lower()).strip('-')
    existing_slug = await store.find_one("organizations", {"slug": slug})
    if existing_slug:
        slug = f"{slug}-{int(datetime.utcnow().timestamp()) % 10000}"

    # 5. Create Organization
    org_dict = Organization(
        name=org_name,
        slug=slug,
        gstin=gstin,
        contact_email=email
    ).dict()
    await store.insert_one("organizations", org_dict)

    # 6. Create Org Admin User
    user_dict = User(
        organization_id=org_dict["id"],
        name=admin_name,
        email=email,
        hashed_password=get_password_hash("GoogleAuth@Argus2026"),
        role=UserRole.ORG_ADMIN
    ).dict()
    await store.insert_one("users", user_dict)

    # 7. Audit Log
    audit = AuditLog(
        organization_id=org_dict["id"],
        actor_id=user_dict["id"],
        actor_name=user_dict["name"],
        actor_role=UserRole.ORG_ADMIN,
        action="GOOGLE_REGISTER_ORGANIZATION",
        target_resource="Organization",
        target_id=org_dict["id"],
        details={"name": org_dict["name"], "gstin": gstin, "slug": slug}
    ).dict()
    await store.insert_one("audit_logs", audit)

    # 8. Issue Token
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

@router.post("/google-login", response_model=LoginResponse)
async def google_login(payload: GoogleLoginRequest):
    """
    Unified Google OAuth login for:
    1. Organization Admins / Managers
    2. Enrolled Employees (registered by their organization)
    If the email is not registered with any organization, raises HTTP 403 Access Denied.
    """
    email = payload.email.strip().lower()

    # 1. Check if user is an Org Admin
    admin_user = await store.find_one("users", {"email": email, "is_active": True, "role": UserRole.ORG_ADMIN})
    if admin_user:
        org = await store.find_one("organizations", {"id": admin_user["organization_id"]})
        token_data = {
            "sub": admin_user["id"],
            "email": admin_user["email"],
            "name": admin_user["name"],
            "role": UserRole.ORG_ADMIN,
            "org_id": admin_user.get("organization_id")
        }
        token = create_access_token(token_data)
        user_out = {k: v for k, v in admin_user.items() if k != "hashed_password"}
        return LoginResponse(access_token=token, user=user_out, organization=org)

    # 2. Check if user is an enrolled Employee in any organization
    emp = await store.find_one("employees", {"email": email, "is_active": True})
    if emp:
        org_id = emp["organization_id"]
        org = await store.find_one("organizations", {"id": org_id})
        
        # Check if a user record exists for this employee
        emp_user = await store.find_one("users", {"email": email, "is_active": True})
        if not emp_user:
            emp_user = User(
                organization_id=org_id,
                name=f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() or (payload.name or email.split("@")[0]),
                email=email,
                hashed_password=get_password_hash("GoogleAuth@Argus2026"),
                role=UserRole.EMPLOYEE,
                employee_id=emp["id"]
            ).dict()
            await store.insert_one("users", emp_user)

        token_data = {
            "sub": emp_user["id"],
            "email": emp_user["email"],
            "name": emp_user["name"],
            "role": UserRole.EMPLOYEE,
            "org_id": org_id,
            "emp_id": emp["id"]
        }
        token = create_access_token(token_data)
        user_out = {k: v for k, v in emp_user.items() if k != "hashed_password"}
        return LoginResponse(access_token=token, user=user_out, organization=org)

    # 3. Check if user is a Super Admin
    super_user = await store.find_one("users", {"email": email, "is_active": True, "role": UserRole.SUPER_ADMIN})
    if super_user:
        token_data = {
            "sub": super_user["id"],
            "email": super_user["email"],
            "name": super_user["name"],
            "role": UserRole.SUPER_ADMIN,
            "org_id": super_user.get("organization_id")
        }
        token = create_access_token(token_data)
        user_out = {k: v for k, v in super_user.items() if k != "hashed_password"}
        return LoginResponse(access_token=token, user=user_out, organization=None)

    # 4. If neither Org Admin nor Enrolled Employee, deny access
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access Denied: Your Google account ({email}) is not registered with any organisation. Please ask your administrator to enroll your email, or register a new organisation."
    )
