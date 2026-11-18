"""The role catalogue: industries, departments, roles, career levels, purposes, and what each role says about its resume.
Students read it; careers managers add and change entries without a code change."""

from typing import Annotated, Any

from fastapi import APIRouter, Query
from lms_common.envelopes import RequestSchema, SuccessResponse
from pydantic import Field
from sqlalchemy import select

from app.api.deps import DbSession, RequireCareersManager, RequireStudent
from app.api.responses import AUTHENTICATED, errors
from app.core.exceptions import ConflictError, NotFoundError
from app.models.taxonomy import Department, Industry, JobRole
from app.taxonomy.service import TaxonomyService, slugify

router = APIRouter(tags=["Role catalogue"])
admin = APIRouter(prefix="/admin/taxonomy", tags=["Role catalogue (careers managers)"])


class ItemsResponse(SuccessResponse):
    items: list[dict[str, Any]]


class ProfileResponse(SuccessResponse):
    profile: dict[str, Any]


class IndustryIn(RequestSchema):
    name: str = Field(min_length=2, max_length=100)
    icon: str = Field(default="briefcase", max_length=30)


class DepartmentIn(RequestSchema):
    industry_key: str
    name: str = Field(min_length=2, max_length=100)
    skills: list[str] = Field(default_factory=list, max_length=60)
    keywords: list[str] = Field(default_factory=list, max_length=60)
    sections: dict[str, Any] = Field(default_factory=dict)
    template_keys: list[str] = Field(default_factory=list, max_length=10)
    ai_hint: str | None = Field(default=None, max_length=400)


class RoleIn(RequestSchema):
    department_key: str
    name: str = Field(min_length=2, max_length=120)
    aliases: list[str] = Field(default_factory=list, max_length=20)
    specializations: list[str] = Field(default_factory=list, max_length=30)
    skills: list[str] = Field(default_factory=list, max_length=60)
    keywords: list[str] = Field(default_factory=list, max_length=60)
    sections: dict[str, Any] = Field(default_factory=dict)
    template_keys: list[str] = Field(default_factory=list, max_length=10)
    ai_hint: str | None = Field(default=None, max_length=400)


class RoleUpdate(RequestSchema):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    aliases: list[str] | None = None
    specializations: list[str] | None = None
    skills: list[str] | None = None
    keywords: list[str] | None = None
    sections: dict[str, Any] | None = None
    template_keys: list[str] | None = None
    ai_hint: str | None = None
    active: bool | None = None


@router.get("/taxonomy/industries", response_model=ItemsResponse, summary="Fields of work", responses=errors(*AUTHENTICATED))
async def industries(_: RequireStudent, db: DbSession) -> ItemsResponse:
    return ItemsResponse(message="", items=await TaxonomyService(db).industries())


@router.get("/taxonomy/industries/{industry_key}/departments", response_model=ItemsResponse, summary="Departments of a field", responses=errors(*AUTHENTICATED))
async def departments(industry_key: str, _: RequireStudent, db: DbSession) -> ItemsResponse:
    return ItemsResponse(message="", items=await TaxonomyService(db).departments(industry_key))


@router.get("/taxonomy/roles", response_model=ItemsResponse, summary="Search job roles", description="Search by name or alias, optionally inside one field or department. Any role can also be typed freely.", responses=errors(*AUTHENTICATED))
async def roles(
    _: RequireStudent, db: DbSession, q: Annotated[str | None, Query(max_length=80)] = None, industry: Annotated[str | None, Query(max_length=40)] = None,
    department: Annotated[str | None, Query(max_length=60)] = None,
) -> ItemsResponse:
    return ItemsResponse(message="", items=await TaxonomyService(db).roles(q=q, industry=industry, department=department))


@router.get("/taxonomy/role-profile", response_model=ProfileResponse, summary="What a role's resume should contain", description="Suggested skills (with why), ATS keywords, headings, extra sections, templates. Works for a custom role: pass `custom_role` and optionally its `department`.", responses=errors(*AUTHENTICATED))
async def role_profile(
    _: RequireStudent, db: DbSession, role: Annotated[str | None, Query(max_length=80)] = None, department: Annotated[str | None, Query(max_length=60)] = None,
    custom_role: Annotated[str | None, Query(max_length=120)] = None,
) -> ProfileResponse:
    return ProfileResponse(message="", profile=await TaxonomyService(db).profile(role_key=role, department_key=department, custom_role=custom_role))


