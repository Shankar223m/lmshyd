from datetime import timedelta

from sqlalchemy import update

from app.core.time import utcnow
from app.models.platform import ProductSubscription
from tests.conftest import TEST_ORG_ID, TEST_USER_ID

STUDENT_A, STUDENT_B, STUDENT_C = 1755000000009001, 1755000000009002, 1755000000009003


def line(product="lms", plan="standard", months=12, seats=1, modules=()):
    return {"product_key": product, "plan_key": plan, "months": months, "seats": seats, "module_keys": list(modules)}


async def buy(client, lines, scope="individual", key=None, outcome="success"):
    return await client.post("/api/v1/platform/orders", json={"scope": scope, "lines": lines, "test_outcome": outcome}, headers={"Idempotency-Key": key} if key else {})


async def subs(client, scope="individual"):
    return {s["product_key"]: s for s in (await client.get("/api/v1/platform/subscriptions", params={"scope": scope})).json()["subscriptions"]}


async def set_end(app, product_key, days, owner=f"u:{TEST_USER_ID}"):
    async with app.state.sessionmaker() as db:
        await db.execute(update(ProductSubscription).where(ProductSubscription.owner_key == owner, ProductSubscription.product_key == product_key).values(ends_at=utcnow() + timedelta(days=days)))
        await db.commit()


async def test_the_catalogue_starts_with_the_four_products_and_their_plans(client, authed):
    authed(role="student")
    products = (await client.get("/api/v1/platform/catalog")).json()["products"]
    assert [p["key"] for p in products] == ["lms", "resume", "jobs", "interview"]
    assert {plan["key"] for plan in products[0]["plans"]} == {"basic", "standard", "unlimited"}


async def test_buying_one_product_opens_only_that_product_with_its_own_end_date(client, authed):
    authed(role="student")
    order = await buy(client, [line("lms", "standard", 12, modules=["web", "data"])])
    assert order.status_code == 201 and order.json()["order"]["status"] == "paid"
    # (19 + 6 + 8) a month x 12, less 10% for a year: the price comes from the catalogue, not from the request
    assert order.json()["order"]["total"] == 356.4 and order.json()["order"]["discount"] == 39.6
    owned = await subs(client)
    assert list(owned) == ["lms"] and owned["lms"]["status"] == "active"
    mine = (await client.get("/api/v1/platform/me/products")).json()["entitlements"]
    assert [e["product_key"] for e in mine] == ["lms"] and mine[0]["source"] == "personal"


async def test_a_declined_payment_creates_a_failed_order_and_no_subscription(client, authed):
    authed(role="student")
    order = await buy(client, [line("resume", "premium", 1)], outcome="declined")
    assert order.status_code == 201 and order.json()["order"]["status"] == "failed"
    assert order.json()["order"]["failure_reason"]
    assert await subs(client) == {}


async def test_a_retried_order_is_never_applied_twice(client, authed):
    authed(role="student")
    first = await buy(client, [line("jobs", "standard", 1)], key="abc-1")
    second = await buy(client, [line("jobs", "standard", 1)], key="abc-1")
    assert first.json()["order"]["order_id"] == second.json()["order"]["order_id"]
    assert len((await client.get("/api/v1/platform/orders")).json()["orders"]) == 1
    first_end = (await subs(client))["jobs"]["ends_at"]
    await buy(client, [line("jobs", "standard", 1)], key="abc-1")
    assert (await subs(client))["jobs"]["ends_at"] == first_end


async def test_a_bad_basket_is_refused(client, authed):
    authed(role="student")
    assert (await buy(client, [line("nope", "x", 1)])).status_code == 422
    assert (await buy(client, [line("lms", "standard", 5)])).status_code == 422  # not an offered length
    assert (await buy(client, [line("lms", "standard", 1, modules=["unknown"])])).status_code == 422
    assert (await buy(client, [line("lms", "standard", 1), line("lms", "basic", 1)])).status_code == 422  # same product twice
    assert await subs(client) == {}


