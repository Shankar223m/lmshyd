import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

from app.api import examples
from app.api.deps import (
    CurrentAuth,
    CurrentAuthAllowingPasswordChange,
    DbSession,
    SettingsDep,
    UserIdParam,
    UserServiceDep,
    rate_limit,
    user_id_path,
)
from app.api.pictures import PICTURE_BODY, PICTURE_HEADERS, read_picture
from app.api.responses import errors
from app.api.v1.endpoints.jobs import JobServiceDep
from app.core.config import Settings
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationFailedError
from app.core.security import generate_secure_random_password
from app.db.types import uuid7
from app.models.job import JobType
from app.permissions import capabilities, policies
from app.permissions.policies import Action
from app.schemas.common import PageContext, SuccessResponse
from app.schemas.imports import ImportResponse, ImportResultOut
from app.schemas.jobs import JobOut, JobResponse
from app.schemas.permissions import PermissionsOut, PermissionsResponse, UserFormOptionsOut, UserFormOptionsResponse
from app.schemas.user import (
    AvatarUploadResponse,
    CertificateUploadResponse,
    CheckUsernameResponse,
    CredentialsOut,
    GeneratePasswordResponse,
    GenerateUsernameResponse,
    MyProfileUpdate,
    SetPasswordRequest,
    StatusUpdate,
    UserCreate,
    UserCreatedResponse,
    UserExportQuery,
    UserListItem,
    UserListQuery,
    UserListResponse,
    UserOut,
    UserResponse,
    UserUpdate,
)
from app.services import export_service
from app.services.image_service import USER, ImageService
from app.services.import_service import ImportMode, ImportService, template_csv
from app.services.permission_service import PermissionService
from app.services.user_service import PreparedUser

router = APIRouter(prefix="/users", tags=["Users"])



# ====================================================================== credentials & avatar utilities


@router.get(
    "/generate-username",
    response_model=GenerateUsernameResponse,
    summary="Generate a unique username",
    description="Generates an available username from first and last name (e.g. rahul.sharma, rahul.sharma2).",
    responses=errors(401),
)
async def generate_username(
    first_name: Annotated[str, Query(min_length=1, max_length=50)],
    auth: CurrentAuth,
    service: UserServiceDep,
    last_name: Annotated[str, Query(max_length=50)] = "",
) -> GenerateUsernameResponse:
    username = await service.generate_unique_username(first_name, last_name)
    return GenerateUsernameResponse(username=username)


@router.get(
    "/check-username",
    response_model=CheckUsernameResponse,
    summary="Check username availability",
    description="Validates username format and verifies whether it is available in the database.",
    responses=errors(401),
)
async def check_username(
    username: Annotated[str, Query(min_length=1, max_length=50)],
    auth: CurrentAuth,
    service: UserServiceDep,
) -> CheckUsernameResponse:
    available, msg = await service.is_username_available(username)
    return CheckUsernameResponse(username=username, available=available, message=msg)


@router.get(
    "/generate-password",
    response_model=GeneratePasswordResponse,
    summary="Generate a secure random password",
    description="Generates a cryptographically secure random password meeting all password policy rules.",
    responses=errors(401),
)
async def generate_password(
    auth: CurrentAuth,
    service: UserServiceDep,
) -> GeneratePasswordResponse:
    length = max(14, service.settings.PASSWORD_MIN_LENGTH + 2)
    password = generate_secure_random_password(length)
    return GeneratePasswordResponse(password=password)


