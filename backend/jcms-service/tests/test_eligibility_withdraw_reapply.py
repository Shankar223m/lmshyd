"""Eligibility edit, withdrawal, and reapplication regression tests."""

from datetime import date, timedelta

from fastapi.testclient import TestClient


def _admin(client: TestClient, email: str = "ew_admin@example.com") -> str:
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "AdminPassword123!",
            "full_name": "A",
            "role": "PLATFORM_ADMINISTRATOR",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "AdminPassword123!"},
    ).json()["data"]["access_token"]


def _emp(client: TestClient, email: str, org: str) -> str:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Test1234!", "full_name": "E", "role": "EMPLOYER", "organization_name": org},
    )
    return client.post("/api/v1/auth/login", json={"email": email, "password": "Test1234!"}).json()["data"]["access_token"]


def _stu(client: TestClient, email: str) -> str:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Test1234!", "full_name": "S", "role": "STUDENT"},
    )
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": "Test1234!"}).json()["data"]["access_token"]
    client.patch(
        "/api/v1/auth/profile",
        json={
            "program": "B.Tech CSE",
            "graduation_year": 2026,
            "cgpa": 8.5,
            "skills": ["Python", "React", "Java"],
        },
        headers={"Authorization": f"Bearer {tok}"},
    )
    return tok


def test_eligibility_create_get_put_and_forbidden(client: TestClient, db_session):
    admin = _admin(client, "ew_admin1@example.com")
    emp = _emp(client, "ew_emp@example.com", "EW Org")
    emp2 = _emp(client, "ew_emp2@example.com", "Other Org")
    org = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]["organization_id"]
    client.post(f"/api/v1/admin/organizations/{org}/verify", json={"action": "verify"}, headers={"Authorization": f"Bearer {admin}"})
    job = client.post(
        "/api/v1/jobs",
        json={
            "title": "Elig Job",
            "openings": 1,
            "requires_moderation": False,
            "eligibility": {
                "programs": ["B.Tech CSE"],
                "graduation_year_min": 2025,
                "graduation_year_max": 2026,
                "min_cgpa": 8.0,
                "required_skills": ["Python"],
                "max_backlogs": 1,
            },
        },
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert job.status_code == 200
    jid = job.json()["data"]["id"]
    assert job.json()["data"]["eligibility"]["min_cgpa"] == 8.0
    g = client.get(f"/api/v1/jobs/{jid}/eligibility", headers={"Authorization": f"Bearer {emp}"})
    assert g.status_code == 200
    assert g.json()["data"]["programs"] == ["B.Tech CSE"]
    put = client.put(
        f"/api/v1/jobs/{jid}/eligibility",
        json={
            "programs": ["B.Tech IT", "B.Tech CSE"],
            "graduation_year_min": 2024,
            "graduation_year_max": 2027,
            "min_cgpa": 6.5,
            "required_skills": ["Java"],
            "max_backlogs": 0,
        },
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert put.status_code == 200
    assert put.json()["data"]["min_cgpa"] == 6.5
    deny = client.put(
        f"/api/v1/jobs/{jid}/eligibility",
        json={"programs": ["X"], "graduation_year_min": 2025, "graduation_year_max": 2026, "min_cgpa": 7},
        headers={"Authorization": f"Bearer {emp2}"},
    )
    assert deny.status_code == 403
    bad = client.put(
        f"/api/v1/jobs/{jid}/eligibility",
        json={"programs": [], "graduation_year_min": 2027, "graduation_year_max": 2025, "min_cgpa": 7},
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert bad.status_code == 400


def test_withdraw_and_reapply_new_application_id(client: TestClient, db_session):
    admin = _admin(client, "ew_admin2@example.com")
    emp = _emp(client, "wr_emp@example.com", "WR Org")
    org = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]["organization_id"]
    client.post(f"/api/v1/admin/organizations/{org}/verify", json={"action": "verify"}, headers={"Authorization": f"Bearer {admin}"})
    job = client.post(
        "/api/v1/jobs",
        json={"title": "WR Job", "openings": 2, "requires_moderation": False},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job}/publish", headers={"Authorization": f"Bearer {emp}"})
    stu = _stu(client, "wr_stu@example.com")
    stu2 = _stu(client, "wr_stu2@example.com")
    h = {"Authorization": f"Bearer {stu}"}
    app1 = client.post(f"/api/v1/jobs/{job}/applications", json={"answers": {}}, headers=h)
    assert app1.status_code == 200
    app_id = app1.json()["data"]["id"]
    # Other student cannot withdraw
    assert (
        client.post(
            f"/api/v1/applications/{app_id}/withdraw",
            json={},
            headers={"Authorization": f"Bearer {stu2}"},
        ).status_code
        == 403
    )
    w = client.post(f"/api/v1/applications/{app_id}/withdraw", json={"reason": "Changed plans"}, headers=h)
    assert w.status_code == 200
    assert w.json()["data"]["status"] == "WITHDRAWN"
    # Cannot withdraw again
    assert client.post(f"/api/v1/applications/{app_id}/withdraw", json={}, headers=h).status_code == 400
    # Reapply creates new id
    app2 = client.post(f"/api/v1/jobs/{job}/applications", json={"answers": {"note": "again"}}, headers=h)
    assert app2.status_code == 200
    new_id = app2.json()["data"]["id"]
    assert new_id != app_id
    old = client.get(f"/api/v1/applications/{app_id}", headers=h).json()["data"]
    assert old["status"] == "WITHDRAWN"
    # Duplicate active blocked
    assert client.post(f"/api/v1/jobs/{job}/applications", json={}, headers=h).status_code == 409


def test_withdraw_blocked_when_offer_issued(client: TestClient, db_session):
    admin = _admin(client, "ew_admin3@example.com")
    emp = _emp(client, "of_emp@example.com", "OF Org")
    org = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {emp}"}).json()["data"]["organization_id"]
    client.post(f"/api/v1/admin/organizations/{org}/verify", json={"action": "verify"}, headers={"Authorization": f"Bearer {admin}"})
    job = client.post(
        "/api/v1/jobs",
        json={"title": "OF Job", "openings": 1, "requires_moderation": False},
        headers={"Authorization": f"Bearer {emp}"},
    ).json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job}/publish", headers={"Authorization": f"Bearer {emp}"})
    stu = _stu(client, "of_stu@example.com")
    app_id = client.post(
        f"/api/v1/jobs/{job}/applications",
        json={},
        headers={"Authorization": f"Bearer {stu}"},
    ).json()["data"]["id"]
    of = client.post(
        f"/api/v1/applications/{app_id}/offers",
        json={
            "role_title": "Dev",
            "location": "X",
            "annual_package": 500000,
            "requires_approval": False,
            "respond_by": (date.today() + timedelta(days=7)).isoformat(),
        },
        headers={"Authorization": f"Bearer {emp}"},
    )
    assert of.status_code == 200
    wr = client.post(
        f"/api/v1/applications/{app_id}/withdraw",
        json={},
        headers={"Authorization": f"Bearer {stu}"},
    )
    assert wr.status_code == 400
    assert "OFFER" in wr.text.upper()
