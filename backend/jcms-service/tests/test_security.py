from datetime import date, timedelta
import uuid
import pytest
from fastapi.testclient import TestClient


def register_user(client: TestClient, role: str, email: str, org_name: str | None = None, password: str = "Test1234!") -> str:
    payload = {
        "email": email,
        "password": password,
        "full_name": f"User {role}",
        "role": role,
    }
    if org_name:
        payload["organization_name"] = org_name
    client.post("/api/v1/auth/register", json=payload)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return login.json()["data"]["access_token"]


def test_forbidden_admin_without_role(client: TestClient):
    email = f"student_{uuid.uuid4().hex[:8]}@example.com"
    access = register_user(client, "STUDENT", email)
    r = client.get(
        "/api/v1/admin/organizations/pending",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert r.status_code == 403


def test_student_cross_tenant_isolation(client: TestClient):
    student_a = register_user(client, "STUDENT", f"stu_a_{uuid.uuid4().hex[:6]}@example.com")
    student_b = register_user(client, "STUDENT", f"stu_b_{uuid.uuid4().hex[:6]}@example.com")
    admin = register_user(client, "PLATFORM_ADMINISTRATOR", f"admin_{uuid.uuid4().hex[:6]}@example.com")
    employer = register_user(client, "EMPLOYER", f"emp_{uuid.uuid4().hex[:6]}@example.com", org_name="Org Isolation")

    # Get employer org and verify it
    emp_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {employer}"}).json()["data"]
    client.post(
        f"/api/v1/admin/organizations/{emp_me['organization_id']}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )

    # Employer publishes job
    job_resp = client.post(
        "/api/v1/jobs",
        json={"title": "Software Engineer", "openings": 2, "closes_on": (date.today() + timedelta(days=20)).isoformat()},
        headers={"Authorization": f"Bearer {employer}"},
    )
    job_id = job_resp.json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job_id}/publish", headers={"Authorization": f"Bearer {employer}"})

    # Student B applies
    app_resp = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        json={"answers": {}},
        headers={"Authorization": f"Bearer {student_b}"},
    )
    app_b_id = app_resp.json()["data"]["id"]

    # Student A tries to view Student B's application -> 403
    cross_view = client.get(
        f"/api/v1/applications/{app_b_id}",
        headers={"Authorization": f"Bearer {student_a}"},
    )
    assert cross_view.status_code == 403


def test_employer_cross_tenant_isolation(client: TestClient):
    admin = register_user(client, "PLATFORM_ADMINISTRATOR", f"admin_{uuid.uuid4().hex[:6]}@example.com")
    emp_a = register_user(client, "EMPLOYER", f"empa_{uuid.uuid4().hex[:6]}@example.com", org_name="Company Alpha")
    emp_b = register_user(client, "EMPLOYER", f"empb_{uuid.uuid4().hex[:6]}@example.com", org_name="Company Beta")

    # Verify Company Alpha
    emp_a_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp_a}"}).json()["data"]
    client.post(
        f"/api/v1/admin/organizations/{emp_a_me['organization_id']}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )

    # Employer Alpha creates a job
    job_a = client.post(
        "/api/v1/jobs",
        json={"title": "Backend Dev Alpha", "openings": 1},
        headers={"Authorization": f"Bearer {emp_a}"},
    ).json()["data"]["id"]

    # Employer Beta tries to view pipeline of Company Alpha's job -> 403
    r = client.get(
        f"/api/v1/jobs/{job_a}/pipeline",
        headers={"Authorization": f"Bearer {emp_b}"},
    )
    assert r.status_code == 403


def test_unverified_employer_cannot_publish_job(client: TestClient):
    emp = register_user(client, "EMPLOYER", f"unverified_{uuid.uuid4().hex[:6]}@example.com", org_name="Unverified Inc")
    job = client.post(
        "/api/v1/jobs",
        json={"title": "Security Analyst", "openings": 1},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]

    # Try to publish without admin verification
    pub = client.post(f"/api/v1/jobs/{job}/publish", headers={"Authorization": f"Bearer {emp}"})
    assert pub.status_code in (400, 403)


def test_institution_isolation(client: TestClient):
    inst_a = register_user(client, "INSTITUTION", f"inst_a_{uuid.uuid4().hex[:6]}@example.com", org_name="Inst A")
    inst_b = register_user(client, "INSTITUTION", f"inst_b_{uuid.uuid4().hex[:6]}@example.com", org_name="Inst B")

    # Institution A attempts to verify a non-existent or foreign placement ID
    fake_placement = str(uuid.uuid4())
    r = client.post(
        f"/api/v1/institutions/me/placements/{fake_placement}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {inst_a}"},
    )
    assert r.status_code in (403, 404)


