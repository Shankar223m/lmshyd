from typing import Any
import html
from app.schemas.audit_metadata import METADATA_SCHEMA_MAP

def _sanitize(details: dict[str, Any] | None, default_action: str | None = None) -> dict[str, Any] | None:
    if not details or not isinstance(details, dict):
        return None
    action = details.get("_action") or default_action or ""
    if not action or "." not in action:
        return None
    prefix = action.split(".", 1)[0]
    schema_cls = METADATA_SCHEMA_MAP.get(prefix)
    if not schema_cls:
        return None
    allowed_keys = set(schema_cls.model_fields.keys())
    sanitized: dict[str, Any] = {}
    for k, v in details.items():
        if k not in allowed_keys:
            continue
        if isinstance(v, str):
            v_esc = html.escape(v, quote=False)
            if len(v) > 200:
                v_esc = html.escape(v[:200], quote=False) + "..."
            sanitized[k] = v_esc
        elif isinstance(v, list):
            sanitized[k] = v[:20]
        elif isinstance(v, dict):
            sanitized[k] = dict(list(v.items())[:20])
        else:
            sanitized[k] = v
    return sanitized

"""Reading the audit trail, scoped to the viewer's part of the hierarchy."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import ColumnElement, false, or_, select, and_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.core.time import utcnow,  start_of_day
from app.models.audit_log import AuditLog
from app.models.institution import Institution
from app.models.job import BackgroundJob
from app.models.session import UserSession
from app.models.user import User
from app.permissions.roles import Role
from app.schemas.audit import AuditLogListQuery, AuditLogOut, AuditTargetOut
from app.schemas.rbac_audit import RBACAuditLogFilter
from app.schemas.summaries import InstitutionRef, UserRef
from app.utils.query import contains_pattern, paginate

VIEWER_ROLES = frozenset({Role.SUPER_ADMIN, Role.ADMIN, Role.INSTITUTION_HEAD})


class AuditLogService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_logs(self, actor: User, query: AuditLogListQuery) -> tuple[list[AuditLogOut], int, bool]:
        conditions = await self._conditions(actor, query)
        if conditions is None:
            return [], 0, True
        stmt = select(AuditLog).where(*conditions).order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        if query.sort_order == "asc":
            stmt = stmt.order_by(None).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
        logs, total, is_exact = await paginate(self.db, stmt, query.page, query.per_page)
        return await self._to_out(logs), total, is_exact

    async def get_log(self, actor: User, log_id: uuid.UUID) -> AuditLogOut | None:
        """Retrieve a single audit log entry by its public_id, respecting viewer permissions."""
        # Build a minimal query to check access
        base_query = AuditLogListQuery(
            page=1,
            per_page=1,
            sort_order="desc",
            category=None,
            action=None,
            actor_user_id=None,
            user_id=None,
            organization_id=None,
            created_from=None,
            created_to=None,
            search_text=None,
        )
        conditions = await self._conditions(actor, base_query)
        if conditions is None:
            return None
        conditions.append(AuditLog.public_id == log_id)
        stmt = select(AuditLog).where(*conditions)
        result = await self.db.execute(stmt)
        log = result.scalar_one_or_none()
        if not log:
            return None
        return (await self._to_out([log]))[0]


    # ------------------------------------------------------------------ scope and filters

    async def _conditions(self, actor: User, query: AuditLogListQuery) -> list[ColumnElement[bool]] | None:
        if actor.role not in VIEWER_ROLES:
            raise PermissionDeniedError("You are not allowed to view the audit log.")
        conditions: list[ColumnElement[bool]] = []

        if actor.role == Role.ADMIN:
            owned = select(Institution.id).where(Institution.admin_id == actor.id)
            conditions.append(or_(AuditLog.institution_id.in_(owned), AuditLog.actor_id == actor.id))
        elif actor.role == Role.INSTITUTION_HEAD:
            conditions.append(AuditLog.institution_id == actor.institution_id if actor.institution_id else false())

        # older rows from when every token refresh was logged: routine noise, never shown
        conditions.append(AuditLog.action != "auth.token_refreshed")
        if query.category:
            conditions.append(AuditLog.action.like(contains_pattern(f"{query.category}.")[1:]))
        if query.action:
            conditions.append(AuditLog.action == query.action)
        if query.actor_user_id is not None:
            person = await self._user_uuid(query.actor_user_id)
            if person is None:
                return None
            conditions.append(AuditLog.actor_id == person)
        if query.user_id is not None:
            person = await self._user_uuid(query.user_id)
            if person is None:
                return None
            conditions.append(
                or_(AuditLog.actor_id == person, (AuditLog.resource_type == "user") & (AuditLog.resource_id == person))
            )
        if query.organization_id is not None:
            institution = (
                await self.db.execute(select(Institution.id).where(Institution.public_id == query.organization_id))
            ).scalar_one_or_none()
            if institution is None:
                return None
            conditions.append(AuditLog.institution_id == institution)
        if query.created_from:
            conditions.append(AuditLog.created_at >= start_of_day(query.created_from))
        if query.created_to:
            conditions.append(AuditLog.created_at < start_of_day(query.created_to + timedelta(days=1)))
        if query.search_text:
            conditions.append(AuditLog.action.like(contains_pattern(query.search_text.lower()), escape="\\"))
        return conditions

    async def _user_uuid(self, public_id: int) -> uuid.UUID | None:
        return (await self.db.execute(select(User.id).where(User.public_id == public_id))).scalar_one_or_none()

    # ------------------------------------------------------------------ output (batched lookups, no N+1)

    async def _to_out(self, logs: list[AuditLog]) -> list[AuditLogOut]:
        def ids(kind: str) -> set[uuid.UUID]:
            return {log.resource_id for log in logs if log.resource_type == kind and log.resource_id}

        user_ids = {log.actor_id for log in logs if log.actor_id} | ids("user")
        institution_ids = {log.institution_id for log in logs if log.institution_id} | ids("institution")
        users = await self._by_id(User, user_ids)
        institutions = await self._by_id(Institution, institution_ids)
        sessions = await self._by_id(UserSession, ids("session"))
        jobs = await self._by_id(BackgroundJob, ids("job"))

        def target(log: AuditLog) -> AuditTargetOut | None:
            if not log.resource_type:
                return None
            record = {"user": users, "institution": institutions, "session": sessions, "job": jobs}.get(
                log.resource_type, {}
            ).get(
                log.resource_id  # type: ignore[arg-type]
            )
            name = (
                record.full_name
                if isinstance(record, User)
                else record.name
                if isinstance(record, Institution)
                else None
            )
            return AuditTargetOut(type=log.resource_type, id=getattr(record, "public_id", None), name=name)

        return [
            AuditLogOut(
                audit_log_id=log.public_id,
                time=log.created_at or utcnow(),
                action=log.action,
                category=log.action.split(".", 1)[0],
                actor=UserRef.of(users.get(log.actor_id)) if log.actor_id else None,  # type: ignore[arg-type]
                target=target(log),
                institution=InstitutionRef.of(institutions.get(log.institution_id)) if log.institution_id else None,  # type: ignore[arg-type]
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                request_id=log.request_id,
                details=_sanitize(log.details, log.action),
            )
            for log in logs
        ]

    async def _by_id(self, model: type, ids: set[uuid.UUID]) -> dict[uuid.UUID, object]:
        if not ids:
            return {}
        rows: Any = await self.db.execute(select(model).where(model.id.in_(ids)))  # type: ignore[attr-defined]
        return {row.id: row for row in rows.scalars()}
