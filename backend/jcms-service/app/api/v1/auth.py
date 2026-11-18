import secrets
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Request

from app.api.deps import CurrentUser, DbSession, attach_request_id, require_roles
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.core.security import hash_password
from app.models.entities import Organization, RefreshToken, StudentProfile, User
from app.modules.identity import service as identity_service
from app.shared.enums import UserRole

router = APIRouter(prefix="", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: UserRole
    organization_name: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


class LogoutBody(BaseModel):
    refresh_token: str | None = None


class ProfileUpdateBody(BaseModel):
    full_name: str | None = None
    program: str | None = None
    graduation_year: int | None = Field(default=None, ge=1950, le=2035)
    cgpa: float | None = Field(default=None, ge=0.0, le=10.0)
    location: str | None = None
    skills: list[str] | None = None
    resume_file_id: str | None = None
    department: str | None = None
    batch: str | None = None
    phone: str | None = None
    projects: list | None = None
    certifications: list | None = None
    experience: list | None = None


class OrganizationUpdateBody(BaseModel):
    name: str | None = None
    website: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    size_band: str | None = None
    registration_number: str | None = None
    description: str | None = None
    industry: str | None = None
    address: str | None = None
    placement_contact_name: str | None = None
    placement_contact_email: str | None = None


class CreateRecruiterBody(BaseModel):
    email: EmailStr
    full_name: str
    # People sign in through the LMS; a local password is never a well-known one, so a random one is made when none is given.
    password: str = Field(default_factory=lambda: secrets.token_urlsafe(18), min_length=8)


@router.post("/auth/register")
def register(
    body: RegisterBody,
    db: DbSession,
    request: Request,
    _: str = Depends(attach_request_id),
):
    from app.core.config import settings as _settings

    if _settings.lms_auth_enabled:
        raise AppError("LMS_AUTH_ONLY", "Use LMS registration / user-management. JCMS register is disabled.", 403)
    ip = client_ip(request)
    enforce_rate_limit(f"auth:register:{ip}", limit=10, window_seconds=3600)
    try:
        user = identity_service.register_user(
            db,
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            role=body.role,
            organization_name=body.organization_name,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        code = str(e)
        raise AppError(code, code.replace("_", " ").title(), 409 if code == "EMAIL_EXISTS" else 400)
    return success_data({"id": user.id, "email": user.email, "role": user.role}, request)


@router.post("/auth/login")
def login(body: LoginBody, db: DbSession, request: Request, _: str = Depends(attach_request_id)):
    from app.core.config import settings as _settings

    if _settings.lms_auth_enabled:
        raise AppError("LMS_AUTH_ONLY", "Use LMS login. JCMS login is disabled.", 403)
    ip = client_ip(request)
    enforce_rate_limit(f"auth:login:{ip}", limit=20, window_seconds=60)
    try:
        user, access, refresh = identity_service.authenticate(db, body.email, body.password, client_ip=ip)
        db.commit()
    except ValueError:
        db.rollback()
        from app.modules.audit.service import record_audit

        record_audit(
            db,
            actor_id=None,
            action="auth.login.failed",
            resource_type="auth",
            resource_id="login",
            metadata={"ip": ip, "email_domain": body.email.split("@")[-1] if "@" in body.email else "invalid"},
        )
        db.commit()
        raise AppError("INVALID_CREDENTIALS", "Invalid email or password", 401)
    return success_data(
        {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name,
                "organization_id": user.organization_id,
            },
        },
        request,
    )


@router.post("/auth/refresh")
def refresh(body: RefreshBody, db: DbSession, request: Request, _: str = Depends(attach_request_id)):
    try:
        access, refresh_tok = identity_service.refresh_access_token(db, body.refresh_token)
        db.commit()
    except ValueError:
        db.rollback()
        raise AppError("INVALID_TOKEN", "Invalid refresh token", 401)
    return success_data({"access_token": access, "refresh_token": refresh_tok}, request)


@router.post("/auth/logout")
def logout(body: LogoutBody, db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    if body.refresh_token:
        from app.core.security import decode_token

        try:
            payload = decode_token(body.refresh_token)
            jti = payload.get("jti")
            if jti:
                rt = db.scalar(select(RefreshToken).where(RefreshToken.token_jti == jti))
                if rt:
                    rt.revoked = True
        except Exception:
            pass
    # Revoke all user refresh tokens on explicit logout
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({RefreshToken.revoked: True})
    db.commit()
    return success_data({"status": "logged_out"}, request)


@router.get("/auth/me")
def me(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    org_name = None
    if user.organization_id:
        org = db.get(Organization, user.organization_id)
        org_name = org.name if org else None
    elif user.role == UserRole.STUDENT.value and user.student_profile and user.student_profile.institution_id:
        inst = db.get(Organization, user.student_profile.institution_id)
        org_name = inst.name if inst else None

    return success_data(
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "organization_id": user.organization_id,
            "organization_name": org_name,
        },
        request,
    )


@router.get("/auth/profile")
def get_profile(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    out = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "organization_id": user.organization_id,
    }
    if user.role == UserRole.STUDENT.value:
        profile = user.student_profile
        if not profile:
            profile = StudentProfile(user_id=user.id, skills=[])
            db.add(profile)
            db.commit()
        inst = db.get(Organization, profile.institution_id) if profile.institution_id else None
        from app.modules.identity.profile_completion import compute_profile_completion_percent

        out["profile_completion_percent"] = compute_profile_completion_percent(profile)
        out["student_profile"] = {
            "program": profile.program,
            "graduation_year": profile.graduation_year,
            "cgpa": float(profile.cgpa) if profile.cgpa else None,
            "location": profile.location,
            "skills": profile.skills or [],
            "resume_file_id": profile.resume_file_id,
            "institution_id": profile.institution_id,
            "institution_name": inst.name if inst else None,
            "department": profile.department,
            "batch": profile.batch,
            "phone": profile.phone,
            "projects": profile.projects or [],
            "certifications": profile.certifications or [],
            "experience": profile.experience or [],
        }
    elif user.organization_id:
        org = db.get(Organization, user.organization_id)
        if org:
            out["organization"] = {
                "id": org.id,
                "name": org.name,
                "org_type": org.org_type,
                "verification_status": org.verification_status,
                "registration_number": org.registration_number,
                "website": org.website,
                "contact_name": org.contact_name,
                "contact_email": org.contact_email,
                "size_band": org.size_band,
                "description": org.description,
                "industry": org.industry,
                "address": org.address,
                "placement_contact_name": org.placement_contact_name,
                "placement_contact_email": org.placement_contact_email,
            }
    return success_data(out, request)


@router.patch("/auth/profile")
def update_profile(
    body: ProfileUpdateBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    if body.full_name is not None:
        user.full_name = body.full_name

    if user.role == UserRole.STUDENT.value:
        profile = user.student_profile
        if not profile:
            profile = StudentProfile(user_id=user.id, skills=[])
            db.add(profile)
            db.flush()
        if body.program is not None:
            profile.program = body.program
        if body.graduation_year is not None:
            profile.graduation_year = body.graduation_year
        if body.cgpa is not None:
            profile.cgpa = body.cgpa
        if body.location is not None:
            profile.location = body.location
        if body.skills is not None:
            profile.skills = body.skills
        if body.resume_file_id is not None:
            profile.resume_file_id = body.resume_file_id

        if body.resume_file_id is not None:
            profile.resume_file_id = body.resume_file_id
        if body.department is not None:
            profile.department = body.department
        if body.batch is not None:
            profile.batch = body.batch
        if body.phone is not None:
            profile.phone = body.phone
        if body.projects is not None:
            profile.projects = body.projects
        if body.certifications is not None:
            profile.certifications = body.certifications
        if body.experience is not None:
            profile.experience = body.experience

    db.commit()
    return success_data({"status": "updated"}, request)


@router.get("/employers/me")
def get_employer_org(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.EMPLOYER)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No organization", 403)
    org = db.get(Organization, user.organization_id)
    if not org:
        raise AppError("NOT_FOUND", "Organization not found", 404)
    return success_data(
        {
            "id": org.id,
            "name": org.name,
            "verification_status": org.verification_status,
            "registration_number": org.registration_number,
            "website": org.website,
            "contact_name": org.contact_name,
            "contact_email": org.contact_email,
            "size_band": org.size_band,
            "description": org.description,
            "industry": org.industry,
            "address": org.address,
        },
        request,
    )


@router.patch("/employers/me")
def update_employer_org(
    body: OrganizationUpdateBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.EMPLOYER)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No organization", 403)
    org = db.get(Organization, user.organization_id)
    if not org:
        raise AppError("NOT_FOUND", "Organization not found", 404)
    for field in (
        "name",
        "website",
        "contact_name",
        "contact_email",
        "size_band",
        "registration_number",
        "description",
        "industry",
        "address",
    ):
        val = getattr(body, field)
        if val is not None:
            setattr(org, field, val)
    db.commit()
    return success_data({"status": "updated"}, request)


@router.get("/institutions/me")
def get_institution_org(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)
    org = db.get(Organization, user.organization_id)
    if not org:
        raise AppError("NOT_FOUND", "Organization not found", 404)
    return success_data(
        {
            "id": org.id,
            "name": org.name,
            "verification_status": org.verification_status,
            "website": org.website,
            "contact_name": org.contact_name,
            "contact_email": org.contact_email,
            "address": org.address,
            "description": org.description,
            "placement_contact_name": org.placement_contact_name,
            "placement_contact_email": org.placement_contact_email,
        },
        request,
    )


@router.patch("/institutions/me")
def update_institution_org(
    body: OrganizationUpdateBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.INSTITUTION)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No institution", 403)
    org = db.get(Organization, user.organization_id)
    if not org:
        raise AppError("NOT_FOUND", "Organization not found", 404)
    for field in (
        "name",
        "website",
        "contact_name",
        "contact_email",
        "address",
        "description",
        "placement_contact_name",
        "placement_contact_email",
    ):
        val = getattr(body, field)
        if val is not None:
            setattr(org, field, val)
    db.commit()
    return success_data({"status": "updated"}, request)


@router.get("/employers/me/recruiters")
def list_recruiters(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    require_roles(UserRole.EMPLOYER)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No organization", 403)
    recruiters = db.scalars(
        select(User).where(
            User.organization_id == user.organization_id,
            User.role == UserRole.RECRUITER.value,
        )
    ).all()
    return success_data(
        [{"id": r.id, "email": r.email, "full_name": r.full_name, "is_active": r.is_active} for r in recruiters],
        request,
    )


@router.post("/employers/me/recruiters")
def add_recruiter(
    body: CreateRecruiterBody,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    require_roles(UserRole.EMPLOYER)(user)
    if not user.organization_id:
        raise AppError("FORBIDDEN", "No organization", 403)
    existing = db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise AppError("EMAIL_EXISTS", "Email already in use", 409)
    recruiter = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.RECRUITER.value,
        organization_id=user.organization_id,
    )
    db.add(recruiter)
    db.commit()
    return success_data({"id": recruiter.id, "email": recruiter.email, "full_name": recruiter.full_name}, request)
