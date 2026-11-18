import pytest
from httpx import AsyncClient

from tests.conftest import API, Hierarchy


def _base_institution(code: str, admin_id: str) -> dict:
    return {
        "name": f"Institution {code}",
        "code": code,
        "type": "college",
        "admin_user_id": str(admin_id),
        "contact": {
            "email": f"contact@{code.lower()}.example.com",
            "phone": "+919876543210",
        },
        "address": {
            "line1": "123 Campus Road",
            "city": "Hyderabad",
            "state": "Telangana",
            "postal_code": "500001",
            "country": "IN",
        },
    }


async def test_create_institution_with_online_presence(client: AsyncClient, hierarchy: Hierarchy) -> None:
    payload = _base_institution("OP01", hierarchy.admin_id)
    payload["website"] = "https://www.genztestcollege.edu.in"
    payload["linkedin_url"] = "https://www.linkedin.com/school/example-college/"
    payload["instagram_url"] = "https://www.instagram.com/examplecollege/"
    payload["facebook_url"] = "https://www.facebook.com/examplecollege"
    payload["youtube_url"] = "https://www.youtube.com/@examplecollege"
    payload["twitter_url"] = "https://x.com/examplecollege"

    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    inst = resp.json()["institution"]
    assert inst["website"] == "https://www.genztestcollege.edu.in"
    assert inst["linkedin_url"] == "https://www.linkedin.com/school/example-college/"
    assert inst["instagram_url"] == "https://www.instagram.com/examplecollege/"
    assert inst["facebook_url"] == "https://www.facebook.com/examplecollege"
    assert inst["youtube_url"] == "https://www.youtube.com/@examplecollege"
    assert inst["twitter_url"] == "https://x.com/examplecollege"
    assert inst["x_url"] == "https://x.com/examplecollege"
    assert inst["contact"]["website"] == "https://www.genztestcollege.edu.in"

    # Verify persistence on GET
    org_id = inst["organization_id"]
    get_resp = await client.get(f"{API}/institutions/{org_id}", headers=hierarchy.root)
    assert get_resp.status_code == 200
    fetched = get_resp.json()["institution"]
    assert fetched["website"] == "https://www.genztestcollege.edu.in"
    assert fetched["linkedin_url"] == "https://www.linkedin.com/school/example-college/"
    assert fetched["instagram_url"] == "https://www.instagram.com/examplecollege/"
    assert fetched["facebook_url"] == "https://www.facebook.com/examplecollege"
    assert fetched["youtube_url"] == "https://www.youtube.com/@examplecollege"
    assert fetched["twitter_url"] == "https://x.com/examplecollege"
    assert fetched["x_url"] == "https://x.com/examplecollege"


async def test_create_institution_without_online_presence(client: AsyncClient, hierarchy: Hierarchy) -> None:
    payload = _base_institution("OP02", hierarchy.admin_id)
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    inst = resp.json()["institution"]
    assert inst["website"] is None
    assert inst["linkedin_url"] is None
    assert inst["instagram_url"] is None
    assert inst["facebook_url"] is None
    assert inst["youtube_url"] is None
    assert inst["twitter_url"] is None
    assert inst["x_url"] is None


async def test_update_institution_online_presence(client: AsyncClient, hierarchy: Hierarchy) -> None:
    payload = _base_institution("OP03", hierarchy.admin_id)
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201
    org_id = resp.json()["institution"]["organization_id"]

    # Update online presence links
    update_payload = {
        "website": "https://updated.college.edu",
        "linkedin_url": "https://linkedin.com/school/updated",
        "x_url": "https://x.com/updated",
    }
    put_resp = await client.put(f"{API}/institutions/{org_id}", json=update_payload, headers=hierarchy.root)
    assert put_resp.status_code == 200, put_resp.text
    updated = put_resp.json()["institution"]
    assert updated["website"] == "https://updated.college.edu"
    assert updated["linkedin_url"] == "https://linkedin.com/school/updated"
    assert updated["twitter_url"] == "https://x.com/updated"
    assert updated["x_url"] == "https://x.com/updated"


async def test_invalid_online_presence_url_rejected(client: AsyncClient, hierarchy: Hierarchy) -> None:
    payload = _base_institution("OP04", hierarchy.admin_id)
    payload["website"] = "not-a-valid-url"
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 422
