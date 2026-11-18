"""LMS role bridging: only super_admin becomes PLATFORM_ADMINISTRATOR."""

from app.core.lms_auth import _map_role
from app.shared.enums import UserRole


def test_super_admin_maps_to_platform_administrator() -> None:
    assert _map_role("super_admin", []) == UserRole.PLATFORM_ADMINISTRATOR.value


def test_scoped_lms_admin_is_not_platform_administrator() -> None:
    """Without careers.manage, scoped LMS admin must not gain JCMS moderation APIs."""
    mapped = _map_role("admin", [])
    assert mapped != UserRole.PLATFORM_ADMINISTRATOR.value
    assert mapped == "ADMIN"


def test_scoped_admin_with_careers_manage_maps_to_moderator() -> None:
    mapped = _map_role("admin", ["careers.manage"])
    assert mapped == UserRole.PLATFORM_ADMINISTRATOR.value


def test_hiring_and_campus_roles_map() -> None:
    assert _map_role("student", None) == UserRole.STUDENT.value
    assert _map_role("employer_admin", None) == UserRole.EMPLOYER.value
    assert _map_role("recruiter", None) == UserRole.RECRUITER.value
    assert _map_role("institution_head", None) == UserRole.INSTITUTION.value
    assert _map_role("staff", None) == UserRole.INSTITUTION.value
