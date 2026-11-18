"""A lesson file plays only for someone who may open a course that uses it.

catalog-service knows which courses use a file and (through learning-service) who is enrolled; here it is faked. An
institution student is enrolled in the courses their institution holds, a learner in the ones they paid for; authors and
reviewers open any file. Everyone else gets 404, and an outage answers 503 rather than opening the file.
"""

from httpx import AsyncClient

from tests.conftest import TEST_USER_ID
from tests.integration.test_upload_and_playback import AUTHOR, _put_fake_object, _run_worker_transcode, _start_upload

VIEWER = 1755000000000555


async def _ready_video(client: AsyncClient, authed, app) -> str:
    body = await _start_upload(client, authed)
    asset_id = body["asset"]["asset_id"]
    await _put_fake_object(body["upload"]["fields"])
    authed(scopes=AUTHOR)
    await client.post(f"/api/v1/media/{asset_id}/complete")
    await _run_worker_transcode(app, asset_id)
    return asset_id


async def test_only_an_entitled_viewer_gets_a_playback_token(client: AsyncClient, authed, app, stub_ffmpeg) -> None:
    asset_id = await _ready_video(client, authed, app)

    authed(scopes=(), user_id=VIEWER)  # a student who is not enrolled in any course using this file
    assert (await client.post(f"/api/v1/media/{asset_id}/playback-tokens")).status_code == 404
    assert (await client.get(f"/api/v1/media/{asset_id}")).status_code == 404  # nor can they read its details

    app.state.catalog.allow(asset_id, VIEWER)  # their institution holds the course / they paid for it
    assert (await client.post(f"/api/v1/media/{asset_id}/playback-tokens")).status_code == 201
    assert (await client.get(f"/api/v1/media/{asset_id}")).status_code == 200

    authed(scopes=(), user_id=VIEWER + 1)  # someone else is still refused
    assert (await client.post(f"/api/v1/media/{asset_id}/playback-tokens")).status_code == 404


async def test_authors_open_any_file_without_asking(client: AsyncClient, authed, app, stub_ffmpeg) -> None:
    asset_id = await _ready_video(client, authed, app)
    authed(scopes=AUTHOR, user_id=TEST_USER_ID)
    assert (await client.post(f"/api/v1/media/{asset_id}/playback-tokens")).status_code == 201


async def test_when_catalog_cannot_be_asked_the_file_stays_closed(client: AsyncClient, authed, app, stub_ffmpeg) -> None:
    asset_id = await _ready_video(client, authed, app)
    app.state.catalog.allow(asset_id, VIEWER)
    app.state.catalog.down = True
    authed(scopes=(), user_id=VIEWER)
    assert (await client.post(f"/api/v1/media/{asset_id}/playback-tokens")).status_code == 503


async def test_the_media_library_is_for_authors(client: AsyncClient, authed) -> None:
    authed(scopes=())
    assert (await client.get("/api/v1/media")).status_code == 403
    authed(scopes=AUTHOR)
    assert (await client.get("/api/v1/media")).status_code == 200


async def test_the_stream_url_needs_a_playback_token_for_video_and_documents(client: AsyncClient, authed, app, stub_ffmpeg) -> None:
    asset_id = await _ready_video(client, authed, app)
    # no login and no token: the file does not exist for the caller
    assert (await client.get(f"/api/v1/media/stream/{asset_id}")).status_code == 404
    assert (await client.get(f"/api/v1/media/stream/{asset_id}", params={"playback": "not-a-token"})).status_code == 404