async def test_renewing_extends_a_live_subscription_and_restarts_an_expired_one(client, authed, app):
    authed(role="student")
    await buy(client, [line("interview", "basic", 1)])
    await set_end(app, "interview", 10)
    await buy(client, [line("interview", "basic", 3)])
    ends = (await subs(client))["interview"]["ends_at"]
    assert ends  # 10 days left + 3 months: the unused days are not lost
    await set_end(app, "interview", -5)
    assert (await subs(client))["interview"]["status"] == "expired"
    await buy(client, [line("interview", "basic", 1)])
    assert (await subs(client))["interview"]["status"] == "active"


async def test_one_product_expiring_does_not_touch_another(client, authed, app):
    authed(role="student")
    await buy(client, [line("lms", "basic", 12), line("resume", "basic", 12)])
    await set_end(app, "resume", -1)
    owned = await subs(client)
    assert owned["resume"]["status"] == "expired" and owned["lms"]["status"] == "active"
    mine = {e["product_key"] for e in (await client.get("/api/v1/platform/me/products")).json()["entitlements"]}
    assert mine == {"lms"}  # the expired one closes, the other stays open


async def test_only_an_organization_administrator_can_buy_for_the_organization(client, authed, as_institution_head):
    authed(role="student", organization_id=TEST_ORG_ID)
    assert (await buy(client, [line("lms", "standard", 12, seats=50)], scope="organization")).status_code == 403
    authed(role="student")
    assert (await buy(client, [line("lms", "standard", 12, seats=50)], scope="organization")).status_code == 403  # no organization at all
    as_institution_head()
    order = await buy(client, [line("lms", "standard", 1, seats=10)], scope="organization")
    assert order.status_code == 201
    assert order.json()["order"]["total"] == 19 + 5 * 10  # seats are priced per seat
    assert (await subs(client, "organization"))["lms"]["seats"] == 10
    assert await subs(client) == {}  # the personal and the organization subscriptions never mix


async def test_seats_can_never_be_given_out_beyond_what_was_bought(client, as_institution_head):
    as_institution_head()
    await buy(client, [line("resume", "premium", 12, seats=2)], scope="organization")

    async def give(user, product="resume"):
        return await client.post("/api/v1/platform/assignments", json={"user_id": str(user), "product_key": product})

    assert (await give(STUDENT_A)).status_code == 201
    assert (await give(STUDENT_A)).status_code == 201  # again: nothing changes, no second seat used
    assert (await give(STUDENT_B)).status_code == 201
    full = await give(STUDENT_C)
    assert full.status_code == 409 and full.json()["code"] == "NO_SEATS_LEFT"
    assert (await subs(client, "organization"))["resume"]["seats_assigned"] == 2

    assert (await client.delete(f"/api/v1/platform/assignments/{STUDENT_A}/resume")).status_code == 204
    assert (await give(STUDENT_C)).status_code == 201  # the freed seat is reusable
    assert (await client.delete(f"/api/v1/platform/assignments/{STUDENT_A}/resume")).status_code == 404


async def test_a_product_that_was_not_bought_or_has_expired_cannot_be_assigned(client, as_institution_head, authed, app):
    as_institution_head()
    never = await client.post("/api/v1/platform/assignments", json={"user_id": str(STUDENT_A), "product_key": "jobs"})
    assert never.status_code == 409 and never.json()["code"] == "PRODUCT_NOT_PURCHASED"
    await buy(client, [line("jobs", "standard", 1, seats=5)], scope="organization")
    await set_end(app, "jobs", -2, owner=f"o:{TEST_ORG_ID}")
    expired = await client.post("/api/v1/platform/assignments", json={"user_id": str(STUDENT_A), "product_key": "jobs"})
    assert expired.status_code == 409 and expired.json()["code"] == "SUBSCRIPTION_EXPIRED"


