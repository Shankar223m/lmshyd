import pytest
from httpx import AsyncClient

from tests.conftest import API, Hierarchy


def _institution_payload(code: str, admin_id: str, inst_type: str = "college", custom_type: str | None = None) -> dict:
    payload = {
        "name": f"Institution {code}",
        "code": code,
        "type": inst_type,
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
    if custom_type is not None:
        payload["custom_type"] = custom_type
    return payload


async def test_create_institution_with_custom_type(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """When type is 'other', custom_type is saved and returned."""
    payload = _institution_payload("RC01", hierarchy.admin_id, inst_type="other", custom_type="Research Center")
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    inst = resp.json()["institution"]
    assert inst["type"] == "other"
    assert inst["custom_type"] == "Research Center"

    # Verify persistence on GET
    org_id = inst["organization_id"]
    get_resp = await client.get(f"{API}/institutions/{org_id}", headers=hierarchy.root)
    assert get_resp.status_code == 200
    assert get_resp.json()["institution"]["custom_type"] == "Research Center"


async def test_create_institution_with_predefined_type_clears_custom_type(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """When type is predefined, custom_type is cleared/ignored."""
    payload = _institution_payload("CL01", hierarchy.admin_id, inst_type="college", custom_type="Ignored Type")
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    inst = resp.json()["institution"]
    assert inst["type"] == "college"
    assert inst["custom_type"] is None


async def test_create_institution_other_missing_custom_type_rejected(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """When type is 'other', missing custom_type is rejected with 422."""
    payload = _institution_payload("ER01", hierarchy.admin_id, inst_type="other")
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 422


async def test_create_institution_other_whitespace_only_rejected(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """When type is 'other', whitespace-only custom_type is rejected with 422."""
    payload = _institution_payload("ER02", hierarchy.admin_id, inst_type="other", custom_type="    ")
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 422


async def test_update_institution_switch_to_other_and_back(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """Test updating type to 'other' with custom_type, then switching back to 'university'."""
    # 1. Create with college
    payload = _institution_payload("SW01", hierarchy.admin_id, inst_type="college")
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["institution"]["organization_id"]

    # 2. Switch to 'other' with 'Training Academy'
    update_payload = {"type": "other", "custom_type": "Training Academy"}
    resp2 = await client.put(f"{API}/institutions/{org_id}", json=update_payload, headers=hierarchy.root)
    assert resp2.status_code == 200, resp2.text
    inst2 = resp2.json()["institution"]
    assert inst2["type"] == "other"
    assert inst2["custom_type"] == "Training Academy"

    # 3. Switch from 'other' to 'university'; custom_type should be cleared
    update_payload2 = {"type": "university"}
    resp3 = await client.put(f"{API}/institutions/{org_id}", json=update_payload2, headers=hierarchy.root)
    assert resp3.status_code == 200, resp3.text
    inst3 = resp3.json()["institution"]
    assert inst3["type"] == "university"
    assert inst3["custom_type"] is None


async def test_create_institution_multiline_custom_type_up_to_500_chars(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """Multi-line custom type with newlines and up to 500 chars is accepted and preserved."""
    multiline_desc = (
        "Advanced Quantum Research Laboratory\n"
        "Specializing in photonic computing and quantum cryptography.\n"
        "Affiliated with National Science Consortium.\n"
        + ("x" * 200)
    )
    assert len(multiline_desc) <= 500
    payload = _institution_payload("ML01", hierarchy.admin_id, inst_type="other", custom_type=multiline_desc)
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 201, resp.text
    inst = resp.json()["institution"]
    assert inst["type"] == "other"
    assert inst["custom_type"] == multiline_desc


async def test_create_institution_custom_type_exceeding_500_chars_rejected(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """Custom type exceeding 500 chars is rejected by schema validation."""
    long_desc = "A" * 501
    payload = _institution_payload("EX01", hierarchy.admin_id, inst_type="other", custom_type=long_desc)
    resp = await client.post(f"{API}/institutions", json=payload, headers=hierarchy.root)
    assert resp.status_code == 422

