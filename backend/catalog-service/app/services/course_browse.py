"""Enriches published courses with module/chapter counts, duration, instructor name, subscription plans, and student access status."""

from typing import Any

import asyncpg
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from lms_common.subscription_guard import get_browse_context_for_student

from app.core.config import get_settings
from app.domain.enums import ContentStatus
from app.models.course import Course
from app.models.course_version import CourseVersion
from app.models.module import Module
from app.models.topic import Topic
from app.models.topic_item import TopicItem
from app.schemas.course import BrowsePlanPreviewOut, CourseBrowseOut
from app.services.institution_access import get_subscription_db_url, get_user_management_db_url, _get_database_url


def get_billing_db_url() -> str:
    return _get_database_url("lms_billing", "BILLING_DATABASE_URL")


def _format_duration(seconds: int) -> str:
    if seconds <= 0:
        return "Self-paced"
    mins = max(1, seconds // 60)
    hours, rem_mins = divmod(mins, 60)
    if hours > 0 and rem_mins > 0:
        return f"{hours}h {rem_mins}m"
    if hours > 0:
        return f"{hours}h"
    return f"{rem_mins}m"


def _infer_skills(title: str, summary: str) -> list[str]:
    combined = f"{title} {summary}".lower()
    skills: list[str] = []
    if "python" in combined:
        skills.extend(["Python 3", "OOP", "Data Structures", "Scripting"])
    elif "react" in combined:
        skills.extend(["React.js", "State Management", "Hooks", "Component Architecture"])
    elif "data" in combined or "pandas" in combined:
        skills.extend(["Data Analysis", "Pandas", "NumPy", "Data Cleaning"])
    elif "machine learning" in combined or "ai" in combined or "intelligence" in combined:
        skills.extend(["Machine Learning", "Model Training", "Deep Learning", "Algorithms"])
    elif "java" in combined:
        skills.extend(["Java Core", "Spring Boot", "Backend Development", "OOP"])
    elif "design" in combined or "ui" in combined or "ux" in combined or "blender" in combined:
        skills.extend(["UI/UX Design", "Wireframing", "Figma", "Design Systems"])
    elif "business" in combined or "management" in combined:
        skills.extend(["Business Strategy", "Leadership", "Product Management"])
    if not skills:
        skills = ["Software Engineering", "Problem Solving", "Best Practices"]
    return skills[:4]


async def _fetch_instructor_names(user_ids: list[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    names: dict[int, str] = {}
    try:
        conn = await asyncpg.connect(get_user_management_db_url())
        try:
            rows = await conn.fetch(
                "SELECT public_id, full_name FROM users WHERE public_id = ANY($1::bigint[])",
                list(set(user_ids)),
            )
            for r in rows:
                if r["full_name"]:
                    names[int(r["public_id"])] = str(r["full_name"])
        finally:
            await conn.close()
    except Exception:
        pass
    return names


async def enrich_browse_courses(
    db: AsyncSession,
    courses: list[Course],
    *,
    user_id: int,
    role: str,
    organization_id: int | None = None,
) -> list[CourseBrowseOut]:
    if not courses:
        return []

    latest_version_by_course: dict[Any, CourseVersion] = {}
    for c in courses:
        pub_versions = [v for v in (c.versions or []) if v.status == ContentStatus.PUBLISHED]
        if pub_versions:
            latest_version_by_course[c.id] = max(pub_versions, key=lambda v: v.version_number)

    version_ids = [v.id for v in latest_version_by_course.values()]
    stats_by_version: dict[Any, dict[str, int]] = {}
    if version_ids:
        rows = (
            await db.execute(
                select(
                    Module.course_version_id,
                    func.count(distinct(Module.id)).label("modules_count"),
                    func.count(distinct(Topic.id)).label("chapters_count"),
                    func.coalesce(func.sum(TopicItem.duration_seconds), 0).label("duration_seconds"),
                )
                .outerjoin(Topic, Topic.module_id == Module.id)
                .outerjoin(TopicItem, TopicItem.topic_id == Topic.id)
                .where(Module.course_version_id.in_(version_ids))
                .group_by(Module.course_version_id)
            )
        ).all()
        for r in rows:
            stats_by_version[r[0]] = {
                "modules_count": int(r[1] or 0),
                "chapters_count": int(r[2] or 0),
                "duration_seconds": int(r[3] or 0),
            }

    instructors = await _fetch_instructor_names([int(c.created_by) for c in courses])
    ctx = await get_browse_context_for_student(
        [int(c.public_id) for c in courses],
        user_id=user_id,
        settings_db_url=get_settings().DATABASE_URL,
    )

    plan_state = ctx["plan_state"]
    batch_enrolled = ctx["batch_enrolled_course_ids"]
    unlocked_under_plan = plan_state.get("unlocked_course_ids", set())
    plans_preview = [BrowsePlanPreviewOut(**p) for p in ctx["plans"]]
    min_price = min((p.price_paise for p in plans_preview), default=None)
    payments_enabled = bool(ctx["payments_enabled"])

    # Query course prices from lms_billing
    course_prices: dict[int, int] = {}
    try:
        bconn = await asyncpg.connect(get_billing_db_url())
        try:
            prows = await bconn.fetch(
                "SELECT code, unit_amount FROM price_items WHERE kind = 'course_seat' AND active = TRUE"
            )
            for pr in prows:
                if pr["code"] and str(pr["code"]).isdigit():
                    course_prices[int(pr["code"])] = int(pr["unit_amount"])
        finally:
            await bconn.close()
    except Exception:
        pass

    # Query individual purchases and institution course subscriptions
    purchased_course_ids: set[int] = set()
    institution_course_ids: set[int] = set()
    if role == "student":
        try:
            sconn = await asyncpg.connect(get_subscription_db_url())
            try:
                if user_id:
                    ca_rows = await sconn.fetch(
                        """
                        SELECT course_id FROM course_access
                        WHERE user_id = $1 AND status = 'active'
                          AND starts_at <= NOW()
                          AND (ends_at IS NULL OR ends_at > NOW())
                        """,
                        int(user_id),
                    )
                    purchased_course_ids = {int(r["course_id"]) for r in ca_rows}

                if organization_id:
                    sub_rows = await sconn.fetch(
                        """
                        SELECT course_id FROM subscriptions
                        WHERE organization_id = $1 AND status = 'active'
                          AND starts_at <= NOW()
                          AND (ends_at IS NULL OR ends_at > NOW())
                        """,
                        int(organization_id),
                    )
                    institution_course_ids = {int(r["course_id"]) for r in sub_rows}
            finally:
                await sconn.close()
        except Exception:
            pass

    out: list[CourseBrowseOut] = []
    for c in courses:
        pub_v = latest_version_by_course.get(c.id)
        vstats = stats_by_version.get(pub_v.id if pub_v else None, {})
        dur_sec = vstats.get("duration_seconds", 0)
        cid = int(c.public_id)

        is_purchased = cid in purchased_course_ids
        is_institution = cid in institution_course_ids or cid in batch_enrolled

        if is_purchased:
            access_status = "enrolled"
            access_type = "purchased"
        elif is_institution:
            access_status = "enrolled"
            access_type = "institution"
        elif plan_state.get("has_active") and cid in unlocked_under_plan:
            access_status = "active_plan"
            access_type = "plan"
        elif plan_state.get("has_active"):
            max_c = plan_state.get("max_courses")
            if max_c is None or len(unlocked_under_plan) < int(max_c):
                access_status = "eligible_under_plan"
                access_type = None
            else:
                access_status = "available" if payments_enabled else "payments_disabled"
                access_type = None
        else:
            access_status = "available" if payments_enabled else "payments_disabled"
            access_type = None

        price_paise = course_prices.get(cid)
        if not price_paise:
            # Deterministic default pricing: ₹999, ₹1,999, ₹2,499, ₹3,499
            price_paise = [99900, 199900, 249900, 349900][cid % 4]
        price_inr = price_paise // 100
        skills = _infer_skills(c.title, c.summary or "")

        out.append(
            CourseBrowseOut(
                public_id=c.public_id,
                title=c.title,
                slug=c.slug,
                summary=c.summary,
                thumbnail_media_id=c.thumbnail_media_id,
                instructor_name=instructors.get(int(c.created_by)) or "ExamLMS Faculty",
                modules_count=vstats.get("modules_count", 0),
                chapters_count=vstats.get("chapters_count", 0),
                duration_seconds=dur_sec,
                duration_label=_format_duration(dur_sec),
                latest_published_version_id=pub_v.public_id if pub_v else None,
                access_status=access_status if role == "student" else "available",
                access_type=access_type if role == "student" else None,
                price_paise=price_paise,
                price_inr=price_inr,
                skills=skills,
                active_plan_name=plan_state.get("plan_name"),
                min_price_paise=price_paise or min_price,
                payments_enabled=payments_enabled,
                plans_preview=plans_preview,
            )
        )
    return out
