from datetime import timedelta

from lms_common.pagination import paginate
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.core.ids import new_public_id
from app.core.time import utcnow
from app.db.session import commit_or_conflict
from app.domain.enums import SubscriptionStatus
from app.entitlements.cache import remove_entitlement, sync_entitlement
from app.models.subscription import Subscription
from app.schemas.common import ListQuery
from app.services.course_ref_service import CourseRefService
from app.services.institution_ref_service import InstitutionRefService
from app.services.outbox import write_event


def _lifecycle_payload(subscription: Subscription) -> dict[str, str]:
    """Which institution and course a lifecycle event is about, so consumers need not call back."""
    return {
        "subscription_id": str(subscription.public_id),
        "organization_id": str(subscription.organization_id),
        "course_id": str(subscription.course_id),
    }


class SubscriptionService:
    def __init__(self, db: AsyncSession, settings: Settings, redis: Redis) -> None:
        self.db = db
        self.settings = settings
        self.redis = redis

    async def get(self, subscription_id: int) -> Subscription:
        subscription = (
            await self.db.execute(select(Subscription).where(Subscription.public_id == subscription_id))
        ).scalar_one_or_none()
        if subscription is None:
            raise NotFoundError("Subscription not found.", code="SUBSCRIPTION_NOT_FOUND")
        return subscription

    async def grant(
        self,
        actor_user_id: int,
        *,
        organization_id: int,
        course_id: int,
        seats: int,
        term_days: int,
    ) -> Subscription:
        """Platform admin assigns course access to an institution (optional at course creation)."""
        await InstitutionRefService(self.db).get_active(organization_id)
        await CourseRefService(self.db).ensure_exists(course_id)

        existing_sub = (
            await self.db.execute(
                select(Subscription).where(
                    Subscription.organization_id == organization_id,
                    Subscription.course_id == course_id,
                    Subscription.status == SubscriptionStatus.ACTIVE,
                )
            )
        ).scalar_one_or_none()
        if existing_sub is not None:
            return existing_sub

        now = utcnow()
        subscription = Subscription(
            public_id=new_public_id(),
            organization_id=organization_id,
            course_id=course_id,
            course_request_id=None,
            seats_total=seats,
            starts_at=now,
            ends_at=now + timedelta(days=term_days),
            created_by=actor_user_id,
        )
        self.db.add(subscription)
        await commit_or_conflict(self.db, "This institution already has an active subscription to this course.")
        write_event(
            self.db,
            event_type="subscription.activated",
            aggregate_id=subscription.id,
            payload={
                **(_lifecycle_payload(subscription)),
                "seats_total": subscription.seats_total,
                "ends_at": subscription.ends_at.isoformat(),
                "source": "admin_grant",
            },
        )
        await self.db.commit()
        await sync_entitlement(self.redis, key_prefix=self.settings.ENTITLEMENT_KEY_PREFIX, subscription=subscription)
        return subscription

    async def list_subscriptions(self, query: ListQuery, *, organization_ids: tuple[int, ...] | None) -> tuple[list[Subscription], int, bool]:
        stmt = select(Subscription)
        if organization_ids is not None:  # None: every institution
            stmt = stmt.where(Subscription.organization_id.in_(organization_ids))
        if query.status:
            stmt = stmt.where(Subscription.status == query.status)
        stmt = stmt.order_by(
            Subscription.created_at.desc() if query.sort_order == "desc" else Subscription.created_at.asc()
        )
        return await paginate(self.db, stmt, query.page, query.per_page)

    async def cancel(self, subscription: Subscription, reason: str) -> Subscription:
        if subscription.status != SubscriptionStatus.ACTIVE:
            raise BadRequestError("Only an active subscription can be cancelled.", code="SUBSCRIPTION_NOT_ACTIVE")

        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelled_at = utcnow()
        subscription.cancelled_reason = reason
        write_event(
            self.db,
            event_type="subscription.cancelled",
            aggregate_id=subscription.id,
            payload={**_lifecycle_payload(subscription), "reason": reason},
        )
        await self.db.commit()
        await remove_entitlement(
            self.redis,
            key_prefix=self.settings.ENTITLEMENT_KEY_PREFIX,
            organization_id=subscription.organization_id,
            course_id=subscription.course_id,
        )
        return subscription

    async def expire_due(self) -> int:
        """Housekeeping (see app/worker/runner.py): term-based expiry has no triggering event —
        someone has to notice ``ends_at`` has passed. Returns how many were expired."""
        due = list(
            (
                await self.db.execute(
                    select(Subscription).where(
                        Subscription.status == SubscriptionStatus.ACTIVE, Subscription.ends_at <= utcnow()
                    )
                )
            )
            .scalars()
            .all()
        )
        for subscription in due:
            subscription.status = SubscriptionStatus.EXPIRED
            write_event(
                self.db,
                event_type="subscription.expired",
                aggregate_id=subscription.id,
                payload=_lifecycle_payload(subscription),
            )
        if due:
            await self.db.commit()
            for subscription in due:
                await remove_entitlement(
                    self.redis,
                    key_prefix=self.settings.ENTITLEMENT_KEY_PREFIX,
                    organization_id=subscription.organization_id,
                    course_id=subscription.course_id,
                )
        return len(due)
