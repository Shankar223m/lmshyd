"""Notification dedupe and student discover pagination."""

from datetime import datetime, timedelta, timezone

from app.modules.notifications.service import notify_user


def test_notification_dedupe_skips_duplicate(db_session):
    from app.models.entities import User
    from app.shared.enums import UserRole

    u = User(email="dedupe@example.com", password_hash="x", full_name="D", role=UserRole.STUDENT.value)
    db_session.add(u)
    db_session.flush()
    notify_user(db_session, user_id=u.id, title="T", body="b", resource_type="application", resource_id="app-1", outbox_type=None)
    notify_user(db_session, user_id=u.id, title="T", body="b", resource_type="application", resource_id="app-1", outbox_type=None)
    db_session.commit()
    from sqlalchemy import select, func
    from app.models.entities import Notification

    cnt = db_session.scalar(select(func.count(Notification.id)).where(Notification.user_id == u.id))
    assert cnt == 1


def test_discover_pagination(client, db_session):
    from app.core.security import hash_password
    from app.models.entities import Job, Organization, User
    from app.shared.enums import JobStatus, OrganizationType, UserRole, VerificationStatus

    org = Organization(name="PagCo", org_type=OrganizationType.EMPLOYER.value, verification_status=VerificationStatus.VERIFIED.value)
    db_session.add(org)
    db_session.flush()
    for i in range(3):
        db_session.add(Job(title=f"PagJob {i}", organization_id=org.id, status=JobStatus.PUBLISHED.value, openings=1))
    stu = User(email="pag_stu@example.com", password_hash=hash_password("Test1234!"), full_name="S", role=UserRole.STUDENT.value)
    db_session.add(stu)
    db_session.commit()
    login = client.post("/api/v1/auth/login", json={"email": "pag_stu@example.com", "password": "Test1234!"})
    tok = login.json()["data"]["access_token"]
    r = client.get("/api/v1/jobs/discover?page=1&page_size=2", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert len(r.json()["data"]) <= 2
    assert r.json()["pagination"]["page_size"] == 2


def test_profile_completion_percent(client, db_session):
    client.post("/api/v1/auth/register", json={"email": "pc@example.com", "password": "Test1234!", "full_name": "P", "role": "STUDENT"})
    login = client.post("/api/v1/auth/login", json={"email": "pc@example.com", "password": "Test1234!"})
    tok = login.json()["data"]["access_token"]
    prof = client.get("/api/v1/auth/profile", headers={"Authorization": f"Bearer {tok}"})
    assert prof.status_code == 200
    assert "profile_completion_percent" in prof.json()["data"]
    assert 0 <= prof.json()["data"]["profile_completion_percent"] <= 100


def test_expired_offer_response_blocked(client, db_session):
    from datetime import date, timedelta

    from app.core.security import hash_password
    from app.models.entities import Application, Job, Offer, Organization, User
    from app.shared.enums import (
        ApplicationStatus,
        JobStatus,
        OfferStatus,
        OrganizationType,
        UserRole,
        VerificationStatus,
    )

    org = Organization(
        name="ExpCo",
        org_type=OrganizationType.EMPLOYER.value,
        verification_status=VerificationStatus.VERIFIED.value,
    )
    db_session.add(org)
    db_session.flush()
    emp = User(
        email="exp_emp@example.com",
        password_hash=hash_password("Test1234!"),
        full_name="E",
        role=UserRole.EMPLOYER.value,
        organization_id=org.id,
    )
    stu = User(
        email="exp_stu@example.com",
        password_hash=hash_password("Test1234!"),
        full_name="S",
        role=UserRole.STUDENT.value,
    )
    db_session.add_all([emp, stu])
    db_session.flush()
    job = Job(title="ExpJob", organization_id=org.id, status=JobStatus.PUBLISHED.value, openings=1)
    db_session.add(job)
    db_session.flush()
    app = Application(job_id=job.id, student_id=stu.id, status=ApplicationStatus.SELECTED.value)
    db_session.add(app)
    db_session.flush()
    offer = Offer(
        application_id=app.id,
        role_title="R",
        location="X",
        annual_package=100000,
        status=OfferStatus.ISSUED.value,
        respond_by=date.today() - timedelta(days=1),
    )
    db_session.add(offer)
    db_session.commit()
    tok = client.post("/api/v1/auth/login", json={"email": "exp_stu@example.com", "password": "Test1234!"}).json()[
        "data"
    ]["access_token"]
    r = client.post(
        f"/api/v1/offers/{offer.id}/respond",
        json={"accept": True},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 400
    assert "EXPIRED" in r.text.upper() or r.json().get("error", {}).get("code") == "OFFER_EXPIRED"
