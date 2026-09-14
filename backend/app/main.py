import logging
import os

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

from .database import Base, engine
from .routers import auth, ai, users, appointments, admin

load_dotenv()

logger = logging.getLogger("careflow")
logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CareFlow AI API",
    description="AI-powered patient care coordination and appointment management platform.",
    version="1.0.0",
)

# --- Security: startup warning if the default/insecure SECRET_KEY is in use ---
_DEFAULT_SECRET = "insecure-dev-secret-change-me"
if os.getenv("SECRET_KEY", _DEFAULT_SECRET) == _DEFAULT_SECRET:
    logger.warning(
        "SECURITY WARNING: SECRET_KEY is not set (or is the default placeholder). "
        "JWTs are signed with a well-known dev value. Set a long, random SECRET_KEY "
        "in backend/.env before deploying this anywhere beyond local development."
    )

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Security headers on every response ---
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# --- Global exception handling: never leak stack traces to clients ---
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    safe_errors = [
        {"loc": e.get("loc"), "msg": e.get("msg"), "type": e.get("type")}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": safe_errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception while processing %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# --- Register API Routers ---
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(users.router)
app.include_router(appointments.router)
app.include_router(admin.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "CareFlow AI API"}


# --- Serve React SPA Static Files ---
BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "build"))

if os.path.exists(os.path.join(BUILD_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(BUILD_DIR, "assets")), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Do not capture /api calls that didn't match a router
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})

    file_path = os.path.join(BUILD_DIR, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(BUILD_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)

    return JSONResponse(
        status_code=200,
        content={
            "service": "CareFlow AI Clinical API",
            "status": "online",
            "version": "1.0.0",
        },
    )
