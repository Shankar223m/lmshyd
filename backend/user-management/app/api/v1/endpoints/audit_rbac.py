
"""RBAC audit log retrieval endpoints.

Provides:
- GET /audit/rbac – paginated list with RBAC-specific filters
- GET /audit/rbac/{event_id} – single audit record
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import CurrentAuth, DbSession
from app.api.responses import errors
from app.schemas.common import PageContext
from app.schemas.rbac_audit import (
    RBACAuditLogFilter,
    RBACAuditLogListResponse,
)
from app.services.audit_log_service import AuditLogService


router = APIRouter(
    prefix="/audit/rbac",
    tags=["RBAC Audit"],
    responses=errors(401, 403, 404),
)


@router.get(
    "",
    response_model=RBACAuditLogListResponse,
    summary="List RBAC audit events",
    description="Paginated list of RBAC-related audit log entries with extensive filters.",
    responses=errors(422),
)
async def list_rbac_audit(
    query: Annotated[RBACAuditLogFilter, Query()],
    auth: CurrentAuth,
    db: DbSession,
) -> RBACAuditLogListResponse:
    logs, total, is_exact = await AuditLogService(db).list_rbac_logs(
        auth.user,
        query,
    )

    return RBACAuditLogListResponse(
        message="RBAC audit log retrieved successfully.",
        audit_logs=logs,
        page_context=PageContext.build(
            page=query.page,
            per_page=query.per_page,
            total=total,
            is_exact=is_exact,
            sort_column="created_at",
            sort_order=query.sort_order,
        ),
    )


@router.get(
    "/{event_id}",
    response_model=RBACAuditLogListResponse,
    summary="Get a single RBAC audit event",
    description="Retrieve a specific RBAC audit log entry by its public identifier.",
    responses=errors(404, 422),
)
async def get_rbac_audit_event(
    event_id: str = Path(
        ...,
        description="Audit log public ID (UUID7 string)",
    ),
    auth: CurrentAuth = None,
    db: DbSession = None,
) -> RBACAuditLogListResponse:
    try:
        uid = uuid.UUID(event_id)
    except ValueError:
        raise errors(422)("Invalid event_id format")

    service = AuditLogService(db)
    log = await service.get_log(auth.user, uid)

    if not log:
        raise errors(404)("Audit event not found or access denied")

    return RBACAuditLogListResponse(
        message="RBAC audit event retrieved.",
        audit_logs=[log],
        page_context=PageContext.build(
            page=1,
            per_page=1,
            total=1,
            is_exact=True,
            sort_column="created_at",
            sort_order="desc",
        ),
    )
