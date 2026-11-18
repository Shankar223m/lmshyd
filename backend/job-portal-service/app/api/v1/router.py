from fastapi import APIRouter

from app.api.v1.endpoints import applications, catalog, directory, employers, hiring, institution, jcms_facade, jcms_student, jobs, recruiter

api_router = APIRouter()
api_router.include_router(employers.router)
api_router.include_router(employers.admin)
api_router.include_router(jobs.router)
api_router.include_router(jobs.admin)
api_router.include_router(catalog.router)
api_router.include_router(applications.router)
api_router.include_router(hiring.router)
api_router.include_router(institution.router)
api_router.include_router(institution.drives)
api_router.include_router(directory.router)
api_router.include_router(recruiter.router)
api_router.include_router(jcms_student.router)
# The public /api/v1/jcms API is served by jcms-service (the gateway routes it there); this copy stays internal.
api_router.include_router(jcms_facade.router, include_in_schema=False)
