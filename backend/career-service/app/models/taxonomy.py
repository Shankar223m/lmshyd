from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.types import JSONType


class Industry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A field of work (healthcare, finance, software...). Managed by careers managers, not by code."""

    __tablename__ = "industries"

    key: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str] = mapped_column(String(30), default="briefcase")
    position: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ResumeProfile:
    """Mixin of what a department or a role says about its resumes. A role's own value wins; an empty one inherits the department's."""

    skills: Mapped[list[str]] = mapped_column(JSONType, default=list)  # what to suggest, most relevant first
    keywords: Mapped[list[str]] = mapped_column(JSONType, default=list)  # what recruiters in this field search for (ATS)
    sections: Mapped[dict[str, Any]] = mapped_column(JSONType, default=dict)  # headings, skill groups, extra sections, optional steps
    template_keys: Mapped[list[str]] = mapped_column(JSONType, default=list)  # recommended layouts, best first
    ai_hint: Mapped[str | None] = mapped_column(Text)  # one line of terminology guidance handed to the AI


class Department(ResumeProfile, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "departments"

    industry_id: Mapped[Any] = mapped_column(ForeignKey("industries.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class JobRole(ResumeProfile, UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "job_roles"

    department_id: Mapped[Any] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    aliases: Mapped[list[str]] = mapped_column(JSONType, default=list)  # other names people search by
    specializations: Mapped[list[str]] = mapped_column(JSONType, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class CareerLevel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """How the person describes themselves. ``experience_level`` is the section order and length it maps to."""

    __tablename__ = "career_levels"

    key: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    experience_level: Mapped[str] = mapped_column(String(10))  # fresher | junior | mid | senior
    note: Mapped[str] = mapped_column(String(200), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)


class ResumePurpose(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "resume_purposes"

    key: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    note: Mapped[str] = mapped_column(String(200), default="")
    emphasis: Mapped[list[str]] = mapped_column(JSONType, default=list)  # sections to lead with for this purpose
    position: Mapped[int] = mapped_column(Integer, default=0)
