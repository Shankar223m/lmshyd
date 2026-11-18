import pytest
from httpx import AsyncClient

from tests.conftest import API, Hierarchy


async def test_super_admin_allowed_actions(client: AsyncClient, hierarchy: Hierarchy) -> None:
    # 1. Super admin listing super admins includes allowed_actions
    res = await client.get(f"{API}/super-admins", headers=hierarchy.root)
    assert res.status_code == 200
    data = res.json()
    items = data["super_admins"]
    assert len(items) >= 1
    root_item = items[0]
    assert "allowed_actions" in root_item
    assert "password_set" in root_item
    assert root_item["password_set"] is True
    assert "password" not in root_item
    assert "password_hash" not in root_item
    # root looking at super admins gets full actions
    assert "update" in root_item["allowed_actions"]
    assert "delete" in root_item["allowed_actions"]
    assert ("suspend" in root_item["allowed_actions"]) or ("activate" in root_item["allowed_actions"])


async def test_cannot_delete_or_suspend_last_super_admin(client: AsyncClient, hierarchy: Hierarchy) -> None:
    # Get current root user id
    me_res = await client.get(f"{API}/users/me", headers=hierarchy.root)
    assert me_res.status_code == 200
    my_id = me_res.json()["user"]["user_id"]

    # Attempting to delete oneself or last super admin should fail with 403 or 409
    res = await client.delete(f"{API}/super-admins/{my_id}", headers=hierarchy.root)
    assert res.status_code in (403, 409)
    assert res.json()["code"] in ("SELF_ACTION_NOT_ALLOWED", "LAST_SUPER_ADMIN")


async def test_cannot_suspend_self_super_admin(client: AsyncClient, hierarchy: Hierarchy) -> None:
    # Get current root user id
    me_res = await client.get(f"{API}/users/me", headers=hierarchy.root)
    assert me_res.status_code == 200
    my_id = me_res.json()["user"]["user_id"]

    res = await client.patch(
        f"{API}/super-admins/{my_id}/status",
        json={"status": "suspended"},
        headers=hierarchy.root,
    )
    assert res.status_code in (403, 409)
    assert res.json()["code"] in ("SELF_ACTION_NOT_ALLOWED", "LAST_SUPER_ADMIN")


async def test_non_super_admin_cannot_access_super_admins(client: AsyncClient, hierarchy: Hierarchy) -> None:
    res = await client.get(f"{API}/super-admins", headers=hierarchy.admin)
    assert res.status_code in (403, 404)
