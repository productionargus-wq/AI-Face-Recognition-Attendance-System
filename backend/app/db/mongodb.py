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
        client = AsyncIOMotorClient(
            settings.MONGODB_URI, 
            serverSelectionTimeoutMS=15000,
            connectTimeoutMS=15000,
            socketTimeoutMS=15000
        )
        # Test connection with ping
        await client.admin.command('ping')
        db = client[settings.DATABASE_NAME]
        
        # Create multi-tenant indexes
        try:
            # Replace non-sparse gstin index if present
            existing_indexes = await db.organizations.index_information()
            if "gstin_1" in existing_indexes and not existing_indexes["gstin_1"].get("sparse"):
                await db.organizations.drop_index("gstin_1")
        except Exception:
            pass

        try:
            await db.organizations.create_index("slug", unique=True)
            await db.organizations.create_index("gstin", sparse=True)
            await db.users.create_index([("email", 1)], unique=True)
            await db.users.create_index([("organization_id", 1)])
            await db.employees.create_index([("organization_id", 1), ("employee_code", 1)], unique=True)
            await db.employees.create_index([("email", 1)])
            await db.attendance.create_index([("organization_id", 1), ("employee_id", 1), ("date", 1)])
            await db.audit_logs.create_index([("organization_id", 1), ("timestamp", -1)])
            await db.kiosks.create_index([("organization_id", 1), ("kiosk_key", 1)])
            logger.info("Multi-tenant MongoDB indexes initialized.")
        except Exception as idx_err:
            logger.warning(f"Notice on MongoDB indexes: {idx_err}")
            
        db_manager.client = client
        db_manager.db = db
        logger.info("MongoDB Atlas connected and verified successfully!")
        return db
    except Exception as e:
        db_manager.client = None
        db_manager.db = None
        logger.warning(f"MongoDB connection attempt failed ({e}). System will retry on demand.")
        return None

async def ensure_mongo_connected():
    if db_manager.db is None:
        return await connect_to_mongo()
    return db_manager.db

async def close_mongo_connection():
    if db_manager.client:
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("MongoDB connection closed.")

def get_database():
    return db_manager.db
