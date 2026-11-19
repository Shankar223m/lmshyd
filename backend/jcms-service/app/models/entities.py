import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.shared.enums import (
    ApplicationStatus,
    EligibilityResult,
    EmploymentType,
    InterviewStatus,
    JobStatus,
    OfferStatus,
    OrganizationType,
    PlacementStatus,
    UserRole,
    VerificationStatus,
    WorkMode,
)


def _uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    organization_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=True
    )

    organization: Mapped["Organization | None"] = relationship(back_populates="members")
    student_profile: Mapped["StudentProfile | None"] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token_jti: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    org_type: Mapped[str] = mapped_column(String(50), index=True)
    registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_band: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    placement_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    placement_contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(50), default=VerificationStatus.PENDING.value
    )
    verification_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    members: Mapped[list[User]] = relationship(back_populates="organization")
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="organization",
        foreign_keys="Job.organization_id",
    )
    verification_documents: Mapped[list["VerificationDocument"]] = relationship(
        back_populates="organization"
    )


class VerificationDocument(Base, TimestampMixin):
    __tablename__ = "verification_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"))
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("files.id"))
    doc_type: Mapped[str] = mapped_column(String(100))

    organization: Mapped[Organization] = relationship(back_populates="verification_documents")
    file: Mapped["StoredFile"] = relationship()


class StudentProfile(Base, TimestampMixin):
    __tablename__ = "student_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True)
    institution_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=True
    )
    program: Mapped[str | None] = mapped_column(String(255), nullable=True)
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cgpa: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, default=list)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    batch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    projects: Mapped[list | None] = mapped_column(JSON, default=list)
    certifications: Mapped[list | None] = mapped_column(JSON, default=list)
    experience: Mapped[list | None] = mapped_column(JSON, default=list)
    resume_file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id"), nullable=True)
    open_market_only: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="student_profile")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[str] = mapped_column(String(50), default=EmploymentType.FULL_TIME.value)
    work_mode: Mapped[str] = mapped_column(String(50), default=WorkMode.HYBRID.value)
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_currency: Mapped[str] = mapped_column(String(10), default="INR")
    openings: Mapped[int] = mapped_column(Integer, default=1)
    closes_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=JobStatus.DRAFT.value, index=True)
    skills: Mapped[list | None] = mapped_column(JSON, default=list)
    hiring_stages: Mapped[list | None] = mapped_column(JSON, default=list)
    questions: Mapped[list | None] = mapped_column(JSON, default=list)
    moderation_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_moderation: Mapped[bool] = mapped_column(Boolean, default=True)
    posting_channel: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    campus_institution_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("organizations.id"), nullable=True, index=True
    )

    organization: Mapped[Organization] = relationship(
        back_populates="jobs",
        foreign_keys=[organization_id],
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="job")
    recruiter_assignments: Mapped[list["RecruiterAssignment"]] = relationship(back_populates="job")


class RecruiterAssignment(Base, TimestampMixin):
    __tablename__ = "recruiter_assignments"
    __table_args__ = (UniqueConstraint("job_id", "recruiter_id", name="uq_job_recruiter"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)
    recruiter_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)

    job: Mapped[Job] = relationship(back_populates="recruiter_assignments")


class EligibilityRule(Base, TimestampMixin):
    __tablename__ = "eligibility_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)
    rule_type: Mapped[str] = mapped_column(String(100))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)


class EligibilityEvaluation(Base, TimestampMixin):
    __tablename__ = "eligibility_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    result: Mapped[str] = mapped_column(String(50))
    details: Mapped[list | None] = mapped_column(JSON, default=list)
    match_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Application(Base, TimestampMixin):
    __tablename__ = "applications"
    # Unique active app enforced in service + PG partial index (status <> WITHDRAWN).
    # Withdrawn rows may coexist so reapply creates a new application id.

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default=ApplicationStatus.SUBMITTED.value, index=True)
    pipeline_stage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    match_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answers: Mapped[dict | None] = mapped_column(JSON, default=dict)
    resume_file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id"), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped[Job] = relationship(back_populates="applications")
    status_events: Mapped[list["ApplicationStatusEvent"]] = relationship(back_populates="application")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="application")
    offers: Mapped[list["Offer"]] = relationship(back_populates="application")


class ApplicationStatusEvent(Base):
    __tablename__ = "application_status_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50))
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application: Mapped[Application] = relationship(back_populates="status_events")


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"), index=True)
    round_name: Mapped[str] = mapped_column(String(100))
    format: Mapped[str] = mapped_column(String(50), default="ONLINE")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    panel_user_ids: Mapped[list | None] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(50), default=InterviewStatus.SCHEDULED.value)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)

    application: Mapped[Application] = relationship(back_populates="interviews")
    scorecard: Mapped["InterviewScorecard | None"] = relationship(back_populates="interview")
    reschedule_requests: Mapped[list["InterviewRescheduleRequest"]] = relationship(
        back_populates="interview"
    )


class InterviewRescheduleRequest(Base, TimestampMixin):
    __tablename__ = "interview_reschedule_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    interview_id: Mapped[str] = mapped_column(String(36), ForeignKey("interviews.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    requested_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    requested_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING")
    reviewer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reviewer_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    interview: Mapped[Interview] = relationship(back_populates="reschedule_requests")


class InterviewScorecard(Base, TimestampMixin):
    __tablename__ = "interview_scorecards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    interview_id: Mapped[str] = mapped_column(String(36), ForeignKey("interviews.id"), unique=True)
    technical_skills: Mapped[int | None] = mapped_column(Integer, nullable=True)
    problem_solving: Mapped[int | None] = mapped_column(Integer, nullable=True)
    communication: Mapped[int | None] = mapped_column(Integer, nullable=True)
    culture_fit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    submitted_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    interview: Mapped[Interview] = relationship(back_populates="scorecard")


class Offer(Base, TimestampMixin):
    __tablename__ = "offers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"), index=True)
    role_title: Mapped[str] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(255))
    annual_package: Mapped[float] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    respond_by: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=OfferStatus.DRAFT.value, index=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    offer_letter_file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)

    application: Mapped[Application] = relationship(back_populates="offers")


class Placement(Base, TimestampMixin):
    __tablename__ = "placements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    application_id: Mapped[str] = mapped_column(String(36), ForeignKey("applications.id"), unique=True)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    institution_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=True)
    offer_id: Mapped[str] = mapped_column(String(36), ForeignKey("offers.id"))
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    joining_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    annual_package: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    work_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evidence_file_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("files.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=PlacementStatus.PENDING_DETAILS.value)
    verifier_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_documents: Mapped[list["PlacementEvidence"]] = relationship(back_populates="placement")


class PlacementEvidence(Base, TimestampMixin):
    __tablename__ = "placement_evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    placement_id: Mapped[str] = mapped_column(String(36), ForeignKey("placements.id"), index=True)
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("files.id"))
    category: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), default="PENDING")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    placement: Mapped[Placement] = relationship(back_populates="evidence_documents")


class StoredFile(Base, TimestampMixin):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(50))


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[str] = mapped_column(String(36))
    audit_metadata: Mapped[dict | None] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OutboxEvent(Base, TimestampMixin):
    __tablename__ = "outbox_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)


# Re-export enums for convenience
__all__ = [
    "User",
    "UserRole",
    "Organization",
    "Job",
    "Application",
    "Interview",
    "Offer",
    "Placement",
    "EligibilityResult",
]
