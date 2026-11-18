from typing import Literal

from lms_common.envelopes import RequestSchema, ResponseSchema, SuccessResponse
from pydantic import Field

from app.schemas.types import PublicIdOut, Timestamp, id_field, text

Scope = Literal["individual", "organization"]
Slug = text(40)
UserId = id_field("user_id", "1755000000004001")


class LimitOut(ResponseSchema):
    label: str
    value: str


class PlanOut(ResponseSchema):
    key: str
    name: str
    monthly_price: float
    seat_price: float
    limits: list[LimitOut]
    highlight: bool


class ModuleOut(ResponseSchema):
    key: str
    name: str
    monthly_price: float


class ProductOut(ResponseSchema):
    key: str
    name: str
    icon: str
    tagline: str
    description: str
    features: list[str]
    modules: list[ModuleOut]
    plans: list[PlanOut]


class CatalogResponse(SuccessResponse):
    products: list[ProductOut]


class PlanIn(RequestSchema):
    key: Slug  # type: ignore[valid-type]
    name: text(60)  # type: ignore[valid-type]
    monthly_price: float = Field(ge=0, le=100_000)
    seat_price: float = Field(default=0, ge=0, le=100_000)
    highlight: bool = False


class ProductIn(RequestSchema):
    key: Slug  # type: ignore[valid-type]
    name: text(80)  # type: ignore[valid-type]
    icon: text(30) = "sparkles"  # type: ignore[valid-type]
    tagline: text(160)  # type: ignore[valid-type]
    description: text(1_000)  # type: ignore[valid-type]
    features: list[text(120)] = Field(default_factory=list, max_length=12)  # type: ignore[valid-type]
    plans: list[PlanIn] = Field(min_length=1, max_length=8)


class PriceIn(RequestSchema):
    monthly_price: float = Field(ge=0, le=100_000)
    seat_price: float = Field(ge=0, le=100_000)


class ProductResponse(SuccessResponse):
    product: ProductOut


class CartLineIn(RequestSchema):
    product_key: Slug  # type: ignore[valid-type]
    plan_key: Slug  # type: ignore[valid-type]
    months: int = Field(ge=1, le=12)
    seats: int = Field(default=1, ge=1, le=10_000)
    module_keys: list[Slug] = Field(default_factory=list, max_length=20)  # type: ignore[valid-type]


class OrderIn(RequestSchema):
    scope: Scope
    lines: list[CartLineIn] = Field(min_length=1, max_length=10)
    # Test gateway only: the browser reports whether its test card was accepted. Never used when a real provider is set.
    test_outcome: Literal["success", "declined"] = "success"


class OrderLineOut(ResponseSchema):
    product_key: str
    plan_key: str
    months: int
    seats: int
    module_keys: list[str]
    amount: float


class OrderOut(ResponseSchema):
    order_id: PublicIdOut = Field(validation_alias="public_id")
    scope: str
    lines: list[OrderLineOut]
    discount: float
    total: float
    status: str
    failure_reason: str | None
    placed_at: Timestamp = Field(validation_alias="created_at")


class OrderResponse(SuccessResponse):
    order: OrderOut


class OrderListResponse(SuccessResponse):
    orders: list[OrderOut]


class SubscriptionOut(ResponseSchema):
    subscription_id: PublicIdOut = Field(validation_alias="public_id")
    scope: str
    product_key: str
    plan_key: str
    seats: int
    module_keys: list[str]
    starts_at: Timestamp
    ends_at: Timestamp
    status: str = Field(description="active, expiring (14 days or fewer left) or expired")
    seats_assigned: int = 0


class SubscriptionListResponse(SuccessResponse):
    subscriptions: list[SubscriptionOut]


class AssignIn(RequestSchema):
    user_id: UserId  # type: ignore[valid-type]
    product_key: Slug  # type: ignore[valid-type]


class AssignmentOut(ResponseSchema):
    user_id: PublicIdOut
    product_key: str
    assigned_at: Timestamp = Field(validation_alias="created_at")


class AssignmentListResponse(SuccessResponse):
    assignments: list[AssignmentOut]


class EntitlementOut(ResponseSchema):
    product_key: str
    source: str = Field(description="personal (own subscription) or organization (assigned by it)")
    plan_key: str
    ends_at: Timestamp
    status: str


class EntitlementListResponse(SuccessResponse):
    entitlements: list[EntitlementOut]
