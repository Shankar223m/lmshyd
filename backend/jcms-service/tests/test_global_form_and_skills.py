import os
os.environ["APP_ENV"] = "test"

from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models.entities import Job, Organization, StudentProfile, User
from app.shared.enums import UserRole, VerificationStatus


def _unique_email(prefix: str) -> str:
    import uuid
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _admin_token(client: TestClient) -> str:
    admin_email = _unique_email("form_admin")
    client.post(
        "/api/v1/auth/register",
        json={"email": admin_email, "password": "AdminPassword123!", "full_name": "Admin", "role": "PLATFORM_ADMINISTRATOR"},
    )
    r = client.post("/api/v1/auth/login", json={"email": admin_email, "password": "AdminPassword123!"})
    return r.json()["data"]["access_token"]


def test_registration_validation(client: TestClient, db_session):
    # 1. Invalid email format rejected by EmailStr (422)
    res_bad = client.post(
        "/api/v1/auth/register",
        json={"email": "notanemail", "password": "Password123!", "full_name": "Test User", "role": "STUDENT"},
    )
    assert res_bad.status_code == 422

    # 2. Valid email accepted
    email = _unique_email("form_reg")
    res_ok = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Test User", "role": "STUDENT"},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["data"]["email"] == email.lower()

    # 3. Duplicate email with uppercase rejected as EMAIL_EXISTS (409)
    res_dup = client.post(
        "/api/v1/auth/register",
        json={"email": email.upper(), "password": "Password123!", "full_name": "Test User", "role": "STUDENT"},
    )
    assert res_dup.status_code == 409


def test_student_cgpa_and_skills_clearing(client: TestClient, db_session):
    email = _unique_email("stu_cgpa")
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "CGPA Student", "role": "STUDENT"},
    )
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"}).json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}

    # CGPA bounds check: negative rejected
    r_neg = client.patch("/api/v1/auth/profile", json={"cgpa": -1.0}, headers=headers)
    assert r_neg.status_code == 422

    # CGPA bounds check: > 10.0 rejected
    r_high = client.patch("/api/v1/auth/profile", json={"cgpa": 10.5}, headers=headers)
    assert r_high.status_code == 422

    # Valid CGPA: 0.0, 8.75, 10.0 accepted
    r_valid = client.patch("/api/v1/auth/profile", json={"cgpa": 8.75, "graduation_year": 2026, "skills": ["Python", "FastAPI"]}, headers=headers)
    assert r_valid.status_code == 200

    prof = client.get("/api/v1/auth/profile", headers=headers).json()["data"]["student_profile"]
    assert prof["cgpa"] == 8.75
    assert prof["skills"] == ["Python", "FastAPI"]

    # Student skills clearing: empty array persists empty skills
    r_clear = client.patch("/api/v1/auth/profile", json={"skills": []}, headers=headers)
    assert r_clear.status_code == 200
    prof_cleared = client.get("/api/v1/auth/profile", headers=headers).json()["data"]["student_profile"]
    assert prof_cleared["skills"] == []


def test_offer_and_interview_validations(client: TestClient, db_session):
    admin = _admin_token(client)
    emp_email = _unique_email("emp_val")
    client.post(
        "/api/v1/auth/register",
        json={"email": emp_email, "password": "Password123!", "full_name": "Employer Val", "role": "EMPLOYER", "organization_name": "Val Corp"},
    )
    emp_tok = client.post("/api/v1/auth/login", json={"email": emp_email, "password": "Password123!"}).json()["data"]["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_tok}"}
    org_id = client.get("/api/v1/auth/me", headers=emp_headers).json()["data"]["organization_id"]

    # Verify employer org
    client.post(f"/api/v1/admin/organizations/{org_id}/verify", json={"action": "verify"}, headers={"Authorization": f"Bearer {admin}"})

    # Create & publish job
    job_res = client.post(
        "/api/v1/jobs",
        json={"title": "Offer Validation Job", "openings": 2, "requires_moderation": False},
        headers=emp_headers,
    )
    job_id = job_res.json()["data"]["id"]
    client.post(f"/api/v1/jobs/{job_id}/publish", headers=emp_headers)

    # Register student & apply
    stu_email = _unique_email("stu_val")
    client.post(
        "/api/v1/auth/register",
        json={"email": stu_email, "password": "Password123!", "full_name": "Stu Val", "role": "STUDENT"},
    )
    stu_tok = client.post("/api/v1/auth/login", json={"email": stu_email, "password": "Password123!"}).json()["data"]["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_tok}"}

    client.patch("/api/v1/auth/profile", json={"program": "B.Tech CSE", "graduation_year": 2026, "cgpa": 8.5}, headers=stu_headers)
    app_res = client.post(f"/api/v1/jobs/{job_id}/applications", json={"answers": {}}, headers=stu_headers)
    app_id = app_res.json()["data"]["id"]

    # Negative annual package rejected
    bad_pkg = client.post(
        f"/api/v1/applications/{app_id}/offers",
        json={"role_title": "Dev", "location": "BLR", "annual_package": -50000},
        headers=emp_headers,
    )
    assert bad_pkg.status_code == 400
    assert "INVALID_ANNUAL_PACKAGE" in bad_pkg.text

    # respond_by after joining_date rejected
    bad_dates = client.post(
        f"/api/v1/applications/{app_id}/offers",
        json={
            "role_title": "Dev",
            "location": "BLR",
            "annual_package": 1200000,
            "joining_date": "2026-06-01",
            "respond_by": "2026-06-15",
        },
        headers=emp_headers,
    )
    assert bad_dates.status_code == 400
    assert "INVALID_RESPOND_BY_DATE" in bad_dates.text

    # Valid offer accepted
    valid_offer = client.post(
        f"/api/v1/applications/{app_id}/offers",
        json={
            "role_title": "Dev",
            "location": "BLR",
            "annual_package": 1200000,
            "joining_date": "2026-06-15",
            "respond_by": "2026-06-01",
        },
        headers=emp_headers,
    )
    assert valid_offer.status_code == 200


