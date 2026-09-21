from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.reports import attendance_router, reports_router
from app.api.v1.organizations import router as org_router
from app.api.v1.operations import operations_router
from app.api.v1.payroll import payroll_router
from app.api.v1.financial_entries import financial_entries_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Argus AI Attendance Multi-Tenant Platform...")
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-Tenant Facial Recognition Attendance & Anti-Spoofing SaaS Platform for Argus Technologies",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "https://ai-face-recognition-attendance-system-2d63.onrender.com"
    ],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(employees_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(org_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(operations_router, prefix=settings.API_V1_STR)
app.include_router(payroll_router, prefix=settings.API_V1_STR)
app.include_router(financial_entries_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "tenancy": "Multi-Tenant Partitioned Architecture"
    }

@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msgs = []
    for err in errors:
        loc = " -> ".join(str(l) for l in err.get("loc", []) if l != "body")
        msg = err.get("msg", "Invalid field")
        msgs.append(f"{loc}: {msg}" if loc else msg)
    detail_str = "; ".join(msgs) or "Invalid form payload."
    logger.warning(f"Request validation error on {request.method} {request.url}: {detail_str}")
    origin = request.headers.get("origin")
    resp_headers = {}
    if origin:
        resp_headers["Access-Control-Allow-Origin"] = origin
        resp_headers["Access-Control-Allow-Credentials"] = "true"
        resp_headers["Access-Control-Expose-Headers"] = "*"
    return JSONResponse(
        status_code=422,
        content={"detail": detail_str, "errors": errors},
        headers=resp_headers
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    origin = request.headers.get("origin")
    resp_headers = {}
    if origin:
        resp_headers["Access-Control-Allow-Origin"] = origin
        resp_headers["Access-Control-Allow-Credentials"] = "true"
        resp_headers["Access-Control-Expose-Headers"] = "*"
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact administrator or check server logs."},
        headers=resp_headers
    )