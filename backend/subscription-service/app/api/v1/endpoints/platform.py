"""The product marketplace: catalogue, orders, per-product subscriptions, seats and assignments."""

from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Response

from app.api.deps import REQUEST, CurrentAuth, DbSession, RequireInstitutionHead, SettingsDep
from app.api.responses import errors
from app.core.exceptions import ValidationFailedError
from app.schemas.platform import (
    AssignIn,
    AssignmentListResponse,
    AssignmentOut,
    CatalogResponse,
    EntitlementListResponse,
    EntitlementOut,
    OrderIn,
    OrderListResponse,
    OrderOut,
    OrderResponse,
    PlanIn,
    PriceIn,
    ProductIn,
    ProductOut,
    ProductResponse,
    Scope,
    SubscriptionListResponse,
    SubscriptionOut,
)
from app.services.platform_service import PlatformService, status_of

router = APIRouter(prefix="/platform", tags=["Marketplace"])

IdempotencyKey = Annotated[str | None, Header(alias="Idempotency-Key", max_length=80)]


def _product(row) -> ProductOut:  # noqa: ANN001
    return ProductOut.model_validate(row, from_attributes=True)


def _order(row) -> OrderOut:  # noqa: ANN001
    return OrderOut.model_validate(row, from_attributes=True)


