"""Assign recruiters to jobs and enforce recruiter job scope."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.security import AccessTokenClaims
from app.models.job import Job
from app.models.recruiter_assignment import JobRecruiterAssignment
from app.permissions.policy import can_manage_careers, is_employer_admin, owns_employer
from app.permissions.roles import Role


class RecruiterAssignmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_job(self, job: Job) -> list[JobRecruiterAssignment]:
        return list((await self.db.execute(select(JobRecruiterAssignment).where(JobRecruiterAssignment.job_id == job.id))).scalars())

    async def list_job_ids_for_recruiter(self, recruiter_user_id: int) -> list[object]:
        rows = (await self.db.execute(select(JobRecruiterAssignment.job_id).where(JobRecruiterAssignment.recruiter_user_id == recruiter_user_id))).scalars()
        return list(rows)

    async def replace(self, auth: AccessTokenClaims, job: Job, recruiter_user_ids: list[int]) -> list[JobRecruiterAssignment]:
        if not (is_employer_admin(auth) or can_manage_careers(auth)):
            raise PermissionDeniedError("Only a company admin can assign recruiters.", code="EMPLOYER_ADMIN_ONLY")
        if not owns_employer(auth, job.employer_org_id):
            raise NotFoundError("Job not found.", code="JOB_NOT_FOUND")
        existing = await self.list_for_job(job)
        for row in existing:
            await self.db.delete(row)
        await self.db.flush()
        created: list[JobRecruiterAssignment] = []
        for uid in dict.fromkeys(recruiter_user_ids):
            row = JobRecruiterAssignment(job_id=job.id, recruiter_user_id=uid, assigned_by=auth.user_id)
            self.db.add(row)
            created.append(row)
        await self.db.commit()
        return created

    async def assert_can_manage_job(self, auth: AccessTokenClaims, job: Job) -> None:
        """Employer admins and careers managers: org-wide. Recruiters: assigned jobs only."""
        if can_manage_careers(auth):
            return
        if not owns_employer(auth, job.employer_org_id):
            raise NotFoundError("Job not found.", code="JOB_NOT_FOUND")
        if auth.role == Role.EMPLOYER_ADMIN or is_employer_admin(auth):
            return
        if auth.role == Role.RECRUITER:
            assigned = (
                await self.db.execute(
                    select(JobRecruiterAssignment.id).where(
                        JobRecruiterAssignment.job_id == job.id,
                        JobRecruiterAssignment.recruiter_user_id == auth.user_id,
                    )
                )
            ).scalar_one_or_none()
            if assigned is None:
                raise PermissionDeniedError("You are not assigned to this job.", code="RECRUITER_NOT_ASSIGNED")
            return
        raise PermissionDeniedError("Only a company's recruiters and admins can do this.", code="EMPLOYERS_ONLY")

    async def ensure_assigned_or_admin(self, auth: AccessTokenClaims, job: Job) -> None:
        try:
            await self.assert_can_manage_job(auth, job)
        except PermissionDeniedError:
            raise
        except NotFoundError:
            raise
        except ConflictError:
            raise
