from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from app.api.deps import AssetIdParam, CatalogDep, CurrentAuth, DbSession, SettingsDep, ensure_may_play, rate_limit
from app.api.responses import errors
from app.schemas.playback import PlaybackTokenOut, PlaybackTokenResponse
from app.services.media_asset_service import MediaAssetService
from app.services.playback_service import PlaybackService

router = APIRouter(tags=["Playback"])

_token_rate_limit = rate_limit("playback_token", "PLAYBACK_TOKEN_RATE_LIMIT_PER_MINUTE", 60)


@router.post(
    "/media/{asset_id}/playback-tokens",
    response_model=PlaybackTokenResponse,
    status_code=201,
    summary="Issue a playback token",
    description="A short-lived opaque token to embed in a player URL. Only for a viewer who may open a course that uses the "
    "file (an institution's student: a course their institution holds; a learner: a course they paid for), or an author. "
    "Anyone else gets 404.",
    responses=errors(400, 401, 404, 429),
    dependencies=[Depends(_token_rate_limit)],
)
async def issue_playback_token(
    asset_id: AssetIdParam, auth: CurrentAuth, db: DbSession, settings: SettingsDep, catalog: CatalogDep
) -> PlaybackTokenResponse:
    await ensure_may_play(auth, catalog, asset_id)
    asset = await MediaAssetService(db, settings).get(asset_id)
    raw_token, token = await PlaybackService(db, settings).issue_token(asset, auth.user_id)
    return PlaybackTokenResponse(
        message="Playback token issued.",
        playback=PlaybackTokenOut(token=raw_token, expires_at=token.expires_at, playback_url=f"/playback/{raw_token}"),
    )


@router.get(
    "/playback/{token}",
    summary="Resolve a playback token",
    description="No Authorization header: this is the direct URL a <video> tag loads. Redirects "
    "to a freshly presigned, short-lived storage URL.",
    responses=errors(404),
    status_code=307,
)
async def resolve_playback(token: str, db: DbSession, settings: SettingsDep) -> RedirectResponse:
    url = await PlaybackService(db, settings).resolve(token)
    return RedirectResponse(url, status_code=307)
