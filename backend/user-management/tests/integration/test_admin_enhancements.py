import io
from httpx import AsyncClient

from tests.conftest import API, SUPER_ADMIN_EMAIL, SUPER_ADMIN_USERNAME, STRONG_PASSWORD


async def test_username_generation_and_uniqueness(client: AsyncClient, root_headers: dict[str, str]) -> None:
    # 1. Generate username for Rahul Sharma
    resp = await client.get(
        f"{API}/users/generate-username?first_name=Rahul&last_name=Sharma",
        headers=root_headers,
    )
    assert resp.status_code == 200
    username = resp.json()["username"]
    assert username == "rahul.sharma"

    # 2. Check username availability
    check_resp = await client.get(
        f"{API}/users/check-username?username=rahul.sharma",
        headers=root_headers,
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["available"] is True

    # 3. Create an admin with this username
    create_body = {
        "account": {"email": "rahul.sharma@example.com", "username": "rahul.sharma"},
        "personal_info": {"first_name": "Rahul", "last_name": "Sharma", "phone": "+919876543210"},
    }
    create_resp = await client.post(f"{API}/admins", json=create_body, headers=root_headers)
    assert create_resp.status_code == 201
    admin_data = create_resp.json()["admin"]
    assert admin_data["account"]["username"] == "rahul.sharma"

    # 4. Now generate username for another Rahul Sharma - should generate rahul.sharma2!
    resp2 = await client.get(
        f"{API}/users/generate-username?first_name=Rahul&last_name=Sharma",
        headers=root_headers,
    )
    assert resp2.status_code == 200
    username2 = resp2.json()["username"]
    assert username2 == "rahul.sharma2"

    # 5. Check availability of original rahul.sharma - should now be taken
    check_resp2 = await client.get(
        f"{API}/users/check-username?username=rahul.sharma",
        headers=root_headers,
    )
    assert check_resp2.status_code == 200
    assert check_resp2.json()["available"] is False


async def test_password_generation(client: AsyncClient, root_headers: dict[str, str]) -> None:
    resp = await client.get(f"{API}/users/generate-password", headers=root_headers)
    assert resp.status_code == 200
    password = resp.json()["password"]
    assert len(password) >= 12
    assert any(c.isupper() for c in password)
    assert any(c.islower() for c in password)
    assert any(c.isdigit() for c in password)
    assert any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?" for c in password)


async def test_avatar_upload_and_validation(client: AsyncClient, root_headers: dict[str, str]) -> None:
    # 1. Valid PNG upload
    valid_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    upload_resp = await client.post(
        f"{API}/users/avatar/upload",
        files={"file": ("profile.png", io.BytesIO(valid_png), "image/png")},
        headers=root_headers,
    )
    assert upload_resp.status_code == 200
    avatar_url = upload_resp.json()["avatar_url"]
    assert avatar_url.startswith("/api/v1/users/avatar/")

    # 2. Fetch the uploaded avatar
    avatar_filename = avatar_url.split("/")[-1]
    get_resp = await client.get(f"{API}/users/avatar/{avatar_filename}")
    assert get_resp.status_code == 200
    assert get_resp.headers["content-type"] == "image/png"
    assert get_resp.headers["x-content-type-options"] == "nosniff"

    # 3. Invalid file format rejected
    invalid_file = b"not an image file"
    inv_resp = await client.post(
        f"{API}/users/avatar/upload",
        files={"file": ("document.txt", io.BytesIO(invalid_file), "text/plain")},
        headers=root_headers,
    )
    assert inv_resp.status_code == 422

    # 4. Oversized file rejected (> 2 MB)
    oversized = b"\x89PNG\r\n\x1a\n" + b"\x00" * (2 * 1024 * 1024 + 10)
    over_resp = await client.post(
        f"{API}/users/avatar/upload",
        files={"file": ("huge.png", io.BytesIO(oversized), "image/png")},
        headers=root_headers,
    )
    assert over_resp.status_code == 422


async def test_admin_creation_with_avatar_and_credentials(client: AsyncClient, root_headers: dict[str, str]) -> None:
    # 1. Upload an avatar
    valid_jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 100
    upload_resp = await client.post(
        f"{API}/users/avatar/upload",
        files={"file": ("admin_pic.jpg", io.BytesIO(valid_jpg), "image/jpeg")},
        headers=root_headers,
    )
    assert upload_resp.status_code == 200
    avatar_url = upload_resp.json()["avatar_url"]

    # 2. Generate a secure password
    pw_resp = await client.get(f"{API}/users/generate-password", headers=root_headers)
    generated_pw = pw_resp.json()["password"]

    # 3. Create Admin
    create_body = {
        "account": {
            "email": "priya.reddy@example.com",
            "username": "priya.reddy",
            "password": generated_pw,
        },
        "personal_info": {
            "first_name": "Priya",
            "last_name": "Reddy",
            "phone": "+919876543222",
            "avatar_url": avatar_url,
        },
    }
    create_resp = await client.post(f"{API}/admins", json=create_body, headers=root_headers)
    assert create_resp.status_code == 201
    created_admin = create_resp.json()["admin"]
    assert created_admin["avatar_url"] == avatar_url
    assert created_admin["personal_info"]["avatar_url"] == avatar_url
    assert created_admin["account"]["username"] == "priya.reddy"
    assert created_admin["account"]["must_change_password"] is True
    # Ensure password hash is NOT exposed
    assert "password_hash" not in str(create_resp.json())

    user_id = created_admin["user_id"]

    # 4. Verify admin list includes avatar_url and username
    list_resp = await client.get(f"{API}/admins", headers=root_headers)
    assert list_resp.status_code == 200
    admins = list_resp.json()["admins"]
    matched = next((a for a in admins if a["user_id"] == user_id), None)
    assert matched is not None
    assert matched["avatar_url"] == avatar_url
    assert matched["username"] == "priya.reddy"
    assert matched["email"] == "priya.reddy@example.com"
    assert matched["role"] == "admin"
    assert matched["status"] == "active"
    assert matched["created_time"] is not None

    # 5. Verify admin details
    get_admin_resp = await client.get(f"{API}/admins/{user_id}", headers=root_headers)
    assert get_admin_resp.status_code == 200
    admin_detail = get_admin_resp.json()["admin"]
    assert admin_detail["avatar_url"] == avatar_url
    assert admin_detail["personal_info"]["avatar_url"] == avatar_url
