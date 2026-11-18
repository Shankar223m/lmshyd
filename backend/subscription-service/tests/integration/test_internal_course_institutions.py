"""catalog-service shows admins which institutions hold a course: active subscriptions only, for other services only."""

from datetime import timedelta

from app.core.ids import new_public_id
from app.core.time import utcnow
from app.domain.enums import SubscriptionStatus
from app.models.course_ref import CourseRef
from app.models.institution_ref import InstitutionRef
from app.models.subscription import Subscription
from tests.conftest import TEST_INTERNAL_TOKEN

TOKEN = {"X-Internal-Service-Token": TEST_INTERNAL_TOKEN}


async def _seed(app) -> None:
    async with app.state.sessionmaker() as db:
        db.add(InstitutionRef(organization_id=1, name="A School", code="A-1"))
        db.add_all([CourseRef(course_id=c, title=f"Course {c}", slug=f"course-{c}") for c in (1, 2, 3)])
        await db.flush()
        now = utcnow()
        db.add_all([
            Subscription(public_id=new_public_id(), organization_id=1, course_id=1, seats_total=30, starts_at=now - timedelta(days=1), ends_at=now + timedelta(days=300), created_by=1),
            Subscription(public_id=new_public_id(), organization_id=1, course_id=2, seats_total=5, starts_at=now - timedelta(days=400), ends_at=now - timedelta(days=1), created_by=1),
            Subscription(public_id=new_public_id(), organization_id=1, course_id=3, seats_total=5, starts_at=now - timedelta(days=1), ends_at=now + timedelta(days=300), created_by=1, status=SubscriptionStatus.CANCELLED),
        ])
        await db.commit()


async def test_only_active_subscriptions_count(app, client) -> None:
    await _seed(app)
    response = await client.get("/api/v1/internal/courses/institutions", params={"course_ids": "1,2,3,99"}, headers=TOKEN)
    assert response.status_code == 200
    held = response.json()["institutions"]
    assert [(h["institution_name"], h["seats_total"]) for h in held["1"]] == [("A School", 30)]
    assert held["2"] == [] and held["3"] == [] and held["99"] == []  # ended, cancelled, unknown


async def test_only_other_services_may_ask(client) -> None:
    for headers in ({}, {"X-Internal-Service-Token": "wrong"}):
        assert (await client.get("/api/v1/internal/courses/institutions", params={"course_ids": "1"}, headers=headers)).status_code == 403
