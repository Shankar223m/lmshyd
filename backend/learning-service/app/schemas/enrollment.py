from lms_common.envelopes import PageContext, RequestSchema, ResponseSchema, SuccessResponse
from pydantic import Field

from app.schemas.common import ListQuery
from app.schemas.types import PublicIdOut, Timestamp, id_field

EnrollStudentId = id_field("student_user_id", "1755000000005999")


class EnrollmentCreate(RequestSchema):
    student_user_id: EnrollStudentId  # type: ignore[valid-type]


class BulkEnrollmentCreate(RequestSchema):
    student_user_ids: list[EnrollStudentId]  # type: ignore[valid-type]


class EnrollmentListQuery(ListQuery):
    batch_id: str | None = None


class EnrollmentOut(ResponseSchema):
    enrollment_id: PublicIdOut = Field(validation_alias="public_id")
    batch_id: PublicIdOut = Field(validation_alias="batch_public_id")
    student_user_id: PublicIdOut
    status: str
    enrolled_at: Timestamp
    withdrawn_at: Timestamp | None = None


class BulkEnrollmentResult(ResponseSchema):
    enrolled_count: int
    skipped_count: int
    enrollments: list[EnrollmentOut]


class EnrollmentResponse(SuccessResponse):
    enrollment: EnrollmentOut


class BulkEnrollmentResponse(SuccessResponse):
    result: BulkEnrollmentResult


class EnrollmentListResponse(SuccessResponse):
    enrollments: list[EnrollmentOut]
    page_context: PageContext


class MyCourseOut(ResponseSchema):
    """Active enrolment plus course display fields — one row per course for student dashboards."""

    enrollment_id: PublicIdOut
    batch_id: PublicIdOut
    course_id: PublicIdOut
    title: str


class MyCourseListResponse(SuccessResponse):
    courses: list[MyCourseOut]
