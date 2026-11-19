"""Student accept on issued offers."""

from datetime import date, timedelta

from app.core.security import create_access_token, hash_password
from app.models.entities import Application, Job, Offer, Organization, User
from app.shared.enums import ApplicationStatus, JobStatus, OfferStatus, OrganizationType, UserRole, VerificationStatus


def test_student_accepts_after_deadline_refresh(client, db_session, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "lms_auth_enabled", False)
    org = Organization(
        name="Co",
        org_type=OrganizationType.EMPLOYER.value,
        verification_status=VerificationStatus.VERIFIED.value,
    )
    db_session.add(org)
    db_session.flush()
    stu = User(
        id="student-1",
        email="stu@example.com",
        password_hash=hash_password("x"),
        full_name="Student",
        role=UserRole.STUDENT.value,
    )
    db_session.add(stu)
    db_session.flush()
    job = Job(title="J", organization_id=org.id, status=JobStatus.PUBLISHED.value, openings=1)
    db_session.add(job)
    db_session.flush()
    app = Application(job_id=job.id, student_id=stu.id, status=ApplicationStatus.SELECTED.value)
    db_session.add(app)
    db_session.flush()
    offer = Offer(
        application_id=app.id,
        role_title="Engineer",
        location="Remote",
        annual_package=900000,
        status=OfferStatus.ISSUED.value,
        respond_by=date.today() - timedelta(days=3),
    )
    db_session.add(offer)
    db_session.commit()

    headers = {"Authorization": f"Bearer {create_access_token(stu.id)}"}
    listed = client.get("/api/v1/jcms/offers/me", headers=headers)
    assert listed.status_code == 200

    r = client.post(
        f"/api/v1/jcms/offers/{offer.id}/respond",
        json={"accept": True},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "ACCEPTED"