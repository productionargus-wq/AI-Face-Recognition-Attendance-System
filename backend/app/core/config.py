import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "Argus AI Attendance System"
    API_V1_STR: str = "/api/v1"
    
    # MongoDB connection
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb+srv://salesargustech_db_user:12345@cluster0.nrulvqr.mongodb.net/ai-attendance-db?appName=Cluster0")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "ai-attendance-db")
    
    # JWT Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-argus-multitenant-key-2026-attendance")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Kiosk token secret
    KIOSK_SECRET: str = os.getenv("KIOSK_SECRET", "argus-kiosk-secret-terminal-key-2026")
    
    # Biometric Face Vector matching
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.55"))  # Calibrated for webcam lighting & angle variance
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
