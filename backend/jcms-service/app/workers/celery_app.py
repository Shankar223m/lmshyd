import logging
from celery import Celery
from celery.schedules import crontab
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.integrations.email.smtp import send_email
from app.models.entities import OutboxEvent, User

logger = logging.getLogger(__name__)

celery_app = Celery("jcms", broker=settings.celery_broker_url, backend=settings.celery_result_backend)
celery_app.conf.task_routes = {"app.workers.celery_app.*": {"queue": "default"}}
celery_app.conf.beat_schedule = {
    "process-outbox-every-minute": {
        "task": "app.workers.celery_app.process_outbox",
        "schedule": crontab(minute="*/1"),
    },
}


@celery_app.task(name="app.workers.celery_app.process_outbox")
def process_outbox():
    db = SessionLocal()
    try:
        events = db.scalars(
            select(OutboxEvent).where(OutboxEvent.processed == False).limit(50)  # noqa: E712
        ).all()
        processed_count = 0
        for ev in events:
            payload = ev.payload or {}
            user_id = payload.get("user_id")
            user = db.get(User, user_id) if user_id else None
            if user and user.email:
                send_email_notification.delay(
                    user.email,
                    payload.get("title", "JCMS notification"),
                    payload.get("body", ""),
                )
            ev.processed = True
            processed_count += 1
        db.commit()
        return {"processed": processed_count}
    except Exception as e:
        db.rollback()
        logger.error("Failed processing outbox events: %s", e)
        raise
    finally:
        db.close()


@celery_app.task(name="app.workers.celery_app.send_email_notification")
def send_email_notification(to_email: str, subject: str, body: str):
    try:
        return send_email(to_email, subject, body)
    except Exception as exc:
        logger.exception("Email delivery failed: %s", exc)
        raise