def test_invalid_lifecycle_transition_rejected(client: TestClient):
    admin = register_user(client, "PLATFORM_ADMINISTRATOR", f"admin_{uuid.uuid4().hex[:6]}@example.com")
    emp = register_user(client, "EMPLOYER", f"emp_trans_{uuid.uuid4().hex[:6]}@example.com", org_name="Trans Org")
    student = register_user(client, "STUDENT", f"stu_trans_{uuid.uuid4().hex[:6]}@example.com")

    # Verify org
    emp_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]
    client.post(
        f"/api/v1/admin/organizations/{emp_me['organization_id']}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )

    # Job published
    job_id = client.post(
        "/api/v1/jobs",
        json={"title": "QA Lead", "openings": 1},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job_id}/publish", headers={"Authorization": f"Bearer {emp}"})

    # Student applies -> status SUBMITTED
    app_id = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        json={},
        headers={"Authorization": f"Bearer {student}"},
    ).json()["data"]["id"]

    # Attempt invalid transition from SUBMITTED directly to SELECTED
    bad_transition = client.post(
        f"/api/v1/applications/{app_id}/transition",
        json={"to_status": "SELECTED"},
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert bad_transition.status_code == 400


def test_reject_application_accepts_reason_only_body(client: TestClient):
    admin = register_user(client, "PLATFORM_ADMINISTRATOR", f"admin_rej_{uuid.uuid4().hex[:6]}@example.com")
    emp = register_user(client, "EMPLOYER", f"emp_rej_{uuid.uuid4().hex[:6]}@example.com", org_name="Reject Co")
    rec = register_user(client, "RECRUITER", f"rec_rej_{uuid.uuid4().hex[:6]}@example.com")
    stu = register_user(client, "STUDENT", f"stu_rej_{uuid.uuid4().hex[:6]}@example.com")
    emp_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]
    client.post(
        f"/api/v1/admin/organizations/{emp_me['organization_id']}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    job_id = client.post(
        "/api/v1/jobs",
        json={"title": "Reject Test Job", "openings": 1},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job_id}/publish", headers={"Authorization": f"Bearer {emp}"})
    app_id = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        json={"answers": {}},
        headers={"Authorization": f"Bearer {stu}"},
    ).json()["data"]["id"]
    r = client.post(
        f"/api/v1/applications/{app_id}/reject",
        json={"reason": "Not selected"},
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "REJECTED"


def test_unauthenticated_file_access_blocked(client: TestClient):
    r = client.get(f"/api/v1/files/{uuid.uuid4()}/download")
    assert r.status_code == 401


def test_employer_jobs_list_includes_stats(client: TestClient):
    admin = register_user(client, "PLATFORM_ADMINISTRATOR", f"admin_jobs_{uuid.uuid4().hex[:6]}@example.com")
    emp = register_user(
        client,
        "EMPLOYER",
        f"emp_jobs_{uuid.uuid4().hex[:6]}@example.com",
        org_name="Stats Co",
    )
    emp_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]
    client.post(
        f"/api/v1/admin/organizations/{emp_me['organization_id']}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    client.post(
        "/api/v1/jobs",
        json={"title": "Stats Job", "openings": 1},
        headers={"Authorization": f"Bearer {emp}"},
    )
    r = client.get("/api/v1/employers/me/jobs", headers={"Authorization": f"Bearer {emp}"})
    assert r.status_code == 200, r.text
    assert "stats" in r.json()["data"]
    assert "jobs" in r.json()["data"]
