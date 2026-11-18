"""The student's Jobs home: every number and the next step come from the server."""

from fastapi.testclient import TestClient
import pytest


@pytest.fixture(autouse=True)
def local_auth_mode(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "lms_auth_enabled", False)


def _student_token(client: TestClient, email: str) -> str:
    client.post("/api/v1/jcms/auth/register", json={"email": email, "password": "Test1234!", "full_name": "S", "role": "STUDENT"})
    return client.post("/api/v1/jcms/auth/login", json={"email": email, "password": "Test1234!"}).json()["data"]["access_token"]


def test_new_student_is_told_to_finish_the_profile_first(client: TestClient):
    token = _student_token(client, "dash_new@example.com")
    body = client.get("/api/v1/jcms/students/me/dashboard", headers={"Authorization": f"Bearer {token}"}).json()["data"]
    assert body["stats"]["applications_total"] == 0
    assert body["placement"]["label"] == "Not placed yet"
    assert body["next_action"]["key"] == "complete_profile"
    assert body["next_action"]["to"] == "/jobs/student/profile"
    assert body["recommended_jobs"] == []


def test_dashboard_is_for_students_only(client: TestClient):
    client.post(
        "/api/v1/jcms/auth/register",
        json={"email": "dash_emp@example.com", "password": "Test1234!", "full_name": "E", "role": "EMPLOYER", "organization_name": "Dash Org"},
    )
    token = client.post("/api/v1/jcms/auth/login", json={"email": "dash_emp@example.com", "password": "Test1234!"}).json()["data"]["access_token"]
    assert client.get("/api/v1/jcms/students/me/dashboard", headers={"Authorization": f"Bearer {token}"}).status_code == 403
