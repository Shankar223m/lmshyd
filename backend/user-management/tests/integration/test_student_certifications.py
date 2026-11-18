"""Tests for student professional profiles, certifications, and document upload."""

import io
from httpx import AsyncClient

from tests.conftest import API, Hierarchy, student_payload


async def test_student_professional_profiles_and_certifications(client: AsyncClient, hierarchy: Hierarchy) -> None:
    # 1. Test certificate file upload (PDF with %PDF header)
    pdf_bytes = b"%PDF-1.4 sample content for certificate testing"
    files = {"file": ("cert.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    upload_res = await client.post(f"{API}/users/certificates/upload", files=files, headers=hierarchy.staff)
    assert upload_res.status_code == 200, upload_res.text
    doc_url = upload_res.json()["document_url"]
    assert doc_url.startswith("/api/v1/users/certificates/")
    filename = doc_url.split("/")[-1]

    # Test downloading certificate document with auth
    download_res = await client.get(f"{API}/users/certificates/{filename}", headers=hierarchy.staff)
    assert download_res.status_code == 200
    assert download_res.content == pdf_bytes

    # Test downloading without auth fails (401)
    unauth_res = await client.get(f"{API}/users/certificates/{filename}")
    assert unauth_res.status_code == 401

    # 2. Test student creation with professional URLs and certifications
    payload = student_payload("alex.coder")
    payload["student"]["linkedin_url"] = "https://www.linkedin.com/in/alexcoder"
    payload["student"]["github_url"] = "https://github.com/alexcoder"
    payload["student"]["hackerrank_url"] = "https://www.hackerrank.com/alexcoder"
    payload["student"]["leetcode_url"] = "https://leetcode.com/u/alexcoder/"
    payload["student"]["certifications"] = [
        {
            "name": "AWS Certified Developer",
            "issuing_organization": "Amazon Web Services",
            "issue_date": "2024-01-15",
            "expiration_date": "2027-01-15",
            "credential_id": "AWS-DEV-98765",
            "credential_url": "https://aws.amazon.com/verify",
            "document_url": doc_url,
        }
    ]

    created = await client.post(f"{API}/users", json=payload, headers=hierarchy.staff)
    assert created.status_code == 201, created.text
    student_data = created.json()["user"]["student"]
    assert student_data["linkedin_url"] == "https://www.linkedin.com/in/alexcoder"
    assert student_data["github_url"] == "https://github.com/alexcoder"
    assert student_data["hackerrank_url"] == "https://www.hackerrank.com/alexcoder"
    assert student_data["leetcode_url"] == "https://leetcode.com/u/alexcoder/"
    assert len(student_data["certifications"]) == 1
    cert = student_data["certifications"][0]
    assert cert["name"] == "AWS Certified Developer"
    assert cert["issuing_organization"] == "Amazon Web Services"
    assert cert["credential_id"] == "AWS-DEV-98765"
    assert cert["document_url"] == doc_url

    # 3. Test student details fetch returns the certifications
    user_id = created.json()["user"]["user_id"]
    fetched = await client.get(f"{API}/users/{user_id}", headers=hierarchy.staff)
    assert fetched.status_code == 200
    fetched_student = fetched.json()["user"]["student"]
    assert len(fetched_student["certifications"]) == 1
    assert fetched_student["certifications"][0]["name"] == "AWS Certified Developer"

    # 4. Test student update: add another certification and update links
    updated = await client.put(
        f"{API}/users/{user_id}",
        json={
            "student": {
                "github_url": "https://github.com/alexcoder-updated",
                "certifications": [
                    {
                        "name": "AWS Certified Developer",
                        "issuing_organization": "Amazon Web Services",
                        "issue_date": "2024-01-15",
                        "expiration_date": "2027-01-15",
                        "credential_id": "AWS-DEV-98765",
                        "credential_url": "https://aws.amazon.com/verify",
                        "document_url": doc_url,
                    },
                    {
                        "name": "Kubernetes Administrator",
                        "issuing_organization": "CNCF",
                        "issue_date": "2024-05-10",
                    },
                ],
            }
        },
        headers=hierarchy.staff,
    )
    assert updated.status_code == 200, updated.text
    updated_student = updated.json()["user"]["student"]
    assert updated_student["github_url"] == "https://github.com/alexcoder-updated"
    assert len(updated_student["certifications"]) == 2
    assert updated_student["certifications"][1]["name"] == "Kubernetes Administrator"

    # 5. Validation test: expiration before issue date fails
    invalid_dates = await client.put(
        f"{API}/users/{user_id}",
        json={
            "student": {
                "certifications": [
                    {
                        "name": "Invalid Dates Cert",
                        "issue_date": "2025-01-01",
                        "expiration_date": "2024-01-01",
                    }
                ]
            }
        },
        headers=hierarchy.staff,
    )
    assert invalid_dates.status_code == 422
