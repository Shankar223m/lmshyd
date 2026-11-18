"""Service-to-service endpoints (shared internal token). catalog-service asks which courses a student may open."""

from fastapi import APIRouter
from lms_common.envelopes import SuccessResponse
from sqlalchemy import distinct, select

from app.api.deps import DbSession, RequireInternalCaller
from app.api.responses import errors
from app.domain.enums import EnrollmentStatus
from app.models.batch import Batch
from app.models.course_version_ref import CourseVersionRef
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/internal", tags=["Internal"], dependencies=[RequireInternalCaller])


class StudentCoursesResponse(SuccessResponse):
    user_id: int
    course_ids: list[int]


@router.get(
    "/students/{user_id}/courses",
    response_model=StudentCoursesResponse,
    summary="The courses a student may open: those they are actively enrolled in",
    description=(
        "Requires `X-Internal-Service-Token`. An institution student is enrolled by their institution into courses it holds; "
        "a self-registered learner is enrolled when they buy a course (and withdrawn when the access expires). An active "
        "enrolment is therefore the one record of 'this person may study this course'."
    ),
    responses=errors(403),
)
async def student_courses(user_id: int, db: DbSession) -> StudentCoursesResponse:
    rows = await db.execute(
        select(distinct(CourseVersionRef.course_id))
        .join(Batch, Batch.version_id == CourseVersionRef.version_id)
        .join(Enrollment, Enrollment.batch_id == Batch.id)
        .where(Enrollment.student_user_id == user_id, Enrollment.status == EnrollmentStatus.ACTIVE)
    )
    return StudentCoursesResponse(message="Courses retrieved successfully.", user_id=user_id, course_ids=sorted(int(c) for c in rows.scalars()))
