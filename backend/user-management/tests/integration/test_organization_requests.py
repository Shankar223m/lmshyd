"""Organizations ask for a workspace; only a super admin sees and decides the requests."""

from typing import Any

from httpx import AsyncClient

from tests.conftest import API

REQUEST = {
    "name": "Acme College", "org_type": "College", "official_email": "Info@Acme.edu", "phone": "+91 98765 43210", "website": "https://acme.edu",
    "country": "India", "state": "Telangana", "city": "Hyderabad", "address": "1 Main Road", "size": "201-500",
    "owner_name": "Priya Nair", "owner_email": "Priya@Acme.edu", "owner_phone": "9876543210", "owner_designation": "Principal",
}


async def test_anyone_can_ask_and_no_password_is_collected(client: AsyncClient) -> None:
    response = await client.post(f"{API}/organization-requests", json=REQUEST)
    assert response.status_code == 201, response.text
    body = response.json()["request"]
    assert body["status"] == "pending" and body["owner_email"] == "priya@acme.edu" and "password" not in body


async def test_a_second_pending_request_from_the_same_owner_is_refused(client: AsyncClient) -> None:
    await client.post(f"{API}/organization-requests", json=REQUEST)
    again = await client.post(f"{API}/organization-requests", json=REQUEST)
    assert again.status_code == 409 and again.json()["code"] == "REQUEST_ALREADY_PENDING"


async def test_a_bad_request_is_refused(client: AsyncClient) -> None:
    assert (await client.post(f"{API}/organization-requests", json={**REQUEST, "owner_email": "not-an-email"})).status_code == 422
    assert (await client.post(f"{API}/organization-requests", json={**REQUEST, "name": " "})).status_code == 422


async def test_the_public_cannot_read_or_decide_requests(client: AsyncClient) -> None:
    await client.post(f"{API}/organization-requests", json=REQUEST)
    assert (await client.get(f"{API}/organization-requests")).status_code == 401


async def test_a_super_admin_reviews_and_decides_each_request_once(client: AsyncClient, root_headers: dict[str, str]) -> None:
    await client.post(f"{API}/organization-requests", json=REQUEST)
    await client.post(f"{API}/organization-requests", json={**REQUEST, "name": "Beta Institute", "owner_email": "owner@beta.edu"})

    pending: Any = (await client.get(f"{API}/organization-requests", params={"status": "pending"}, headers=root_headers)).json()
    assert len(pending["requests"]) == 2
    first, second = pending["requests"][0]["request_id"], pending["requests"][1]["request_id"]

    approved = await client.post(f"{API}/organization-requests/{first}/approve", json={"note": "Verified"}, headers=root_headers)
    assert approved.status_code == 200 and approved.json()["request"]["status"] == "approved"
    rejected = await client.post(f"{API}/organization-requests/{second}/reject", json={"note": "Not an institution"}, headers=root_headers)
    assert rejected.json()["request"]["status"] == "rejected"

    again = await client.post(f"{API}/organization-requests/{first}/reject", json={}, headers=root_headers)
    assert again.status_code == 409 and again.json()["code"] == "REQUEST_ALREADY_DECIDED"
    assert (await client.get(f"{API}/organization-requests", params={"status": "pending"}, headers=root_headers)).json()["requests"] == []
    assert (await client.post(f"{API}/organization-requests/999/approve", json={}, headers=root_headers)).status_code == 404
