from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Notification, OutboxEvent


def notify_user(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    outbox_type: str | None = None,
    dedupe_minutes: int = 30,
) -> None:
    """Create in-app notification; skip duplicate unread same resource+title within window."""
    if dedupe_minutes > 0 and resource_type and resource_id:
        cutoff = datetime.now(UTC) - timedelta(minutes=dedupe_minutes)
        existing = db.scalar(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.title == title,
                Notification.resource_type == resource_type,
                Notification.resource_id == resource_id,
                Notification.read == False,  # noqa: E712
                Notification.created_at >= cutoff,
            )
        )
        if existing:
            return

    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(notif)
    # Flush so same-transaction duplicate notify_user calls see the row for dedupe.
    db.flush()
    if outbox_type:
        db.add(
            OutboxEvent(
                event_type=outbox_type,
                payload={"user_id": user_id, "title": title, "body": body},
            )
        )


def notify_users_for_job(
    db: Session,
    *,
    job_id: str,
    recruiter_ids: list[str],
    title: str,
    body: str,
    resource_type: str,
    resource_id: str,
) -> None:
    for rid in recruiter_ids:
        notify_user(
            db,
            user_id=rid,
            title=title,
            body=body,
            resource_type=resource_type,
            resource_id=resource_id,
        )