def test_required_skills_end_to_end_flow(client: TestClient, db_session):
    admin = _admin_token(client)
    emp_email = _unique_email("emp_skills")
    client.post(
        "/api/v1/auth/register",
        json={"email": emp_email, "password": "Password123!", "full_name": "Emp Skills", "role": "EMPLOYER", "organization_name": "Skills Co"},
    )
    emp_tok = client.post("/api/v1/auth/login", json={"email": emp_email, "password": "Password123!"}).json()["data"]["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_tok}"}
    org_id = client.get("/api/v1/auth/me", headers=emp_headers).json()["data"]["organization_id"]

    # Verify employer org
    client.post(f"/api/v1/admin/organizations/{org_id}/verify", json={"action": "verify"}, headers={"Authorization": f"Bearer {admin}"})

    # Step 1: Employer creates job with 5 distinct required skills
    expected_skills = ["Python", "FastAPI", "PostgreSQL", "React", "Docker"]
    create_payload = {
        "title": "Full Stack Cloud Engineer",
        "description": "Looking for passionate engineers.",
        "location": "Bengaluru",
        "employment_type": "FULL_TIME",
        "work_mode": "HYBRID",
        "openings": 3,
        "skills": expected_skills,
        "eligibility": {
            "programs": ["B.Tech CSE"],
            "graduation_year_min": 2025,
            "graduation_year_max": 2027,
            "min_cgpa": 7.0,
            "required_skills": expected_skills,
        },
        "requires_moderation": False,
    }

    job_res = client.post("/api/v1/jobs", json=create_payload, headers=emp_headers)
    assert job_res.status_code == 200, job_res.text
    job_id = job_res.json()["data"]["id"]
    assert job_res.json()["data"]["skills"] == expected_skills

    # Step 2: Verify direct PostgreSQL persistence
    db_job = db_session.get(Job, job_id)
    assert db_job is not None
    assert db_job.skills == expected_skills

    # Step 3: Publish job
    client.post(f"/api/v1/jobs/{job_id}/publish", headers=emp_headers)

    # Step 4: Student views job details
    stu_email = _unique_email("stu_skills")
    client.post(
        "/api/v1/auth/register",
        json={"email": stu_email, "password": "Password123!", "full_name": "Aarav Skills", "role": "STUDENT"},
    )
    stu_tok = client.post("/api/v1/auth/login", json={"email": stu_email, "password": "Password123!"}).json()["data"]["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_tok}"}

    # Student has distinct profile skills (e.g. Kotlin, Java)
    student_own_skills = ["Kotlin", "Java", "Android"]
    client.patch(
        "/api/v1/auth/profile",
        json={"program": "B.Tech CSE", "graduation_year": 2026, "cgpa": 8.8, "skills": student_own_skills},
        headers=stu_headers,
    )

    stu_job_view = client.get(f"/api/v1/jobs/{job_id}", headers=stu_headers)
    assert stu_job_view.status_code == 200
    assert stu_job_view.json()["data"]["skills"] == expected_skills

    # Step 5: Student applies to the job
    app_res = client.post(f"/api/v1/jobs/{job_id}/applications", json={"answers": {"project": "Antigravity"}}, headers=stu_headers)
    assert app_res.status_code == 200
    app_id = app_res.json()["data"]["id"]

    # Step 6: Employer / Recruiter reviews application
    # Verifies that application review returns both job_skills AND student skills separately
    rec_queue = client.get("/api/v1/recruiter/applications", headers=emp_headers)
    assert rec_queue.status_code == 200
    apps = rec_queue.json()["data"]
    matched_app = next((a for a in apps if a["id"] == app_id), None)
    assert matched_app is not None

    # Crucial assertion: Job required skills are identical to original employer input
    assert matched_app["job_skills"] == expected_skills
    # Crucial assertion: Student profile skills are separate and preserved
    assert matched_app["skills"] == student_own_skills

    # Step 7: Employer updates job skills
    updated_skills = ["Python", "FastAPI", "PostgreSQL", "React", "Docker", "Kubernetes"]
    put_eligibility = client.put(
        f"/api/v1/jobs/{job_id}/eligibility",
        json={
            "programs": ["B.Tech CSE"],
            "graduation_year_min": 2025,
            "graduation_year_max": 2027,
            "min_cgpa": 7.0,
            "required_skills": updated_skills,
        },
        headers=emp_headers,
    )
    assert put_eligibility.status_code == 200

    # Verify updated skills in Job record
    refreshed_job = client.get(f"/api/v1/jobs/{job_id}", headers=emp_headers).json()["data"]
    assert refreshed_job["skills"] == updated_skills