@router.get("/taxonomy/career-levels", response_model=ItemsResponse, summary="Career levels", responses=errors(*AUTHENTICATED))
async def career_levels(_: RequireStudent, db: DbSession) -> ItemsResponse:
    return ItemsResponse(message="", items=await TaxonomyService(db).career_levels())


@router.get("/taxonomy/purposes", response_model=ItemsResponse, summary="Resume purposes", responses=errors(*AUTHENTICATED))
async def purposes(_: RequireStudent, db: DbSession) -> ItemsResponse:
    return ItemsResponse(message="", items=await TaxonomyService(db).purposes())


# ---------------------------------------------------------------------------------------------------- careers managers
@admin.post("/industries", status_code=201, response_model=ItemsResponse, summary="Add a field of work", responses=errors(401, 403, 409, 422))
async def add_industry(body: IndustryIn, _: RequireCareersManager, db: DbSession) -> ItemsResponse:
    key = slugify(body.name)
    if (await db.execute(select(Industry).where(Industry.key == key))).scalar_one_or_none():
        raise ConflictError("That field already exists.", code="INDUSTRY_EXISTS")
    db.add(Industry(key=key, name=body.name, icon=body.icon, position=999, active=True))
    await db.commit()
    return ItemsResponse(message="Added.", items=await TaxonomyService(db).industries())


@admin.post("/departments", status_code=201, response_model=ItemsResponse, summary="Add a department", responses=errors(401, 403, 404, 409, 422))
async def add_department(body: DepartmentIn, _: RequireCareersManager, db: DbSession) -> ItemsResponse:
    industry = (await db.execute(select(Industry).where(Industry.key == body.industry_key))).scalar_one_or_none()
    if industry is None:
        raise NotFoundError("That field of work does not exist.", code="INDUSTRY_NOT_FOUND")
    key = slugify(f"{body.industry_key}-{body.name}")
    if (await db.execute(select(Department).where(Department.key == key))).scalar_one_or_none():
        raise ConflictError("That department already exists.", code="DEPARTMENT_EXISTS")
    db.add(Department(industry_id=industry.id, key=key, name=body.name, position=999, active=True, skills=body.skills, keywords=body.keywords, sections=body.sections, template_keys=body.template_keys, ai_hint=body.ai_hint))
    await db.commit()
    return ItemsResponse(message="Added.", items=await TaxonomyService(db).departments(body.industry_key))


@admin.post("/roles", status_code=201, response_model=ItemsResponse, summary="Add a job role", responses=errors(401, 403, 404, 409, 422))
async def add_role(body: RoleIn, _: RequireCareersManager, db: DbSession) -> ItemsResponse:
    department = (await db.execute(select(Department).where(Department.key == body.department_key))).scalar_one_or_none()
    if department is None:
        raise NotFoundError("That department does not exist.", code="DEPARTMENT_NOT_FOUND")
    key = slugify(body.name)
    if (await db.execute(select(JobRole).where(JobRole.key == key))).scalar_one_or_none():
        raise ConflictError("That role already exists.", code="ROLE_EXISTS")
    db.add(JobRole(
        department_id=department.id, key=key, name=body.name, aliases=body.aliases, specializations=body.specializations, skills=body.skills, keywords=body.keywords,
        sections=body.sections, template_keys=body.template_keys, ai_hint=body.ai_hint, active=True,
    ))
    await db.commit()
    return ItemsResponse(message="Added.", items=await TaxonomyService(db).roles(q=body.name, industry=None, department=None, limit=5))


@admin.patch("/roles/{role_key}", response_model=ProfileResponse, summary="Change a job role", responses=errors(401, 403, 404, 422))
async def change_role(role_key: str, body: RoleUpdate, _: RequireCareersManager, db: DbSession) -> ProfileResponse:
    role = (await db.execute(select(JobRole).where(JobRole.key == role_key))).scalar_one_or_none()
    if role is None:
        raise NotFoundError("That role does not exist.", code="ROLE_NOT_FOUND")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    await db.commit()
    return ProfileResponse(message="Saved.", profile=await TaxonomyService(db).profile(role_key=role_key))