@router.post(
    "/avatar/upload",
    response_model=AvatarUploadResponse,
    summary="Upload profile picture",
    description="Uploads a JPG, PNG, or WebP profile picture (max 2 MB) and returns its storage URL.",
    responses=errors(401, 422),
)
async def upload_avatar(
    auth: CurrentAuth,
    service: UserServiceDep,
    file: Annotated[UploadFile, File(description="Profile picture image (JPG, PNG, WebP)")],
) -> AvatarUploadResponse:
    settings = service.settings
    # Check extension
    filename = file.filename or "avatar.jpg"
    ext = Path(filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise ValidationFailedError(
            "Only JPG, JPEG, PNG, and WebP images are allowed.",
            code="INVALID_IMAGE_FORMAT",
            details=[{"field": "file", "code": "INVALID_IMAGE_FORMAT", "message": "Unsupported file extension"}],
        )

    # Read content up to max size + 1
    content = await file.read(settings.AVATAR_MAX_FILE_BYTES + 1)
    if len(content) > settings.AVATAR_MAX_FILE_BYTES:
        max_mb = settings.AVATAR_MAX_FILE_BYTES // (1024 * 1024)
        raise ValidationFailedError(
            f"Profile picture must be {max_mb} MB or smaller.",
            code="FILE_TOO_LARGE",
            details=[{"field": "file", "code": "FILE_TOO_LARGE", "message": f"File exceeds {max_mb} MB limit"}],
        )

    # Validate magic bytes
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"

    if not (is_jpeg or is_png or is_webp):
        raise ValidationFailedError(
            "Invalid image file contents. Only valid JPG, PNG, and WebP images are accepted.",
            code="INVALID_IMAGE_FORMAT",
            details=[{"field": "file", "code": "INVALID_IMAGE_FORMAT", "message": "Corrupted or invalid image header"}],
        )

    # Save to storage dir
    settings.AVATAR_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    saved_name = f"{uuid7()}{ext if ext != '.jpeg' else '.jpg'}"
    dest = settings.AVATAR_STORAGE_DIR / saved_name
    dest.write_bytes(content)

    return AvatarUploadResponse(avatar_url=f"/api/v1/users/avatar/{saved_name}")


@router.get(
    "/avatar/{filename}",
    response_class=FileResponse,
    summary="Get profile picture image",
    description="Serves an uploaded avatar image with caching and security headers.",
    responses=errors(404),
)
async def get_avatar(
    filename: str,
    service: UserServiceDep,
) -> FileResponse:
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", filename) or ".." in filename:
        raise NotFoundError("Avatar image not found.")

    settings = service.settings
    file_path = settings.AVATAR_STORAGE_DIR / filename
    if not file_path.is_file():
        raise NotFoundError("Avatar image not found.")

    ext = file_path.suffix.lower()
    mime = "image/png" if ext == ".png" else "image/webp" if ext == ".webp" else "image/jpeg"
    return FileResponse(
        file_path,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )



@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get my profile",
    responses=errors(401),
)
async def get_me(auth: CurrentAuthAllowingPasswordChange, service: UserServiceDep) -> UserResponse:
    user = await service.get_me(auth.user)
    return UserResponse(message="Profile retrieved successfully.", user=UserOut.from_model(user, auth.user))


@router.get(
    "/me/permissions",
    response_model=PermissionsResponse,
    summary="What I can do",
    description="Menu sections, visible and creatable roles, list filters and other rights of the signed-in person. "
    "Clients show screens and buttons from this instead of re-implementing rules; every request is still checked.",
    responses=errors(401),
)
async def my_permissions(auth: CurrentAuth, db: DbSession) -> PermissionsResponse:
    return PermissionsResponse(
        message="Permissions retrieved successfully.",
        permissions=PermissionsOut.model_validate(
            capabilities.my_permissions(auth.user, await PermissionService(db).effective_for(auth.user))
        ),
    )


@router.get(
    "/form-options",
    response_model=UserFormOptionsResponse,
    summary="Options for the create/edit user form",
    description="Roles you may choose and, for the chosen `role`, which sections and fields apply and which are required. "
    "Pass `user_id` when editing. Call again when the role changes.",
    responses=errors(401, 404, 422),
)
async def user_form_options(
    auth: CurrentAuth,
    service: UserServiceDep,
    role: Annotated[str | None, Query(description="Role being filled in", examples=["staff"])] = None,
    user_id: Annotated[str | None, Query(description="User being edited")] = None,
) -> UserFormOptionsResponse:
    target = None
    if user_id is not None:
        target = await service.get_user(auth.user, await user_id_path(user_id))
    options = capabilities.user_form_options(auth.user, service.settings, role=role, target=target)
    val = UserFormOptionsOut.model_validate(options)
    return UserFormOptionsResponse(
        message="Form options retrieved successfully.", options=val, form_options=val
    )


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update my contact details",
    description="Users can change their own phone numbers, language, time zone and address. "
    "Names, date of birth and role are managed by their institution.",
    responses=errors(401, 403, 422),
)
async def update_me(body: MyProfileUpdate, auth: CurrentAuth, service: UserServiceDep) -> UserResponse:
    user = await service.update_my_profile(auth.user, body)
    return UserResponse(message="Profile updated successfully.", user=UserOut.from_model(user, auth.user))


