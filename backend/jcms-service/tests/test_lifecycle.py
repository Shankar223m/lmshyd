from datetime import date, datetime, timedelta
import pytest
from fastapi.testclient import TestClient


def test_full_recruitment_and_placement_lifecycle(client: TestClient, db_session):
    # 1. Admin login (already has credentials in test or register one)
    admin_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin_lifecycle@jcms.example.com",
            "password": "AdminPassword123!",
            "full_name": "Platform Admin",
            "role": "PLATFORM_ADMINISTRATOR",
        },
    )
    assert admin_reg.status_code == 200
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_lifecycle@jcms.example.com", "password": "AdminPassword123!"},
    )
    admin_token = admin_login.json()["data"]["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Employer registers
    emp_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "employer_lifecycle@acme.example.com",
            "password": "EmployerPassword123!",
            "full_name": "Alice Employer",
            "role": "EMPLOYER",
            "organization_name": "Acme Corp",
        },
    )
    assert emp_reg.status_code == 200
    emp_login = client.post(
        "/api/v1/auth/login",
        json={"email": "employer_lifecycle@acme.example.com", "password": "EmployerPassword123!"},
    )
    emp_token = emp_login.json()["data"]["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    emp_me = client.get("/api/v1/auth/me", headers=emp_headers).json()["data"]
    org_id = emp_me["organization_id"]

    # 3. Admin verifies organization
    verify_resp = client.post(
        f"/api/v1/admin/organizations/{org_id}/verify",
        json={"action": "verify", "comment": "Legitimate business registration"},
        headers=admin_headers,
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["verification_status"] == "VERIFIED"

    # 4. Employer invites/creates Recruiter
    recruiter_resp = client.post(
        "/api/v1/employers/me/recruiters",
        json={"email": "recruiter_lifecycle@acme.example.com", "full_name": "Bob Recruiter", "password": "Recruiter123!"},
        headers=emp_headers,
    )
    assert recruiter_resp.status_code == 200
    recruiter_id = recruiter_resp.json()["data"]["id"]

    recruiter_login = client.post(
        "/api/v1/auth/login",
        json={"email": "recruiter_lifecycle@acme.example.com", "password": "Recruiter123!"},
    )
    recruiter_token = recruiter_login.json()["data"]["access_token"]
    recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

    # 5. Employer creates job
    job_resp = client.post(
        "/api/v1/jobs",
        json={
            "title": "Full Stack Engineer",
            "description": "Design and build web applications.",
            "location": "Bengaluru",
            "employment_type": "FULL_TIME",
            "work_mode": "HYBRID",
            "salary_min": 900000,
            "salary_max": 1400000,
            "openings": 3,
            "closes_on": (date.today() + timedelta(days=30)).isoformat(),
            "skills": ["Python", "React", "PostgreSQL"],
            "hiring_stages": ["Screening", "Shortlisted", "Interview", "Selected"],
            "recruiter_ids": [recruiter_id],
            "requires_moderation": True,
        },
        headers=emp_headers,
    )
    assert job_resp.status_code == 200
    job_id = job_resp.json()["data"]["id"]

    # 6. Employer submits job for moderation
    submit_job_resp = client.post(f"/api/v1/jobs/{job_id}/submit", headers=emp_headers)
    assert submit_job_resp.status_code == 200
    assert submit_job_resp.json()["data"]["status"] == "UNDER_REVIEW"

    # 7. Admin moderates and approves job
    mod_resp = client.post(
        f"/api/v1/admin/jobs/{job_id}/moderate",
        json={"action": "approve", "note": "All requirements met"},
        headers=admin_headers,
    )
    assert mod_resp.status_code == 200
    assert mod_resp.json()["data"]["status"] == "PUBLISHED"

    # 8. Institution registers
    inst_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "institution_lifecycle@univ.example.com",
            "password": "InstitutionPassword123!",
            "full_name": "Dr. Ramesh Officer",
            "role": "INSTITUTION",
            "organization_name": "Apex University",
        },
    )
    assert inst_reg.status_code == 200
    inst_login = client.post(
        "/api/v1/auth/login",
        json={"email": "institution_lifecycle@univ.example.com", "password": "InstitutionPassword123!"},
    )
    inst_token = inst_login.json()["data"]["access_token"]
    inst_headers = {"Authorization": f"Bearer {inst_token}"}
    inst_me = client.get("/api/v1/auth/me", headers=inst_headers).json()["data"]
    inst_org_id = inst_me["organization_id"]

    # 9. Student registers and updates profile
    student_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "student_lifecycle@univ.example.com",
            "password": "StudentPassword123!",
            "full_name": "Rahul Sharma",
            "role": "STUDENT",
        },
    )
    assert student_reg.status_code == 200
    student_login = client.post(
        "/api/v1/auth/login",
        json={"email": "student_lifecycle@univ.example.com", "password": "StudentPassword123!"},
    )
    student_token = student_login.json()["data"]["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Student updates academic info
    profile_up = client.patch(
        "/api/v1/auth/profile",
        json={
            "program": "B.Tech Computer Science",
            "graduation_year": 2026,
            "cgpa": 8.8,
            "location": "Bengaluru",
            "skills": ["Python", "React", "PostgreSQL"],
        },
        headers=student_headers,
    )
    assert profile_up.status_code == 200

    # Link student to institution for placement workflow
    from sqlalchemy import select
    from app.models.entities import StudentProfile, User
    stu_user = db_session.scalar(select(User).where(User.email == "student_lifecycle@univ.example.com"))
    if stu_user and stu_user.student_profile:
        stu_user.student_profile.institution_id = inst_org_id
        stu_user.organization_id = inst_org_id
        db_session.commit()

    # 10. Student discovers published job
    discover = client.get("/api/v1/jobs/discover", headers=student_headers)
    assert discover.status_code == 200
    discovered_jobs = discover.json()["data"]
    assert any(j["id"] == job_id for j in discovered_jobs)

    # 11. Student applies to job
    apply_resp = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        json={"answers": {"portfolio": "https://rahul.dev"}},
        headers=student_headers,
    )
    assert apply_resp.status_code == 200
    app_id = apply_resp.json()["data"]["id"]

    # 12. Duplicate application rejected
    dup_resp = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        json={"answers": {"portfolio": "https://rahul.dev"}},
        headers=student_headers,
    )
    assert dup_resp.status_code == 409

    # 13. Recruiter views queue and shortlists candidate
    rec_queue = client.get("/api/v1/recruiter/applications", headers=recruiter_headers)
    assert rec_queue.status_code == 200
    assert any(a["id"] == app_id for a in rec_queue.json()["data"])

    shortlist_resp = client.post(f"/api/v1/applications/{app_id}/shortlist", headers=recruiter_headers)
    assert shortlist_resp.status_code == 200
    assert shortlist_resp.json()["data"]["status"] == "SHORTLISTED"

    # 14. Recruiter schedules interview
    now = datetime.now()
    interview_resp = client.post(
        f"/api/v1/applications/{app_id}/interviews",
        json={
            "round_name": "Technical Assessment",
            "format": "ONLINE",
            "starts_at": (now + timedelta(days=2)).isoformat(),
            "ends_at": (now + timedelta(days=2, hours=1)).isoformat(),
            "meeting_link": "https://meet.google.com/xyz-1234",
            "instructions": "Be prepared with system design concepts",
        },
        headers=recruiter_headers,
    )
    assert interview_resp.status_code == 200
    interview_id = interview_resp.json()["data"]["id"]

    # 15. Student views scheduled interview
    stu_interviews = client.get("/api/v1/interviews/me", headers=student_headers)
    assert stu_interviews.status_code == 200
    assert any(i["id"] == interview_id for i in stu_interviews.json()["data"])

    # 16. Recruiter evaluates and submits scorecard
    feedback_resp = client.post(
        f"/api/v1/interviews/{interview_id}/feedback",
        json={
            "technical_skills": 5,
            "problem_solving": 5,
            "communication": 4,
            "culture_fit": 5,
            "comments": "Excellent grasp of backend and systems.",
            "recommendation": "Recommend for hire",
        },
        headers=recruiter_headers,
    )
    assert feedback_resp.status_code == 200

    # 17. Employer creates and issues offer (no internal approval chain)
    offer_resp = client.post(
        f"/api/v1/applications/{app_id}/offers",
        json={
            "role_title": "Full Stack Engineer",
            "location": "Bengaluru",
            "annual_package": 1200000,
            "joining_date": (date.today() + timedelta(days=45)).isoformat(),
            "respond_by": (date.today() + timedelta(days=15)).isoformat(),
            "requires_approval": True,
        },
        headers=emp_headers,
    )
    assert offer_resp.status_code == 200
    offer_id = offer_resp.json()["data"]["id"]
    assert offer_resp.json()["data"]["status"] == "ISSUED"

    # 18. Student views offer and accepts
    my_offers = client.get("/api/v1/offers/me", headers=student_headers)
    assert my_offers.status_code == 200
    assert any(o["id"] == offer_id for o in my_offers.json()["data"])

    accept_resp = client.post(
        f"/api/v1/offers/{offer_id}/respond",
        json={"accept": True},
        headers=student_headers,
    )
    assert accept_resp.status_code == 200
    assert accept_resp.json()["data"]["status"] == "ACCEPTED"

    # 20. Student submits placement evidence
    placement_get = client.get("/api/v1/placements/me", headers=student_headers)
    assert placement_get.status_code == 200
    placement_id = placement_get.json()["data"]["id"]

    submit_evidence = client.post(
        f"/api/v1/placements/{placement_id}/evidence",
        json={
            "designation": "Full Stack Engineer",
            "joining_date": (date.today() + timedelta(days=45)).isoformat(),
            "annual_package": 1200000,
            "work_location": "Bengaluru",
        },
        headers=student_headers,
    )
    assert submit_evidence.status_code == 200
    assert submit_evidence.json()["data"]["status"] == "PENDING_VERIFICATION"

    # 21. Institution reviews placement and verifies
    inst_placements = client.get("/api/v1/institutions/me/placements", headers=inst_headers)
    assert inst_placements.status_code == 200
    assert any(p["id"] == placement_id for p in inst_placements.json()["data"]["placements"])

    verify_placement_resp = client.post(
        f"/api/v1/institutions/me/placements/{placement_id}/verify",
        json={"action": "verify", "comment": "Verified against official company offer letter."},
        headers=inst_headers,
    )
    assert verify_placement_resp.status_code == 200
    assert verify_placement_resp.json()["data"]["status"] == "VERIFIED"

    # 22. Student verifies final placement status
    final_placement = client.get("/api/v1/placements/me", headers=student_headers)
    assert final_placement.json()["data"]["status"] == "VERIFIED"
    assert "Verified against official" in final_placement.json()["data"]["verifier_comment"]



