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

class GeofenceConfig(BaseModel):
    is_enabled: bool = False
    latitude: float = 13.0827
    longitude: float = 80.2707
    radius_meters: int = 150
    strict_enforcement: bool = False
    office_name: str = "Headquarters"

class OrganizationCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    gstin: Optional[str] = None
    contact_email: EmailStr
    admin_name: str
    admin_password: Optional[str] = None
    work_hours: Optional[WorkHoursConfig] = Field(default_factory=WorkHoursConfig)
    geofence: Optional[GeofenceConfig] = Field(default_factory=GeofenceConfig)

class Organization(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    name: str
    slug: str
    gstin: Optional[str] = None
    contact_email: EmailStr
    logo_url: Optional[str] = None
    work_hours: WorkHoursConfig = Field(default_factory=WorkHoursConfig)
    geofence: Optional[GeofenceConfig] = Field(default_factory=GeofenceConfig)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GoogleLoginRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    google_token: Optional[str] = None

class GoogleRegisterOrgRequest(BaseModel):
    org_name: str
    gstin: Optional[str] = None
    email: EmailStr
    name: Optional[str] = None
    google_token: Optional[str] = None

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
    permissions: Optional[List[str]] = None

class User(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    name: str
    email: EmailStr
    hashed_password: str
    role: str
    employee_id: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- EMPLOYEES -----------------
class EmploymentType:
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    DAILY_WAGE = "DAILY_WAGE"
    FIELD_WORKER = "FIELD_WORKER"

class ShiftType:
    FIXED = "FIXED"
    FLEXIBLE = "FLEXIBLE"

class EmployeeCreate(BaseModel):
    employee_code: Optional[str] = None
    first_name: str
    last_name: Optional[str] = ""
    email: Optional[str] = None
    department: Optional[str] = "Operations"
    designation: Optional[str] = "Production"
    phone: Optional[str] = None
    hourly_rate: Optional[float] = 250.0
    daily_wage_rate: Optional[float] = 600.0
    half_day_salary: Optional[float] = None
    aadhar_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    joining_date: Optional[str] = None
    account_holder_name: Optional[str] = None
    upi_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    shift_hours: Optional[str] = "08:00"
    employment_type: Optional[str] = EmploymentType.FULL_TIME
    shift_type: Optional[str] = ShiftType.FIXED
    target_daily_hours: Optional[float] = 8.5
    assigned_shift: Optional[str] = "General Shift (09:00 AM – 05:30 PM • 8.5h)"
    shift_start: Optional[str] = "09:00"
    shift_end: Optional[str] = "17:30"
    base_salary: Optional[float] = 40000.0
    statutory_deductions: Optional[float] = 3000.0
    permissions: Optional[List[str]] = None

class Employee(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    employee_code: str
    first_name: str
    last_name: Optional[str] = ""
    email: Optional[str] = None
    department: Optional[str] = "Operations"
    designation: Optional[str] = "Production"
    phone: Optional[str] = None
    hourly_rate: Optional[float] = 250.0
    daily_wage_rate: Optional[float] = 600.0
    half_day_salary: Optional[float] = None
    aadhar_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    joining_date: Optional[str] = None
    account_holder_name: Optional[str] = None
    upi_number: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    shift_hours: Optional[str] = "08:00"
    employment_type: Optional[str] = EmploymentType.FULL_TIME
    shift_type: Optional[str] = ShiftType.FIXED
    target_daily_hours: Optional[float] = 8.5
    assigned_shift: Optional[str] = "General Shift (09:00 AM – 05:30 PM • 8.5h)"
    shift_start: Optional[str] = "09:00"
    shift_end: Optional[str] = "17:30"
    base_salary: Optional[float] = 40000.0
    statutory_deductions: Optional[float] = 3000.0
    permissions: Optional[List[str]] = None
    consent_given: bool = False
    consent_timestamp: Optional[datetime] = None
    consent_ip: Optional[str] = None
    face_embeddings: List[List[float]] = []  # List of normalized vector embeddings (no raw photos)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- CLIENT SITES (FOR FIELD WORKERS) -----------------
class ClientSiteCreate(BaseModel):
    site_name: str
    client_name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: Optional[int] = 150
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None

class ClientSite(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    site_name: str
    client_name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: int = 150
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
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
    is_currently_in: bool = False
    punch_count: int = 1
    punches: List[Dict[str, Any]] = []
    last_punch_time: Optional[str] = None
    last_punch_action: Optional[str] = None
    status: str = AttendanceStatus.PRESENT
    shift_status: Optional[str] = "ON-TIME"
    verification_mode: str = "FACE_KIOSK"
    confidence_score: float = 0.0
    liveness_verified: bool = True
    kiosk_id: Optional[str] = None
    client_site_id: Optional[str] = None
    client_site_name: Optional[str] = None
    site_visit_verified: Optional[bool] = None
    notes: Optional[str] = None
    break_status: Optional[str] = "WORKING"
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

# ----------------- FINANCIAL ENTRIES (MANUAL ADJUSTMENTS) -----------------
class FinancialEntryCreate(BaseModel):
    employee_id: str
    type: str  # BONUS | DEDUCTION | REIMBURSEMENT
    amount: float
    cycle: str  # "YYYY-MM"
    reason: Optional[str] = ""

class FinancialEntry(BaseModel):
    id: str = Field(default_factory=generate_uuid)
    organization_id: str
    employee_id: str
    type: str  # BONUS | DEDUCTION | REIMBURSEMENT
    amount: float
    cycle: str  # "YYYY-MM"
    reason: str = ""
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# ----------------- PAYROLL COMPUTATION -----------------
class PayrollComputeResult(BaseModel):
    employee_id: str
    employee_name: str
    employee_code: str
    department: str
    designation: str = "Staff"
    phone: Optional[str] = None
    employment_type: str
    cycle: str
    # Attendance summary
    total_days_of_month: int = 30
    total_working_days: int = 26
    days_present: int = 0
    half_days: int = 0
    paid_leaves: int = 0
    leave_days: int = 0
    lop_days: float = 0
    total_logged_hours: float = 0.0
    overtime_hours: float = 0.0
    # Rate info
    hours_salary: float = 0.0
    day_salary: float = 0.0
    half_day_salary: float = 0.0
    # Earnings
    basic_salary: float = 0.0
    allowance: float = 0.0  # Reimbursements
    incentive: float = 0.0  # Bonuses
    others_earnings: float = 0.0  # Overtime + misc
    total_earnings: float = 0.0
    # Deductions
    paid_salary: float = 0.0  # Statutory deductions
    advance_repayment: float = 0.0
    other_deductions: float = 0.0  # Manual deductions
    total_deductions: float = 0.0
    # Final Net
    net_pay: float = 0.0
    net_pay_words: str = ""
    calculation_basis: str = ""
    payout_status: str = "PENDING"