@router.post(
    "",
    response_model=UserCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
    description="Create an admin, institution head, staff member or student within your part of the hierarchy. "
    "`credentials` says how the person gets access: an emailed set-up link, the initial password you set, or a "
    "temporary password generated for a student without email (returned only in this response).",
    responses=errors(403, 404, 409, 422),
)
async def create_user(
    body: Annotated[UserCreate, Body(openapi_examples=examples.CREATE_USER)],
    auth: CurrentAuth,
    service: UserServiceDep,
) -> UserCreatedResponse:
    user, prepared = await service.create_user(auth.user, body)
    return UserCreatedResponse(
        message="User created successfully.",
        user=UserOut.from_model(user, auth.user),
        credentials=credentials_out(prepared, service.settings),
    )


def credentials_out(prepared: PreparedUser, settings: Settings | None = None) -> CredentialsOut:
    if prepared.password_generated:
        return CredentialsOut(
            delivery="temporary_password",
            temporary_password=prepared.password,
            message="Temporary password generated. Share it securely with the user."
        )
    if prepared.password:
        return CredentialsOut(
            delivery="initial_password",
            message="Initial password set. Share it securely with the user."
        )
    email_sent = bool(settings and settings.EMAIL_BACKEND != "console")
    setup_link = (
        f"{settings.frontend_url(settings.FRONTEND_ACCOUNT_SETUP_PATH)}?token={prepared.setup_token}"
        if settings and prepared.setup_token
        else None
    )
    return CredentialsOut(
        delivery="email_link",
        email_sent=email_sent,
        setup_link=setup_link,
        message="An account set-up email has been queued." if email_sent else "Email delivery is in console mode. Use the setup link below.",
    )


@router.get(
    "",
    response_model=UserListResponse,
    summary="List users",
    description="Only users you are allowed to see are returned. `search_text` matches name, email, username, "
    "phone, employee code and admission number.",
    responses=errors(401, 403, 422),
)
async def list_users(
    query: Annotated[UserListQuery, Query()], auth: CurrentAuth, service: UserServiceDep
) -> UserListResponse:
    items, total, is_exact = await service.list_users(auth.user, query)
    return UserListResponse(
        message="Users retrieved successfully.",
        users=[UserListItem.from_model(user, auth.user) for user in items],
        page_context=PageContext.build(
            page=query.page,
            per_page=query.per_page,
            total=total,
            is_exact=is_exact,
            sort_column=query.sort_column,
            sort_order=query.sort_order,
        ),
    )


@router.get(
    "/import/template",
    response_class=Response,
    summary="Download the import template (CSV)",
    responses={200: {"description": "CSV template with example rows", "content": {"text/csv": {}}}},
)
async def import_template(auth: CurrentAuth) -> Response:
    return Response(
        content=template_csv().encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="user-import-template.csv"'},
    )


@router.post(
    "/import",
    response_model=ImportResponse,
    summary="Import users from CSV",
    description="Upload a CSV based on the template. Each row follows the same rules as `POST /users`. "
    "Use `dry_run=true` to validate first. `mode=all_or_nothing` creates every row or none; "
    "`skip_invalid` creates valid rows and reports the rest. Imported users receive an account set-up email.",
    dependencies=[Depends(rate_limit("import", "IMPORT_RATE_LIMIT_PER_HOUR", 3600))],
    responses=errors(400, 401, 403, 422, 429),
)
async def import_users(
    auth: CurrentAuth,
    service: UserServiceDep,
    file: Annotated[UploadFile, File(description="CSV file (UTF-8)")],
    dry_run: Annotated[bool, Form()] = False,
    mode: Annotated[ImportMode, Form()] = ImportMode.ALL_OR_NOTHING,
) -> ImportResponse:
    if not policies.allowed_target_roles(auth.user, Action.CREATE):
        raise PermissionDeniedError("You are not allowed to create users.")
    settings = service.settings
    content = await file.read(settings.IMPORT_MAX_FILE_BYTES + 1)
    result = await ImportService(service).import_users(auth.user, content, dry_run=dry_run, mode=mode)
    if dry_run:
        message = f"Validation finished: {result['valid_rows']} valid, {result['invalid_rows']} invalid row(s)."
    elif result["created"] == 0 and result["errors"]:
        message = "Nothing was imported. Fix the errors and upload again."
    else:
        message = f"Import finished: {result['created']} created, {result['invalid_rows']} failed."
    return ImportResponse(message=message, import_result=ImportResultOut.model_validate(result))


