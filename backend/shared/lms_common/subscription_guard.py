"""Subscription / plan context for catalog browse and learn gates (minimal default impl)."""

from __future__ import annotations

from typing import Any


async def get_browse_context_for_student(
    course_ids: list[int],
    *,
    user_id: int,
    settings_db_url: str,
) -> dict[str, Any]:
    """Enriches browse cards with plan state. Extend when subscription DB integration is wired."""
    _ = course_ids, user_id, settings_db_url
    return {
        "plan_state": {
            "has_active": False,
            "unlocked_course_ids": set(),
            "plan_name": None,
            "max_courses": None,
        },
        "batch_enrolled_course_ids": set(),
        "plans": [],
        "payments_enabled": True,
    }


async def check_student_course_entitlement(
    *,
    user_id: int,
    course_id: int,
    settings_db_url: str,
) -> tuple[bool, str | None, str | None]:
    """Extra entitlement check after institution/store access. Default: allow when catalog granted read."""
    _ = user_id, course_id, settings_db_url
    return True, None, None