@router.get("/catalog", response_model=CatalogResponse, summary="The products on sale", responses=errors(401))
async def catalog(auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> CatalogResponse:
    return CatalogResponse(message="", products=[_product(p) for p in await PlatformService(db, settings).catalog()])


@router.post("/catalog/products", response_model=ProductResponse, status_code=201, summary="Add a product (super admin)", responses=errors(401, 403, 409, 422))
async def add_product(data: ProductIn, auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> ProductResponse:
    return ProductResponse(message="Product added.", product=_product(await PlatformService(db, settings).add_product(data, auth)))


@router.post("/catalog/products/{product_key}/plans", response_model=ProductResponse, status_code=201, summary="Add a plan to a product (super admin)", responses=errors(401, 403, 404, 409))
async def add_plan(product_key: str, data: PlanIn, auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> ProductResponse:
    return ProductResponse(message="Plan added.", product=_product(await PlatformService(db, settings).add_plan(product_key, data, auth)))


@router.patch(
    "/catalog/products/{product_key}/plans/{plan_key}",
    response_model=ProductResponse,
    summary="Change a plan's price (super admin)",
    description="New orders use the new price. Subscriptions already bought keep running unchanged.",
    responses=errors(401, 403, 404),
)
async def set_price(product_key: str, plan_key: str, data: PriceIn, auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> ProductResponse:
    return ProductResponse(message="Price updated.", product=_product(await PlatformService(db, settings).set_price(product_key, plan_key, data.monthly_price, data.seat_price, auth)))


@router.post(
    "/orders",
    response_model=OrderResponse,
    status_code=201,
    summary="Buy products",
    description="One order can hold several products. Prices are worked out from the catalogue, never taken from the request. "
    "Buying for an organization needs its administrator. Send an Idempotency-Key so a retry never charges twice. "
    "Until a payment provider is connected only the test gateway answers (`test_outcome`).",
    responses=errors(400, 401, 403, 409, 422),
)
async def create_order(data: OrderIn, auth: CurrentAuth, db: DbSession, settings: SettingsDep, key: IdempotencyKey = None) -> OrderResponse:
    is_head = auth.organization_id is not None and auth.can_act("course_requests.create", REQUEST)
    order = await PlatformService(db, settings).purchase(data, auth, key, is_head=is_head)
    return OrderResponse(message="Payment received." if order.status == "paid" else "Payment failed.", order=_order(order))


@router.get("/orders", response_model=OrderListResponse, summary="My orders", responses=errors(401))
async def list_orders(auth: CurrentAuth, db: DbSession, settings: SettingsDep, scope: Annotated[Scope, Query()] = "individual") -> OrderListResponse:
    if scope == "organization" and auth.organization_id is None:
        raise ValidationFailedError("You do not belong to an organization.")
    return OrderListResponse(message="", orders=[_order(o) for o in await PlatformService(db, settings).orders(auth, scope)])


@router.get("/admin/orders", response_model=OrderListResponse, summary="Every order (super admin)", responses=errors(401, 403))
async def all_orders(auth: CurrentAuth, db: DbSession, settings: SettingsDep, status: Annotated[Literal["paid", "failed"] | None, Query()] = None, limit: Annotated[int, Query(ge=1, le=500)] = 200) -> OrderListResponse:
    return OrderListResponse(message="", orders=[_order(o) for o in await PlatformService(db, settings).all_orders(auth, status, limit)])


@router.get("/subscriptions", response_model=SubscriptionListResponse, summary="Each product's subscription, with its own status", responses=errors(401))
async def list_subscriptions(auth: CurrentAuth, db: DbSession, settings: SettingsDep, scope: Annotated[Scope, Query()] = "individual") -> SubscriptionListResponse:
    if scope == "organization" and auth.organization_id is None:
        raise ValidationFailedError("You do not belong to an organization.")
    rows = await PlatformService(db, settings).subscriptions(auth, scope)
    out = []
    for subscription, used in rows:
        out.append(
            SubscriptionOut(
                public_id=subscription.public_id, scope=subscription.scope, product_key=subscription.product_key, plan_key=subscription.plan_key,
                seats=subscription.seats, module_keys=subscription.module_keys, starts_at=subscription.starts_at, ends_at=subscription.ends_at,
                status=status_of(subscription), seats_assigned=used,
            )
        )
    return SubscriptionListResponse(message="", subscriptions=out)


@router.get("/assignments", response_model=AssignmentListResponse, summary="Who in my organization has which product", responses=errors(401, 403))
async def list_assignments(auth: RequireInstitutionHead, db: DbSession, settings: SettingsDep) -> AssignmentListResponse:
    rows = await PlatformService(db, settings).assignments(auth.organization_id or 0)
    return AssignmentListResponse(message="", assignments=[AssignmentOut.model_validate(r, from_attributes=True) for r in rows])


@router.post(
    "/assignments",
    response_model=AssignmentListResponse,
    status_code=201,
    summary="Give a purchased product to a person",
    description="Needs a free seat and a live subscription. Assigning someone who already has it changes nothing.",
    responses=errors(401, 403, 409),
)
async def assign(data: AssignIn, auth: RequireInstitutionHead, db: DbSession, settings: SettingsDep) -> AssignmentListResponse:
    row = await PlatformService(db, settings).assign(auth.organization_id or 0, data.user_id, data.product_key, auth.user_id)
    return AssignmentListResponse(message="Product assigned.", assignments=[AssignmentOut.model_validate(row, from_attributes=True)])


@router.delete("/assignments/{user_id}/{product_key}", status_code=204, summary="Take a product back from a person", description="Their data and progress are kept; the seat becomes free.", responses=errors(401, 403, 404))
async def unassign(user_id: str, product_key: str, auth: RequireInstitutionHead, db: DbSession, settings: SettingsDep) -> Response:
    if not user_id.isdigit():
        raise ValidationFailedError("Invalid user id.")
    await PlatformService(db, settings).unassign(auth.organization_id or 0, int(user_id), product_key)
    return Response(status_code=204)


@router.get("/me/products", response_model=EntitlementListResponse, summary="The products I may open right now", responses=errors(401))
async def my_products(auth: CurrentAuth, db: DbSession, settings: SettingsDep) -> EntitlementListResponse:
    rows = await PlatformService(db, settings).entitlements(auth)
    return EntitlementListResponse(
        message="", entitlements=[EntitlementOut(product_key=s.product_key, source=source, plan_key=s.plan_key, ends_at=s.ends_at, status=status) for source, status, s in rows]
    )