@router.post(
    "/import-jobs",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Import a large CSV in the background",
    description="Same rules and columns as `POST /users/import`, for files up to 50,000 rows. The job appears under "
    "`GET /jobs`; when it completes you are emailed and can download a report with one line per created user "
    "(including temporary passwords for students without email) and per problem.",
    dependencies=[Depends(rate_limit("import", "IMPORT_RATE_LIMIT_PER_HOUR", 3600))],
    responses=errors(400, 401, 403, 422, 429),
)
async def create_import_job(
    auth: CurrentAuth,
    service: UserServiceDep,
    jobs: JobServiceDep,
    file: Annotated[UploadFile, File(description="CSV file (UTF-8)")],
    dry_run: Annotated[bool, Form()] = False,
    mode: Annotated[ImportMode, Form()] = ImportMode.ALL_OR_NOTHING,
) -> JobResponse:
    if not policies.allowed_target_roles(auth.user, Action.CREATE):
        raise PermissionDeniedError("You are not allowed to create users.")
    content = await file.read(service.settings.IMPORT_JOB_MAX_FILE_BYTES + 1)
    job = await jobs.create_import_job(auth.user, content, mode=mode.value, dry_run=dry_run)
    return JobResponse(message="Import queued. You will be emailed when it has finished.", job=JobOut.from_model(job))


@router.post(
    "/export-jobs",
    response_model=JobResponse,
    summary="Export users in the background",
    description="For very large exports. Same filters as `GET /users` (query string). Returns a job; "
    "the requester is emailed when the file is ready at `GET /jobs/{job_id}/download`.",
    dependencies=[Depends(rate_limit("export", "EXPORT_RATE_LIMIT_PER_HOUR", 3600))],
    responses=errors(401, 403, 422, 429),
    status_code=202,
)
async def create_user_export_job(
    query: Annotated[UserExportQuery, Query()],
    auth: CurrentAuth,
    service: UserServiceDep,
    jobs: JobServiceDep,
) -> JobResponse:
    await service.filter_conditions(
        auth.user, query, action=Action.EXPORT
    )  # fail fast on filters the caller may not use
    job = await jobs.create_export_job(auth.user, JobType.USER_EXPORT, query)
    return JobResponse(message="Export queued. You will be emailed when it is ready.", job=JobOut.from_model(job))


@router.get(
    "/export",
    response_class=StreamingResponse,
    summary="Export users (CSV)",
    description="Accepts the same filters as `GET /users` and exports every matching user you are allowed to see "
    "(up to EXPORT_MAX_ROWS). Every export is recorded in the audit log.",
    dependencies=[Depends(rate_limit("export", "EXPORT_RATE_LIMIT_PER_HOUR", 3600))],
    responses={
        200: {
            "description": "CSV file (UTF-8 with BOM), streamed",
            "content": {"text/csv": {"schema": {"type": "string", "format": "binary"}}},
        },
        **errors(401, 403, 422, 429),
    },
)
async def export_users(
    query: Annotated[UserExportQuery, Query()],
    auth: CurrentAuth,
    service: UserServiceDep,
    settings: SettingsDep,
    request: Request,
) -> StreamingResponse:
    conditions = await service.prepare_export(auth.user, query)
    return csv_response(request, settings, conditions, "users")


@router.get("/{user_id}", response_model=UserResponse, summary="Get a user", responses=errors(401, 403, 404))
async def get_user(user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep) -> UserResponse:
    user = await service.get_user(auth.user, user_id)
    return UserResponse(message="User retrieved successfully.", user=UserOut.from_model(user, auth.user))


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user",
    description="Partial update: only the sections and fields you send are changed. Send `null` to clear an "
    "optional value. Changing role or institution signs the user out.",
    responses=errors(401, 403, 404, 409, 422),
)
async def update_user(
    user_id: UserIdParam,
    body: Annotated[UserUpdate, Body(openapi_examples=examples.UPDATE_USER)],
    auth: CurrentAuth,
    service: UserServiceDep,
) -> UserResponse:
    user = await service.update_user(auth.user, user_id, body)
    return UserResponse(message="User updated successfully.", user=UserOut.from_model(user, auth.user))


