# Tests for audit detail sanitisation (Stage 1)

import pytest
import asyncio
from uuid import uuid4

from app.models.audit_log import AuditLog
from app.services.audit_log_service import AuditLogService
from app.schemas.audit_metadata import METADATA_SCHEMA_MAP

# Helper subclass to avoid DB calls
class TestAuditLogService(AuditLogService):
    def __init__(self):
        # Pass a dummy None session – methods we use do not require it
        super().__init__(db=None)

    async def _by_id(self, model, ids):
        # Return empty dicts for lookups – target resolution not needed for sanitiser tests
        return {}

@pytest.mark.asyncio
async def test_sanitiser_unknown_prefix_results_in_none():
    service = TestAuditLogService()
    log = AuditLog(
        public_id=1,
        action="unknown.event",
        details={"_action": "unknown.event", "secret": "should be dropped"},
    )
    out = await service._to_out([log])
    assert out[0].details is None

@pytest.mark.asyncio
async def test_sanitiser_known_prefix_allows_fields_and_truncates():
    service = TestAuditLogService()
    long_reason = "a" * 250
    log = AuditLog(
        public_id=2,
        action="user.status_changed",
        details={
            "_action": "user.status_changed",
            "from_status": "active",
            "to_status": "suspended",
            "reason": long_reason,
            "password": "hidden",
            "list_items": list(range(30)),
            "nested": {"secret_key": "value", "info": "ok"},
        },
    )
    out = await service._to_out([log])
    details = out[0].details
    # Should contain allowed fields only, truncated reason
    assert set(details.keys()) == {"from_status", "to_status", "reason"}
    assert details["reason"].endswith("...")  # truncated indicator
    assert len(details["reason"]) <= 203  # 200 chars + ellipsis

@pytest.mark.asyncio
async def test_sanitiser_html_escaping_and_collection_limits():
    service = TestAuditLogService()
    html_str = "<script>alert('x')</script>"
    log = AuditLog(
        public_id=3,
        action="auth.login",
        details={
            "_action": "auth.login",
            "method": html_str,
            "success": True,
            "ip_country": "US",
            "extra": "should be dropped",
            "parameters": {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8, "i": 9, "j": 10, "k": 11},
        },
    )
    out = await service._to_out([log])
    details = out[0].details
    # HTML should be escaped
    assert details["method"] == "&lt;script&gt;alert('x')&lt;/script&gt;"
    # Collection params dict should be truncated to 20 items (here 11 -> unchanged)
    assert len(details["parameters"]) == 11

# Integration tests – patching AuditLogService used by API endpoints
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(autouse=True)
def patch_audit_service(monkeypatch):
    from app.core.time import utcnow
    from app.services.audit_log_service import _sanitize
    from app.schemas.audit import AuditLogOut
    from app.api.deps import _require_password_current, AuthContext
    from app.models.user import User
    from app.models.session import UserSession
    from app.permissions.roles import Role

    class MockService:
        async def list_rbac_logs(self, user, query):
            details = {
                "_action": "user.status_changed",
                "from_status": "active",
                "to_status": "suspended",
                "reason": "test",
                "password": "secret",
            }
            log = AuditLogOut(
                audit_log_id=4,
                time=utcnow(),
                action="user.status_changed",
                category="user",
                actor=None,
                target=None,
                institution=None,
                ip_address=None,
                user_agent=None,
                request_id=None,
                details=_sanitize(details, "user.status_changed"),
            )
            return [log], 1, True

        async def get_log(self, user, uid):
            details = {
                "_action": "auth.login",
                "method": "password",
                "success": True,
                "token": "abcd",
                "ip_country": None,
            }
            return AuditLogOut(
                audit_log_id=5,
                time=utcnow(),
                action="auth.login",
                category="auth",
                actor=None,
                target=None,
                institution=None,
                ip_address=None,
                user_agent=None,
                request_id=None,
                details=_sanitize(details, "auth.login"),
            )

    fake_admin = User(id=uuid4(), public_id=1, email="admin@example.com", username="admin_tester", role=Role.SUPER_ADMIN.value)
    fake_session = UserSession(id=uuid4(), user_id=fake_admin.id)
    fake_auth = AuthContext(user=fake_admin, session=fake_session, institution=None, mfa_enabled=False)
    app.dependency_overrides[_require_password_current] = lambda: fake_auth
    monkeypatch.setattr("app.services.audit_log_service.AuditLogService", lambda db: MockService())
    monkeypatch.setattr("app.api.v1.endpoints.audit_rbac.AuditLogService", lambda db: MockService())
    yield
    app.dependency_overrides.pop(_require_password_current, None)

def test_api_list_sanitises_details():
    client = TestClient(app)
    response = client.get("/api/v1/audit/rbac?page=1&per_page=10")
    assert response.status_code == 200
    data = response.json()
    assert "audit_logs" in data
    log = data["audit_logs"][0]
    # Sensitive password should be removed, only allowed fields present
    assert log["details"] == {"from_status": "active", "to_status": "suspended", "reason": "test"}

def test_api_detail_sanitises_details():
    client = TestClient(app)
    # Use a dummy UUID for event_id (the mock ignores it)
    response = client.get("/api/v1/audit/rbac/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 200
    data = response.json()
    log = data["audit_logs"][0]
    # Token field should be dropped, only allowed auth fields remain
    assert log["details"] == {"method": "password", "success": True, "ip_country": None}
