from fastapi import APIRouter

from app.api.v1 import admin, applications, auth, institutions, jobs, placements, platform, student_dashboard

# Mounted under LMS gateway path /api/v1/jcms (full path forwarded unchanged).
api_router = APIRouter(prefix="/api/v1/jcms")
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(applications.router)
api_router.include_router(admin.router)
api_router.include_router(placements.router)
api_router.include_router(institutions.router)
api_router.include_router(platform.router)
api_router.include_router(student_dashboard.router)
