from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query, status

from app.api.deps import (
    CurrentAuth,
    SuperAdminIdParam,
    UserServiceDep,
    require_roles,
)
from app.api.responses import errors
from app.api.v1.endpoints.users import credentials_out
from app.models.user import User
from app.permissions.roles import Role
from app.schemas.common import PageContext, SuccessResponse
from app.schemas.user import (
    SetPasswordRequest,
    StatusUpdate,
    SuperAdminCreate,
    SuperAdminCreatedResponse,
    SuperAdminListItem,
    SuperAdminListQuery,
    SuperAdminListResponse,
    SuperAdminOut,
    SuperAdminResponse,
    SuperAdminUpdate,
    UserListItem,
    UserListQuery,
    UserOut,
)

router = APIRouter(
    prefix="/super-admins",
    tags=["Super Admins"],
    dependencies=[Depends(require_roles(Role.SUPER_ADMIN))],
    responses=errors(401, 403),
)


def _super_admin_out(user: User, actor: User) -> SuperAdminOut:
    return SuperAdminOut(
        **UserOut.from_model(user, actor).model_dump(),
    )


@router.post(
    "",
    response_model=SuperAdminCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a super admin",
    description="Super admins only. Without `account.password`, an account set-up link is emailed.",
    responses=errors(409, 422),
)
async def create_super_admin(
    body: Annotated[SuperAdminCreate, Body()],
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuperAdminCreatedResponse:
    user, prepared = await service.create_user(auth.user, body.to_user_create())
    return SuperAdminCreatedResponse(
        message="Super Admin created successfully.",
        super_admin=_super_admin_out(user, auth.user),
        credentials=credentials_out(prepared),
    )


@router.get("", response_model=SuperAdminListResponse, summary="List super admins", responses=errors(422))
async def list_super_admins(
    query: Annotated[SuperAdminListQuery, Query()],
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuperAdminListResponse:
    user_query = query.as_user_filters(UserListQuery)
    items, total, is_exact = await service.list_users(auth.user, user_query, only_role=Role.SUPER_ADMIN)  # type: ignore[arg-type]
    return SuperAdminListResponse(
        message="Super Admins retrieved successfully.",
        super_admins=[
            SuperAdminListItem(
                **UserListItem.from_model(user, auth.user).model_dump(),
            )
            for user in items
        ],
        page_context=PageContext.build(
            page=query.page,
            per_page=query.per_page,
            total=total,
            is_exact=is_exact,
            sort_column=query.sort_column,
            sort_order=query.sort_order,
        ),
    )


@router.get("/{user_id}", response_model=SuperAdminResponse, summary="Get a super admin", responses=errors(404))
async def get_super_admin(
    user_id: SuperAdminIdParam,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuperAdminResponse:
    user = await service.get_user(auth.user, user_id, expected_role=Role.SUPER_ADMIN)
    return SuperAdminResponse(
        message="Super Admin retrieved successfully.",
        super_admin=_super_admin_out(user, auth.user),
    )


@router.put(
    "/{user_id}",
    response_model=SuperAdminResponse,
    summary="Update a super admin",
    description="Partial update: only the sections and fields you send are changed.",
    responses=errors(404, 409, 422),
)
async def update_super_admin(
    user_id: SuperAdminIdParam,
    body: SuperAdminUpdate,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuperAdminResponse:
    user = await service.update_user(auth.user, user_id, body.to_user_update(), expected_role=Role.SUPER_ADMIN)
    return SuperAdminResponse(
        message="Super Admin updated successfully.",
        super_admin=_super_admin_out(user, auth.user),
    )


@router.patch(
    "/{user_id}/status",
    response_model=SuperAdminResponse,
    summary="Activate or suspend a super admin",
    responses=errors(404, 409, 422),
)
async def change_super_admin_status(
    user_id: SuperAdminIdParam,
    body: StatusUpdate,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuperAdminResponse:
    user = await service.change_status(auth.user, user_id, body.status, body.reason, expected_role=Role.SUPER_ADMIN)
    verb = "suspended" if body.status == "suspended" else "activated"
    return SuperAdminResponse(
        message=f"Super Admin {verb} successfully.",
        super_admin=_super_admin_out(user, auth.user),
    )


@router.delete(
    "/{user_id}",
    response_model=SuccessResponse,
    summary="Delete a super admin",
    description="Refused with `LAST_SUPER_ADMIN` if attempting to delete the last active super admin.",
    responses=errors(404, 409),
)
async def delete_super_admin(
    user_id: SuperAdminIdParam,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuccessResponse:
    await service.delete_user(auth.user, user_id, expected_role=Role.SUPER_ADMIN)
    return SuccessResponse(message="Super Admin deleted successfully.")


@router.post(
    "/{user_id}/revoke",
    response_model=SuccessResponse,
    summary="Sign a super admin out everywhere",
    responses=errors(404),
)
async def revoke_super_admin(
    user_id: SuperAdminIdParam,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuccessResponse:
    revoked = await service.revoke_access(auth.user, user_id, expected_role=Role.SUPER_ADMIN)
    return SuccessResponse(message=f"Access revoked. {revoked} active session(s) ended.")


@router.post(
    "/{user_id}/mfa/reset",
    response_model=SuccessResponse,
    summary="Reset a super admin's two-factor authentication",
    responses=errors(404),
)
async def reset_super_admin_mfa(
    user_id: SuperAdminIdParam,
    auth: CurrentAuth,
    service: UserServiceDep,
) -> SuccessResponse:
    await service.reset_mfa(auth.user, user_id, expected_role=Role.SUPER_ADMIN)
    return SuccessResponse(message="Two-factor authentication has been reset. The super admin must set it up again.")


@router.post(
    "/{user_id}/password",
    response_model=SuccessResponse,
    summary="Set a temporary password for a super admin",
    description="Sets a temporary password. The super admin must change it at next sign-in, and all their sessions end.",
    responses=errors(404, 422),
)
async def set_super_admin_password(
    user_id: SuperAdminIdParam, body: SetPasswordRequest, auth: CurrentAuth, service: UserServiceDep
) -> SuccessResponse:
    await service.set_password(auth.user, user_id, body.new_password, expected_role=Role.SUPER_ADMIN)
    return SuccessResponse(message="Temporary password set. The super admin must change it at next sign-in.")
