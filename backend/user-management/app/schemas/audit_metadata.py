# Audit metadata schemas per event type

"""Metadata validation and allow‑list for audit log details.

Each audit event action has a prefix (e.g. ``user.``, ``auth.``, ``job.``).
The ``METADATA_SCHEMA_MAP`` maps that prefix to a Pydantic model that
specifies which keys are safe to expose.  The sanitiser in
``AuditLogService._to_out`` uses this map to filter ``details``.

Fields not listed are dropped.  String fields are limited to 200
characters and HTML‑escaped.  Collections are truncated to a maximum of
20 entries.  Nested structures are handled recursively via the model
definition.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any

# ---- Example schemas -------------------------------------------------------

class UserStatusChangeMeta(BaseModel):
    """Metadata for ``user.status_changed`` events."""

    from_status: str = Field(..., description="Previous status")
    to_status: str = Field(..., description="New status")
    reason: str | None = Field(None, max_length=200)

class AuthLoginMeta(BaseModel):
    """Metadata for ``auth.login`` events."""

    method: str = Field(..., description="Login method, e.g. password, oauth")
    success: bool = Field(...)
    ip_country: str | None = Field(None, max_length=2, description="ISO country code")
    parameters: Dict[str, Any] = Field(default_factory=dict)

class JobExecutionMeta(BaseModel):
    """Metadata for background ``job`` events."""

    job_name: str = Field(...)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    result: str | None = Field(None, max_length=200)

# ---- Mapping --------------------------------------------------------------

# The key is the action prefix (the part before the first dot).
# If an action is not listed here the sanitiser will drop the entire
# ``details`` payload for safety.
METADATA_SCHEMA_MAP: dict[str, type[BaseModel]] = {
    "user": UserStatusChangeMeta,
    "auth": AuthLoginMeta,
    "job": JobExecutionMeta,
}

# Note: additional schemas can be added as new audit events are created.
