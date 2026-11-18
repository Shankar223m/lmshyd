import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import AppError
from app.core.responses import error_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_security()
    # The database is checked by /health/ready, not here: a startup that waits on it would hang when it is down.
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    return await call_next(request)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return error_response(exc.code, exc.message, exc.status_code, request, exc.details)


@app.get("/health/live")
def health_live():
    return {"status": "ok"}


@app.get("/health")
@app.get("/health/ready")
def health():
    db_status = "healthy"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {exc}"
    return {
        "status": "ok" if "unhealthy" not in db_status else "degraded",
        "database": db_status,
        "app": settings.app_name,
        "version": "0.1.0",
    }


app.include_router(api_router)


def create_app() -> FastAPI:
    """Same entry point every other service has (the API gateway reads each service's routes through it)."""
    return app
