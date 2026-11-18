import io
from httpx import AsyncClient

from tests.conftest import API, Hierarchy


async def test_admin_creation_without_role_status_scopes_department(client: AsyncClient, root_headers: dict[str, str]) -> None:
    """Verify Admin can be created without role, status, scopes, or department.
    Backend securely defaults:
    - role to 'admin'
    - status to 'active'
    - scopes to ['accounts.manage']
    - employment to None
    """
    payload = {
        "account": {
            "email": "simplified.admin@example.com",
            "username": "simplified.admin",
            "password": "Password123!@#",
        },
        "personal_info": {
            "first_name": "Simplified",
            "last_name": "Admin",
            "phone": "+919876543210",
        },
    }
    # No role, status, scopes, department or employment specified
    response = await client.post(f"{API}/admins", json=payload, headers=root_headers)
    assert response.status_code == 201, response.text
    data = response.json().get("super_admin") or response.json().get("admin")
    
    assert data["personal_info"]["first_name"] == "Simplified"
    assert data["personal_info"]["last_name"] == "Admin"
    assert data["account"]["email"] == "simplified.admin@example.com"
    assert data["account"]["username"] == "simplified.admin"
    
    # Secure defaults enforced by backend
    assert data["role"] == "admin"
    assert data["status"] == "active"
    assert data["scopes"] == ["accounts.manage"]
    assert data["employment"] is None


async def test_admin_update_without_role_status_scopes(client: AsyncClient, root_headers: dict[str, str]) -> None:
    """Verify Admin can be updated without touching role, status, or scopes."""
    # 1. Create an admin
    create_payload = {
        "account": {
            "email": "update.test@example.com",
            "username": "update.test",
            "password": "Password123!@#",
        },
        "personal_info": {
            "first_name": "Initial",
            "last_name": "Admin",
            "phone": "+919876543210",
        },
    }
    create_resp = await client.post(f"{API}/admins", json=create_payload, headers=root_headers)
    assert create_resp.status_code == 201
    user_id = create_resp.json()["admin"]["user_id"]

    # 2. Update admin without role, status, scopes, or department
    update_payload = {
        "personal_info": {
            "first_name": "UpdatedName",
            "last_name": "Admin",
            "phone": "+919876543299",
        }
    }
    update_resp = await client.put(f"{API}/admins/{user_id}", json=update_payload, headers=root_headers)
    assert update_resp.status_code == 200, update_resp.text
    updated_data = update_resp.json()["admin"]
    assert updated_data["personal_info"]["first_name"] == "UpdatedName"
    assert updated_data["personal_info"]["phone"] == "+919876543299"
    assert updated_data["role"] == "admin"
    assert updated_data["status"] == "active"
    assert updated_data["scopes"] == ["accounts.manage"]
    assert updated_data["employment"] is None


async def test_user_form_options_for_admin_required_fields(client: AsyncClient, root_headers: dict[str, str]) -> None:
    """Verify form-options endpoint for admin requires personal details and email."""
    resp = await client.get(f"{API}/users/form-options?role=admin", headers=root_headers)
    assert resp.status_code == 200
    options = resp.json()["form_options"]
    
    # Required fields must include first name, last name, email, phone
    required = set(options["required_fields"])
    assert "personal_info.first_name" in required
    assert "personal_info.last_name" in required
    assert "account.email" in required
    assert "personal_info.phone" in required
    
    # Department must NOT be required
    assert "employment.department" not in required
    assert "department" not in required


async def test_staff_department_and_scopes_preserved(client: AsyncClient, hierarchy: Hierarchy) -> None:
    """Verify Staff module still preserves department and employment capabilities."""
    resp = await client.get(f"{API}/users/form-options?role=staff", headers=hierarchy.head)
    assert resp.status_code == 200
    options = resp.json()["form_options"]
    assert options["sections"]["employment"] is True
    assert "employment.employee_code" in options["required_fields"]


async def test_super_admin_module_independent(client: AsyncClient, root_headers: dict[str, str]) -> None:
    """Verify Super Admin creation remains independent and functional."""
    payload = {
        "account": {
            "email": "test.superadmin@example.com",
            "username": "test.superadmin",
            "password": "Password123!@#",
        },
        "personal_info": {
            "first_name": "Test",
            "last_name": "SuperAdmin",
            "phone": "+919876543210",
        },
    }
    response = await client.post(f"{API}/super-admins", json=payload, headers=root_headers)
    assert response.status_code == 201, response.text
    data = response.json().get("super_admin") or response.json().get("admin")
    assert data["role"] == "super_admin"
    assert data["status"] == "active"
