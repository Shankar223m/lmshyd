
"""Schemas for RBAC specific audit log retrieval."""

from typing import Literal

from pydantic import Field

from app.schemas.common import ListQuery, PageContext, SuccessResponse
from app.schemas.summaries import InstitutionRef, UserRef
from app.schemas.audit import AuditLogOut
from app.permissions.roles import Role


class RBACAuditLogFilter(ListQuery):
    """Query parameters for RBAC-specific audit logs."""

    actor_user_id: int | None = Field(
        default=None,
        description="Actor user public ID",
    )
    target_user_id: int | None = Field(
        default=None,
        description="Target user public ID (subject of permission change)",
    )
    institution_id: int | None = Field(
        default=None,
        description="Institution public ID",
    )
    actor_role: Role | None = Field(
        default=None,
        description="Role of the actor (SUPER_ADMIN, ADMIN, etc.)",
    )
    permission_key: str | None = Field(
        default=None,
        max_length=200,
        description="Permission key affected",
    )
    delegation_capability: Literal["INHERIT", "ALLOW", "DENY"] | None = Field(
        default=None,
        description="Delegation flag used",
    )
    outcome: Literal["SUCCESS", "FAILURE"] | None = Field(
        default=None,
        description="Result of the operation",
    )
    created_from: str | None = Field(
        default=None,
        max_length=10,
        description="YYYY-MM-DD start date (UTC)",
    )
    created_to: str | None = Field(
        default=None,
        max_length=10,
        description="YYYY-MM-DD end date (UTC)",
    )


class RBACAuditLogListResponse(SuccessResponse):
    audit_logs: list[AuditLogOut]
    page_context: PageContext