@router.put(
    "/{user_id}/avatar",
    response_model=UserResponse,
    summary="Set a profile photo",
    description="Send the picture itself as the request body (PNG, JPEG or WebP, small). You may set your own, or the photo of anyone you may edit.",
    responses=errors(401, 403, 404, 422),
    openapi_extra=PICTURE_BODY,
)
async def set_user_avatar(
    user_id: UserIdParam, request: Request, auth: CurrentAuth, service: UserServiceDep, db: DbSession, settings: SettingsDep
) -> UserResponse:
    images = ImageService(db, settings)
    user = await service.get_user_for_picture(auth.user, user_id)
    data = await read_picture(request, settings)
    await images.put(USER, user.public_id, data)
    user.image_version += 1
    await db.commit()
    return UserResponse(message="Photo saved.", user=UserOut.from_model(user, auth.user))


@router.delete(
    "/{user_id}/avatar",
    response_model=UserResponse,
    summary="Remove a profile photo",
    responses=errors(401, 403, 404),
)
async def delete_user_avatar(
    user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep, db: DbSession, settings: SettingsDep
) -> UserResponse:
    user = await service.get_user_for_picture(auth.user, user_id)
    await ImageService(db, settings).delete(USER, user.public_id)
    user.image_version = 0
    await db.commit()
    return UserResponse(message="Photo removed.", user=UserOut.from_model(user, auth.user))


