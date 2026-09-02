from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

def generate_uuid() -> str:
    return str(uuid.uuid4())

# ----------------- ORGANIZATIONS -----------------
class WorkHoursConfig(BaseModel):
    start_time: str = "09:00"      # HH:MM
    end_time: str = "18:00"        # HH:MM
    late_grace_minutes: int = 15   # 15 mins after start is marked LATE
    half_day_hours: float = 4.5

class OrganizationCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    contact_email: EmailStr
    admin_name: str
    admin_password: str
    work_hours: Optional[WorkHoursConfig] = Field(default_factory=WorkHoursConfig)

class Organization(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    slug: str
    contact_email: EmailStr
    logo_url: Optional[str] = None
    work_hours: WorkHoursConfig = Field(default_factory=WorkHoursConfig)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- USERS -----------------
class UserRole:
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    EMPLOYEE = "employee"

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = UserRole.EMPLOYEE
    organization_id: str
    employee_id: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    name: str
    email: EmailStr
    hashed_password: str
    role: str
    employee_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- EMPLOYEES -----------------
class EmployeeCreate(BaseModel):
    employee_code: str
    first_name: str
    last_name: str
    email: EmailStr
    department: str
    designation: str
    phone: Optional[str] = None

class Employee(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    employee_code: str
    first_name: str
    last_name: str
    email: EmailStr
    department: str
    designation: str
    phone: Optional[str] = None
    consent_given: bool = False
    consent_timestamp: Optional[datetime] = None
    consent_ip: Optional[str] = None
    face_embeddings: List[List[float]] = []  # List of normalized vector embeddings (no raw photos)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- ATTENDANCE -----------------
class AttendanceStatus:
    PRESENT = "PRESENT"
    LATE = "LATE"
    HALF_DAY = "HALF_DAY"
    ABSENT = "ABSENT"

class Attendance(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    employee_id: str
    employee_code: str
    employee_name: str
    department: str
    date: str                        # YYYY-MM-DD
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    total_hours: float = 0.0
    status: str = AttendanceStatus.PRESENT
    verification_mode: str = "FACE_KIOSK"
    confidence_score: float = 0.0
    liveness_verified: bool = True
    kiosk_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- KIOSK TERMINALS -----------------
class KioskTerminal(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    name: str
    location: str
    kiosk_key: str
    is_active: bool = True
    last_ping: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- AUDIT LOGS -----------------
class AuditLog(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    actor_id: str
    actor_name: str
    actor_role: str
    action: str
    target_resource: str
    target_id: Optional[str] = None
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
