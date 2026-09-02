import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    client: AsyncIOMotorClient = None
    db = None

db_manager = DatabaseManager()

async def connect_to_mongo():
    try:
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
        db_manager.client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=3000)
        db_manager.db = db_manager.client[settings.DATABASE_NAME]
        
        # Test connection
        await db_manager.client.admin.command('ping')
        logger.info("MongoDB connected successfully!")
        
        # Create multi-tenant indexes
        await db_manager.db.organizations.create_index("slug", unique=True)
        await db_manager.db.users.create_index([("email", 1)], unique=True)
        await db_manager.db.users.create_index([("organization_id", 1)])
        await db_manager.db.employees.create_index([("organization_id", 1), ("employee_code", 1)], unique=True)
        await db_manager.db.attendance.create_index([("organization_id", 1), ("employee_id", 1), ("date", 1)])
        await db_manager.db.audit_logs.create_index([("organization_id", 1), ("timestamp", -1)])
        await db_manager.db.kiosks.create_index([("organization_id", 1), ("kiosk_key", 1)])
        logger.info("Multi-tenant MongoDB indexes initialized.")
    except Exception as e:
        logger.warning(f"MongoDB connection failed ({e}). System will activate In-Memory / File Fallback Mode for local development.")

async def close_mongo_connection():
    if db_manager.client:
        db_manager.client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    return db_manager.db
