"""LMS compose worker entry — runs Celery worker for JCMS outbox/email."""

from app.workers.celery_app import celery_app

if __name__ == "__main__":
    celery_app.worker_main(argv=["worker", "--loglevel=INFO", "-Q", "default"])
