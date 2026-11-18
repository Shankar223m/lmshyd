"""Recruiter access control and scorecard validation regression tests."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _eligible_student(client: TestClient, token: str) -> None:
    client.patch(
        "/api/v1/auth/profile",
        json={"program": "B.Tech CSE", "graduation_year": 2026, "cgpa": 8.0, "skills": ["Python", "React"]},
        headers={"Authorization": f"Bearer {token}"},
    )


def _register_employer(client: TestClient, email: str, org: str) -> str:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Test1234!", "full_name": "E", "role": "EMPLOYER", "organization_name": org},
    )
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": "Test1234!"}).json()["data"]["access_token"]
    return tok


def _admin_token(client: TestClient) -> str:
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "rec_deep_admin@jcms.example.com",
            "password": "AdminPassword123!",
            "full_name": "Admin",
            "role": "PLATFORM_ADMINISTRATOR",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"email": "rec_deep_admin@jcms.example.com", "password": "AdminPassword123!"},
    ).json()["data"]["access_token"]


def test_recruiter_cannot_get_other_employer_application(client: TestClient, db_session):
    admin = _admin_token(client)
    emp_a = _register_employer(client, "rec_deep_emp_a@example.com", "OrgA Deep")
    emp_b = _register_employer(client, "rec_deep_emp_b@example.com", "OrgB Deep")
    org_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp_a}"}).json()["data"]["organization_id"]
    org_b = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp_b}"}).json()["data"]["organization_id"]
    client.post(
        f"/api/v1/admin/organizations/{org_a}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    client.post(
        f"/api/v1/admin/organizations/{org_b}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    client.post(
        "/api/v1/employers/me/recruiters",
        json={"email": "rec_deep_r@example.com", "full_name": "R", "password": "Test1234!"},
        headers={"Authorization": f"Bearer {emp_a}"},
    )
    rec_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_deep_r@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    job_b = client.post(
        "/api/v1/jobs",
        json={"title": "B Job", "openings": 1, "requires_moderation": False},
        headers={"Authorization": f"Bearer {emp_b}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job_b}/publish", headers={"Authorization": f"Bearer {emp_b}"})
    client.post(
        "/api/v1/auth/register",
        json={"email": "rec_deep_stu@example.com", "password": "Test1234!", "full_name": "S", "role": "STUDENT"},
    )
    stu_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_deep_stu@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    _eligible_student(client, stu_t)
    app_b = client.post(
        f"/api/v1/jobs/{job_b}/applications",
        json={"answers": {}},
        headers={"Authorization": f"Bearer {stu_t}"},
    ).json()["data"]["id"]
    denied = client.get(f"/api/v1/applications/{app_b}", headers={"Authorization": f"Bearer {rec_t}"})
    assert denied.status_code == 403


def test_scorecard_rejects_out_of_range(client: TestClient, db_session):
    admin = _admin_token(client)
    emp = _register_employer(client, "rec_sc_emp@example.com", "ScOrg")
    org = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]["organization_id"]
    client.post(
        f"/api/v1/admin/organizations/{org}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    client.post(
        "/api/v1/employers/me/recruiters",
        json={"email": "rec_sc_r@example.com", "full_name": "R", "password": "Test1234!"},
        headers={"Authorization": f"Bearer {emp}"},
    )
    rec_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_sc_r@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    rid = client.get("/api/v1/employers/me/recruiters", headers={"Authorization": f"Bearer {emp}"}).json()["data"][0]["id"]
    job = client.post(
        "/api/v1/jobs",
        json={"title": "Sc Job", "openings": 1, "recruiter_ids": [rid], "requires_moderation": False},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job}/publish", headers={"Authorization": f"Bearer {emp}"})
    client.post(
        "/api/v1/auth/register",
        json={"email": "rec_sc_stu@example.com", "password": "Test1234!", "full_name": "S", "role": "STUDENT"},
    )
    stu_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_sc_stu@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    _eligible_student(client, stu_t)
    app_id = client.post(
        f"/api/v1/jobs/{job}/applications",
        json={"answers": {}},
        headers={"Authorization": f"Bearer {stu_t}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/shortlist", headers={"Authorization": f"Bearer {rec_t}"})
    now = datetime.now(timezone.utc)
    iv = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        json={
            "round_name": "R1",
            "format": "ONLINE",
            "starts_at": (now + timedelta(days=2)).isoformat(),
            "ends_at": (now + timedelta(days=2, hours=1)).isoformat(),
            "meeting_link": "https://meet.example/x",
        },
        headers={"Authorization": f"Bearer {rec_t}"},
    )
    iid = iv.json()["data"]["id"]
    bad = client.post(
        f"/api/v1/interviews/{iid}/feedback",
        json={
            "technical_skills": 0,
            "problem_solving": 4,
            "communication": 4,
            "culture_fit": 4,
            "comments": "x",
            "recommendation": "Reject",
        },
        headers={"Authorization": f"Bearer {rec_t}"},
    )
    assert bad.status_code == 422


def test_interview_schedule_invalid_time_range(client: TestClient, db_session):
    admin = _admin_token(client)
    emp = _register_employer(client, "rec_iv_emp@example.com", "IvOrg")
    org = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]["organization_id"]
    client.post(
        f"/api/v1/admin/organizations/{org}/verify",
        json={"action": "verify"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    client.post(
        "/api/v1/employers/me/recruiters",
        json={"email": "rec_iv_r@example.com", "full_name": "R", "password": "Test1234!"},
        headers={"Authorization": f"Bearer {emp}"},
    )
    rec_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_iv_r@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    rid = client.get("/api/v1/employers/me/recruiters", headers={"Authorization": f"Bearer {emp}"}).json()["data"][0]["id"]
    job = client.post(
        "/api/v1/jobs",
        json={"title": "Iv Job", "openings": 1, "recruiter_ids": [rid], "requires_moderation": False},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job}/publish", headers={"Authorization": f"Bearer {emp}"})
    client.post(
        "/api/v1/auth/register",
        json={"email": "rec_iv_stu@example.com", "password": "Test1234!", "full_name": "S", "role": "STUDENT"},
    )
    stu_t = client.post(
        "/api/v1/auth/login",
        json={"email": "rec_iv_stu@example.com", "password": "Test1234!"},
    ).json()["data"]["access_token"]
    _eligible_student(client, stu_t)
    app_id = client.post(
        f"/api/v1/jobs/{job}/applications",
        json={"answers": {}},
        headers={"Authorization": f"Bearer {stu_t}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/applications/{app_id}/shortlist", headers={"Authorization": f"Bearer {rec_t}"})
    now = datetime.now(timezone.utc)
    bad = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        json={
            "round_name": "R1",
            "format": "ONLINE",
            "starts_at": (now + timedelta(days=5)).isoformat(),
            "ends_at": (now + timedelta(days=4)).isoformat(),
            "meeting_link": "https://meet.example/x",
        },
        headers={"Authorization": f"Bearer {rec_t}"},
    )
    assert bad.status_code == 400
