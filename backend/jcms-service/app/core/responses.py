from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


def error_response(code: str, message: str, status_code: int, request: Request, details=None):
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


def success_data(data: Any, request: Request, pagination: dict | None = None):
    body: dict[str, Any] = {
        "data": data,
        "meta": {"request_id": getattr(request.state, "request_id", None)},
    }
    if pagination is not None:
        body["pagination"] = pagination
    return body
