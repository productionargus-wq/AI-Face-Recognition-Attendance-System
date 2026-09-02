import asyncio
from app.db.store import store
from app.core.security import get_password_hash
from app.models.schemas import Organization, User, Employee, Attendance, UserRole, AttendanceStatus
from datetime import datetime, timedelta

async def seed_demo_data():
    print("Seeding demo organizations and multi-tenant data...")

    # 1. Organization A: Argus Technologies
    org1 = await store.find_one("organizations", {"slug": "argus-tech"})
    if not org1:
        org1 = Organization(
            id="org-argus-101",
            name="Argus Technologies",
            slug="argus-tech",
            contact_email="admin@argustech.ai",
            work_hours={"start_time": "09:00", "end_time": "18:00", "late_grace_minutes": 15, "half_day_hours": 4.5}
        ).dict()
        await store.insert_one("organizations", org1)
        print("Created Org: Argus Technologies")

    # 2. Org A Admin
    admin1 = await store.find_one("users", {"email": "admin@argustech.ai"})
    if not admin1:
        admin1 = User(
            id="usr-admin-1",
            organization_id=org1["id"],
            name="Argus Admin",
            email="admin@argustech.ai",
            hashed_password=get_password_hash("ArgusAdmin@2026"),
            role=UserRole.ORG_ADMIN
        ).dict()
        await store.insert_one("users", admin1)
        print("Created Admin: admin@argustech.ai (Password: ArgusAdmin@2026)")

    # 3. Org A Sample Employees
    emp1 = await store.find_one("employees", {"organization_id": org1["id"], "employee_code": "ARG-001"})
    if not emp1:
        emp1 = Employee(
            id="emp-arg-1",
            organization_id=org1["id"],
            employee_code="ARG-001",
            first_name="Alex",
            last_name="Vance",
            email="alex.vance@argustech.ai",
            department="AI Research",
            designation="Senior Computer Vision Engineer",
            phone="+1-555-0199",
            consent_given=True,
            consent_timestamp=datetime.utcnow()
        ).dict()
        await store.insert_one("employees", emp1)

        emp_user1 = User(
            organization_id=org1["id"],
            name="Alex Vance",
            email="alex.vance@argustech.ai",
            hashed_password=get_password_hash("Argus@123"),
            role=UserRole.EMPLOYEE,
            employee_id=emp1["id"]
        ).dict()
        await store.insert_one("users", emp_user1)

    emp2 = await store.find_one("employees", {"organization_id": org1["id"], "employee_code": "ARG-002"})
    if not emp2:
        emp2 = Employee(
            id="emp-arg-2",
            organization_id=org1["id"],
            employee_code="ARG-002",
            first_name="Sarah",
            last_name="Connor",
            email="sarah.connor@argustech.ai",
            department="Operations",
            designation="HR Manager",
            phone="+1-555-0188",
            consent_given=True,
            consent_timestamp=datetime.utcnow()
        ).dict()
        await store.insert_one("employees", emp2)

    # 4. Organization B: Acme Corporation (Second Tenant for Isolation Testing)
    org2 = await store.find_one("organizations", {"slug": "acme-corp"})
    if not org2:
        org2 = Organization(
            id="org-acme-202",
            name="Acme Global Corporation",
            slug="acme-corp",
            contact_email="admin@acmecorp.com",
            work_hours={"start_time": "08:30", "end_time": "17:30", "late_grace_minutes": 10, "half_day_hours": 4.0}
        ).dict()
        await store.insert_one("organizations", org2)
        print("Created Org: Acme Global Corporation")

    admin2 = await store.find_one("users", {"email": "admin@acmecorp.com"})
    if not admin2:
        admin2 = User(
            id="usr-admin-2",
            organization_id=org2["id"],
            name="Acme Admin",
            email="admin@acmecorp.com",
            hashed_password=get_password_hash("AcmeAdmin@2026"),
            role=UserRole.ORG_ADMIN
        ).dict()
        await store.insert_one("users", admin2)
        print("Created Admin: admin@acmecorp.com (Password: AcmeAdmin@2026)")

    # 5. Org A Sample Attendance for Today
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    att1 = await store.find_one("attendance", {"organization_id": org1["id"], "employee_id": "emp-arg-1", "date": today_str})
    if not att1:
        now_dt = datetime.utcnow().replace(hour=9, minute=5, second=0)
        att1 = Attendance(
            organization_id=org1["id"],
            employee_id="emp-arg-1",
            employee_code="ARG-001",
            employee_name="Alex Vance",
            department="AI Research",
            date=today_str,
            check_in=now_dt,
            status=AttendanceStatus.PRESENT,
            verification_mode="FACE_KIOSK",
            confidence_score=0.94,
            liveness_verified=True
        ).dict()
        await store.insert_one("attendance", att1)
        print("Added sample today attendance punch for Alex Vance.")

    print("\n--- Multi-Tenant Seed Complete ---")
    print("Tenant 1: Argus Technologies (Slug: argus-tech)")
    print("  Login: admin@argustech.ai / ArgusAdmin@2026")
    print("Tenant 2: Acme Global Corporation (Slug: acme-corp)")
    print("  Login: admin@acmecorp.com / AcmeAdmin@2026")
    print("Employee Portal: alex.vance@argustech.ai / Argus@123")

async def main():
    from app.db.mongodb import connect_to_mongo, close_mongo_connection
    await connect_to_mongo()
    await seed_demo_data()
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())