@router.get(
    "/{user_id}/avatar",
    summary="Get a profile photo",
    description="The picture bytes. Needs the sign-in header, so fetch it and show the result; `v` is only a cache-buster.",
    responses={**errors(401, 403, 404), 200: {"content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}}}},
    response_class=Response,
)
async def get_user_avatar(
    user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep, db: DbSession, settings: SettingsDep
) -> Response:
    user = await service.get_user(auth.user, user_id)
    image = await ImageService(db, settings).get(USER, user.public_id)
    if image is None:
        raise NotFoundError("This person has no photo.", code="IMAGE_NOT_FOUND")
    return Response(image.data, media_type=image.content_type, headers=PICTURE_HEADERS)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or suspend a user",
    description="A suspended user keeps their data but cannot log in, and is signed out immediately.",
    responses=errors(401, 403, 404, 422),
)
async def change_user_status(
    user_id: UserIdParam, body: StatusUpdate, auth: CurrentAuth, service: UserServiceDep
) -> UserResponse:
    user = await service.change_status(auth.user, user_id, body.status, body.reason)
    verb = "suspended" if body.status == "suspended" else "activated"
    return UserResponse(message=f"User {verb} successfully.", user=UserOut.from_model(user, auth.user))


@router.delete(
    "/{user_id}",
    response_model=SuccessResponse,
    summary="Delete a user",
    description="Deactivates and hides the user permanently. The record is kept for audit history.",
    responses=errors(401, 403, 404, 409),
)
async def delete_user(user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep) -> SuccessResponse:
    await service.delete_user(auth.user, user_id)
    return SuccessResponse(message="User deleted successfully.")


@router.post(
    "/{user_id}/revoke",
    response_model=SuccessResponse,
    summary="Sign a user out everywhere",
    description="Ends all of the user's sessions immediately. The account stays active and can log in again.",
    responses=errors(401, 403, 404),
)
async def revoke_user(user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep) -> SuccessResponse:
    revoked = await service.revoke_access(auth.user, user_id)
    return SuccessResponse(message=f"Access revoked. {revoked} active session(s) ended.")


def csv_response(request: Request, settings: SettingsDep, conditions: object, resource: str) -> StreamingResponse:
    stream = export_service.stream_csv(
        request.app.state.sessionmaker,
        export_service.User,
        conditions,  # type: ignore[arg-type]
        export_service.USER_EXPORT_COLUMNS,
        options=export_service.USER_EXPORT_OPTIONS,
        max_rows=settings.EXPORT_MAX_ROWS,
        batch_size=settings.EXPORT_BATCH_SIZE,
    )
    filename = export_service.export_filename(resource)
    return StreamingResponse(
        stream,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{user_id}/password",
    response_model=SuccessResponse,
    summary="Set a temporary password",
    description="For people who cannot use the emailed reset (e.g. students without email). The user must choose a "
    "new password at next sign-in, and all their sessions end.",
    responses=errors(401, 403, 404, 422),
)
async def set_user_password(
    user_id: UserIdParam, body: SetPasswordRequest, auth: CurrentAuth, service: UserServiceDep
) -> SuccessResponse:
    await service.set_password(auth.user, user_id, body.new_password)
    return SuccessResponse(message="Temporary password set. The user must change it at next sign-in.")


@router.post(
    "/{user_id}/mfa/reset",
    response_model=SuccessResponse,
    summary="Reset a user's two-factor authentication",
    description="For a lost or replaced phone. Removes the enrolment and recovery codes and signs the user out.",
    responses=errors(401, 403, 404),
)
async def reset_user_mfa(user_id: UserIdParam, auth: CurrentAuth, service: UserServiceDep) -> SuccessResponse:
    await service.reset_mfa(auth.user, user_id)
    return SuccessResponse(message="Two-factor authentication has been reset. The user must set it up again.")


@router.post(
    "/certificates/upload",
    response_model=CertificateUploadResponse,
    summary="Upload certificate document",
    description="Uploads a PDF, JPG, PNG, or WebP certificate document (max 5 MB) and returns its storage URL.",
    responses=errors(401, 422),
)
async def upload_certificate(
    auth: CurrentAuth,
    service: UserServiceDep,
    file: Annotated[UploadFile, File(description="Certificate document (PDF, JPG, PNG, WebP)")],
) -> CertificateUploadResponse:
    settings = service.settings
    filename = file.filename or "certificate.pdf"
    ext = Path(filename).suffix.lower()
    if ext not in {".pdf", ".jpg", ".jpeg", ".png", ".webp"}:
        raise ValidationFailedError(
            "Only PDF, JPG, JPEG, PNG, and WebP documents are allowed.",
            code="INVALID_DOCUMENT_FORMAT",
            details=[{"field": "file", "code": "INVALID_DOCUMENT_FORMAT", "message": "Unsupported file extension"}],
        )

    content = await file.read(settings.CERTIFICATE_MAX_FILE_BYTES + 1)
    if len(content) > settings.CERTIFICATE_MAX_FILE_BYTES:
        max_mb = settings.CERTIFICATE_MAX_FILE_BYTES // (1024 * 1024)
        raise ValidationFailedError(
            f"Certificate document must be {max_mb} MB or smaller.",
            code="FILE_TOO_LARGE",
            details=[{"field": "file", "code": "FILE_TOO_LARGE", "message": f"File exceeds {max_mb} MB limit"}],
        )

    is_pdf = content.startswith(b"%PDF")
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"

    if not (is_pdf or is_jpeg or is_png or is_webp):
        raise ValidationFailedError(
            "Invalid file contents. Only valid PDF, JPG, PNG, and WebP documents are accepted.",
            code="INVALID_DOCUMENT_FORMAT",
            details=[{"field": "file", "code": "INVALID_DOCUMENT_FORMAT", "message": "Corrupted or invalid file header"}],
        )

    settings.CERTIFICATE_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    saved_name = f"{uuid7()}{ext if ext != '.jpeg' else '.jpg'}"
    dest = settings.CERTIFICATE_STORAGE_DIR / saved_name
    dest.write_bytes(content)

    return CertificateUploadResponse(
        document_url=f"/api/v1/users/certificates/{saved_name}",
        filename=filename,
    )


@router.get(
    "/certificates/{filename}",
    response_class=FileResponse,
    summary="Get certificate document",
    description="Serves an uploaded certificate document to authenticated users.",
    responses=errors(401, 404),
)
async def get_certificate(
    filename: str,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> FileResponse:
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", filename) or ".." in filename:
        raise NotFoundError("Certificate document not found.")

    dest = service.settings.CERTIFICATE_STORAGE_DIR / filename
    if not dest.is_file():
        raise NotFoundError("Certificate document not found.")

    ext = dest.suffix.lower()
    media_type = "application/pdf" if ext == ".pdf" else f"image/{ext.lstrip('.')}"
    return FileResponse(dest, media_type=media_type)
