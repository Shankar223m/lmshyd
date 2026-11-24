from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy import select, update

from app.api.deps import CurrentUser, DbSession, attach_request_id
from app.core.exceptions import AppError
from app.core.responses import success_data
from app.models.entities import Notification, StoredFile
from app.modules.files.access import can_access_file
from app.modules.audit.service import record_audit
from app.modules.notifications.links import notification_link_path
from app.modules.files.storage import file_storage

router = APIRouter(tags=["files", "notifications"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


@router.post("/files/upload")
async def upload_file(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    category: str = "general",
    file: UploadFile = File(...),
    _: str = Depends(attach_request_id),
):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError("FILE_TOO_LARGE", "File exceeds 10MB limit", 400)
    ct = file.content_type or "application/octet-stream"
    if category not in ("csv_import",) and ct not in ALLOWED_CONTENT_TYPES:
        raise AppError("INVALID_FILE_TYPE", "File type not allowed", 400)
    record = file_storage.save_bytes(
        db,
        owner_id=user.id,
        original_name=file.filename or "upload.bin",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        category=category,
    )
    record_audit(
        db,
        actor_id=user.id,
        action="file.upload",
        resource_type="file",
        resource_id=record.id,
        metadata={"category": category, "size_bytes": record.size_bytes, "content_type": record.content_type},
    )
    db.commit()
    return success_data({"id": record.id, "original_name": record.original_name}, request)


@router.get("/files/{file_id}")
@router.get("/files/{file_id}/download")
def download_file(
    file_id: str,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    record = db.get(StoredFile, file_id)
    if not record:
        raise AppError("NOT_FOUND", "File not found", 404)
    if not can_access_file(db, user, record):
        raise AppError("FORBIDDEN", "You cannot access this file", 403)
    try:
        content = file_storage.read_bytes(record)
    except FileNotFoundError:
        raise AppError("NOT_FOUND", "File data missing from storage", 404)

    return Response(
        content=content,
        media_type=record.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{record.original_name}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.get("/notifications")
def list_notifications(db: DbSession, user: CurrentUser, request: Request, _: str = Depends(attach_request_id)):
    notes = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc())
    ).all()
    return success_data(
        [
            {
                "id": n.id,
                "title": n.title,
                "body": n.body,
                "read": n.read,
                "resource_type": n.resource_type,
                "resource_id": n.resource_id,
                "link_path": notification_link_path(
                    role=user.role,
                    resource_type=n.resource_type,
                    resource_id=n.resource_id,
                ),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes[:50]
        ],
        request,
    )


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    note = db.get(Notification, notification_id)
    if not note or note.user_id != user.id:
        raise AppError("NOT_FOUND", "Notification not found", 404)
    note.read = True
    db.commit()
    return success_data({"id": note.id, "read": True}, request)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    db: DbSession,
    user: CurrentUser,
    request: Request,
    _: str = Depends(attach_request_id),
):
    db.execute(
        update(Notification).where(Notification.user_id == user.id, Notification.read == False).values(read=True)  # noqa: E712
    )
    db.commit()
    return success_data({"status": "ok"}, request)