async def test_a_student_gets_exactly_the_products_assigned_to_them(client, authed, as_institution_head, app):
    as_institution_head()
    await buy(client, [line("lms", "standard", 12, seats=5), line("jobs", "standard", 12, seats=5), line("resume", "basic", 12, seats=5)], scope="organization")
    for product in ("lms", "jobs"):
        await client.post("/api/v1/platform/assignments", json={"user_id": str(STUDENT_A), "product_key": product})
    await client.post("/api/v1/platform/assignments", json={"user_id": str(STUDENT_B), "product_key": "lms"})

    authed(role="student", user_id=STUDENT_A, organization_id=TEST_ORG_ID)
    a = {e["product_key"]: e["source"] for e in (await client.get("/api/v1/platform/me/products")).json()["entitlements"]}
    assert a == {"lms": "organization", "jobs": "organization"}  # resume was bought but never assigned to them
    authed(role="student", user_id=STUDENT_B, organization_id=TEST_ORG_ID)
    assert {e["product_key"] for e in (await client.get("/api/v1/platform/me/products")).json()["entitlements"]} == {"lms"}

    await set_end(app, "lms", -1, owner=f"o:{TEST_ORG_ID}")  # the organization's LMS ends: their assignment stays but no longer opens
    authed(role="student", user_id=STUDENT_A, organization_id=TEST_ORG_ID)
    assert {e["product_key"] for e in (await client.get("/api/v1/platform/me/products")).json()["entitlements"]} == {"jobs"}


async def test_renewing_with_fewer_seats_than_are_assigned_is_refused(client, as_institution_head, app):
    as_institution_head()
    await buy(client, [line("interview", "basic", 1, seats=3)], scope="organization")
    for user in (STUDENT_A, STUDENT_B, STUDENT_C):
        await client.post("/api/v1/platform/assignments", json={"user_id": str(user), "product_key": "interview"})
    await set_end(app, "interview", -3, owner=f"o:{TEST_ORG_ID}")
    refused = await buy(client, [line("interview", "basic", 1, seats=1)], scope="organization")
    assert refused.status_code == 409 and refused.json()["code"] == "SEATS_BELOW_ASSIGNED"


async def test_only_a_super_admin_edits_the_catalogue_and_old_subscriptions_keep_their_terms(client, authed):
    authed(role="student")
    await buy(client, [line("resume", "basic", 1)])
    authed(role="admin", scopes=("accounts.manage",))
    assert (await client.patch("/api/v1/platform/catalog/products/resume/plans/basic", json={"monthly_price": 50, "seat_price": 9})).status_code == 403
    authed(role="super_admin")
    changed = await client.patch("/api/v1/platform/catalog/products/resume/plans/basic", json={"monthly_price": 50, "seat_price": 9})
    assert changed.status_code == 200
    added = await client.post(
        "/api/v1/platform/catalog/products",
        json={"key": "mentor", "name": "AI Mentor", "tagline": "A mentor", "description": "Guidance", "features": ["Chat"], "plans": [{"key": "std", "name": "Standard", "monthly_price": 10, "seat_price": 3}]},
    )
    assert added.status_code == 201
    assert (await client.post("/api/v1/platform/catalog/products", json={"key": "mentor", "name": "x", "tagline": "x", "description": "x", "plans": [{"key": "a", "name": "A", "monthly_price": 1}]})).status_code == 409
    authed(role="student")
    keys = [p["key"] for p in (await client.get("/api/v1/platform/catalog")).json()["products"]]
    assert "mentor" in keys  # a new product needs no code change
    new_order = await buy(client, [line("resume", "basic", 1)])
    assert new_order.json()["order"]["total"] == 50  # new orders use the new price
    assert (await buy(client, [line("mentor", "std", 1)])).json()["order"]["total"] == 10


async def test_orders_are_refused_while_no_payment_provider_is_connected(client, authed, app):
    from app.core.config import get_settings
    from tests.conftest import _settings

    authed(role="student")
    app.dependency_overrides[get_settings] = lambda: _settings().model_copy(update={"PAYMENTS_MODE": "off"})
    refused = await buy(client, [line("lms", "basic", 1)])
    assert refused.status_code == 400 and refused.json()["code"] == "PAYMENT_PROVIDER_NOT_CONFIGURED"
    assert await subs(client) == {}


async def test_only_a_super_admin_can_list_every_order(client, authed):
    authed(role="student")
    await buy(client, [line("jobs", "standard", 1)])
    await buy(client, [line("resume", "basic", 1)], outcome="declined")
    assert (await client.get("/api/v1/platform/admin/orders")).status_code == 403
    authed(role="super_admin", user_id=TEST_USER_ID + 1)
    everything = (await client.get("/api/v1/platform/admin/orders")).json()["orders"]
    assert {o["status"] for o in everything} == {"paid", "failed"}
    assert len((await client.get("/api/v1/platform/admin/orders", params={"status": "failed"})).json()["orders"]) == 1
