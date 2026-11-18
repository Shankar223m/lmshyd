"""Profile photos, institution logos and the white-label brand colour."""

import base64

from httpx import AsyncClient

from tests.conftest import API, Hierarchy, institution_payload

# A real 1x1 PNG, a JPEG and a WebP signature (the service only needs the file signature to tell them apart).
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHbPKJAAAAABJRU5ErkJggg==")
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 24


def raw(headers: dict[str, str], content_type: str = "image/png") -> dict[str, str]:
    return {**headers, "Content-Type": content_type}


async def test_a_person_sets_shows_and_removes_their_own_photo(client: AsyncClient, hierarchy: Hierarchy) -> None:
    url = f"{API}/users/{hierarchy.student_id}/avatar"
    assert (await client.get(url, headers=hierarchy.student)).status_code == 404

    saved = await client.put(url, content=PNG, headers=raw(hierarchy.student))
    assert saved.status_code == 200, saved.text
    assert saved.json()["user"]["avatar_version"] == 1

    shown = await client.get(url, headers=hierarchy.student)
    assert shown.status_code == 200 and shown.content == PNG and shown.headers["content-type"] == "image/png"
    assert shown.headers["x-content-type-options"] == "nosniff"

    again = await client.put(url, content=JPEG, headers=raw(hierarchy.student, "image/jpeg"))
    assert again.json()["user"]["avatar_version"] == 2

    removed = await client.delete(url, headers=hierarchy.student)
    assert removed.status_code == 200 and removed.json()["user"]["avatar_version"] == 0
    assert (await client.get(url, headers=hierarchy.student)).status_code == 404


async def test_the_type_comes_from_the_file_not_the_header(client: AsyncClient, hierarchy: Hierarchy) -> None:
    url = f"{API}/users/{hierarchy.student_id}/avatar"
    not_a_picture = await client.put(url, content=b"<svg onload=alert(1)></svg>", headers=raw(hierarchy.student))
    assert not_a_picture.status_code == 422
    assert not_a_picture.json()["code"] == "IMAGE_TYPE_NOT_ALLOWED"
    assert (await client.put(url, content=WEBP, headers=raw(hierarchy.student, "image/webp"))).status_code == 200
    assert (await client.put(url, content=b"", headers=raw(hierarchy.student))).status_code == 422


async def test_a_picture_over_the_limit_is_refused(client: AsyncClient, hierarchy: Hierarchy) -> None:
    url = f"{API}/users/{hierarchy.student_id}/avatar"
    too_big = PNG + b"\x00" * (256 * 1024)
    response = await client.put(url, content=too_big, headers=raw(hierarchy.student))
    assert response.status_code == 422 and response.json()["code"] == "IMAGE_TOO_LARGE"


async def test_who_may_change_whose_photo(client: AsyncClient, hierarchy: Hierarchy) -> None:
    student_url = f"{API}/users/{hierarchy.student_id}/avatar"
    # a student cannot change a staff member's photo, nor see a head's
    assert (await client.put(f"{API}/users/{hierarchy.staff_id}/avatar", content=PNG, headers=raw(hierarchy.student))).status_code in (403, 404)
    # staff manage their students; the head above them does too
    assert (await client.put(student_url, content=PNG, headers=raw(hierarchy.staff))).status_code == 200
    assert (await client.put(student_url, content=PNG, headers=raw(hierarchy.head))).status_code == 200
    # nobody signed out can reach it
    assert (await client.get(student_url)).status_code == 401


async def test_the_creator_can_set_a_photo_for_someone_they_created(client: AsyncClient, hierarchy: Hierarchy) -> None:
    saved = await client.put(f"{API}/users/{hierarchy.head_id}/avatar", content=PNG, headers=raw(hierarchy.admin))
    assert saved.status_code == 200, saved.text
    listed = await client.get(f"{API}/users", params={"role": "institution_head"}, headers=hierarchy.admin)
    assert [u["avatar_version"] for u in listed.json()["users"]] == [1]


async def test_an_institution_gets_a_logo_and_a_brand_colour(client: AsyncClient, hierarchy: Hierarchy) -> None:
    org = hierarchy.organization_id
    assert (await client.get(f"{API}/institutions/{org}/logo", headers=hierarchy.student)).status_code == 404

    updated = await client.put(f"{API}/institutions/{org}", json={"brand_color": "#1a73e8"}, headers=hierarchy.admin)
    assert updated.status_code == 200, updated.text
    assert updated.json()["institution"]["brand_color"] == "#1A73E8"  # stored upper case

    saved = await client.put(f"{API}/institutions/{org}/logo", content=PNG, headers=raw(hierarchy.admin))
    assert saved.status_code == 200, saved.text
    assert saved.json()["institution"]["logo_version"] == 1

    # the institution's own members get the logo and the colour with their sign-in profile
    me = (await client.get(f"{API}/users/me", headers=hierarchy.student)).json()["user"]
    assert me["institution"]["brand_color"] == "#1A73E8" and me["institution"]["logo_version"] == 1
    logo = await client.get(f"{API}/institutions/{org}/logo", headers=hierarchy.student)
    assert logo.status_code == 200 and logo.content == PNG

    # but members cannot change it
    assert (await client.put(f"{API}/institutions/{org}/logo", content=PNG, headers=raw(hierarchy.head))).status_code in (403, 404)
    assert (await client.put(f"{API}/institutions/{org}", json={"brand_color": "#000000"}, headers=hierarchy.head)).status_code in (403, 404)

    removed = await client.delete(f"{API}/institutions/{org}/logo", headers=hierarchy.admin)
    assert removed.json()["institution"]["logo_version"] == 0
    assert (await client.get(f"{API}/institutions/{org}/logo", headers=hierarchy.student)).status_code == 404


async def test_only_a_real_colour_is_accepted(client: AsyncClient, hierarchy: Hierarchy) -> None:
    org = hierarchy.organization_id
    for bad in ("red", "#12345", "#GGGGGG", "url(javascript:1)", "#1a73e8; background:red"):
        response = await client.put(f"{API}/institutions/{org}", json={"brand_color": bad}, headers=hierarchy.admin)
        assert response.status_code == 422, bad
    created = await client.post(
        f"{API}/institutions", json=institution_payload("COL-01", brand_color="#0f766e"), headers=hierarchy.admin
    )
    assert created.status_code == 201, created.text
    assert created.json()["institution"]["brand_color"] == "#0F766E"
