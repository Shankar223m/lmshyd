"""The marketplace: the product catalogue, what each person or organization has bought (one subscription per product,
each with its own end date), seats, and which students an organization gave each product to.

Rules this service enforces, never the browser:
  - prices come from the catalogue, so a tampered basket cannot change what is charged;
  - an organization can never give out more seats of a product than it bought, and only while that product is live;
  - one product expiring leaves every other product untouched, and nothing is deleted when it does;
  - a retried order (same Idempotency-Key) is never applied twice.
"""

from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationFailedError,
)
from app.core.ids import new_public_id
from app.core.security import AccessTokenClaims
from app.core.time import utcnow
from app.models.platform import CatalogPlan, CatalogProduct, PlatformOrder, ProductAssignment, ProductSubscription
from app.platform.defaults import DEFAULT_PRODUCTS
from app.platform.pricing import MAX_SEATS, TERMS, PricedLine, add_months, money, price_line
from app.schemas.platform import OrderIn, PlanIn, ProductIn

EXPIRING_DAYS = 14


def owner_key_for(scope: str, *, user_id: int, organization_id: int | None) -> str:
    return f"o:{organization_id}" if scope == "organization" else f"u:{user_id}"


def status_of(subscription: ProductSubscription, now=None) -> str:
    now = now or utcnow()
    if subscription.ends_at <= now:
        return "expired"
    return "expiring" if subscription.ends_at - now <= timedelta(days=EXPIRING_DAYS) else "active"


class PlatformService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    # ---- catalogue -------------------------------------------------------------------------------------------------

    async def catalog(self) -> list[CatalogProduct]:
        """The sellable products. The first read of an empty catalogue loads the starting products."""
        if (await self.db.execute(select(func.count()).select_from(CatalogProduct))).scalar_one() == 0:
            await self._load_defaults()
        rows = await self.db.execute(select(CatalogProduct).where(CatalogProduct.active.is_(True)).order_by(CatalogProduct.position, CatalogProduct.created_at))
        return list(rows.scalars().unique())

    async def _load_defaults(self) -> None:
        for position, spec in enumerate(DEFAULT_PRODUCTS):
            product = CatalogProduct(
                key=spec["key"], name=spec["name"], icon=spec["icon"], tagline=spec["tagline"], description=spec["description"],
                features=spec["features"], modules=spec["modules"], position=position,
            )
            product.plans = [
                CatalogPlan(key=p["key"], name=p["name"], monthly_price=p["monthly_price"], seat_price=p["seat_price"], limits=p["limits"], highlight=p.get("highlight", False))
                for p in spec["plans"]
            ]
            self.db.add(product)
        await self.db.commit()

    async def _product(self, key: str) -> CatalogProduct:
        await self.catalog()
        product = (await self.db.execute(select(CatalogProduct).where(CatalogProduct.key == key))).scalars().unique().first()
        if product is None:
            raise NotFoundError("Product not found.", code="PRODUCT_NOT_FOUND")
        return product

    @staticmethod
    def _require_super_admin(auth: AccessTokenClaims) -> None:
        if auth.role != "super_admin":
            raise PermissionDeniedError()

    @staticmethod
    def _plan_row(data: PlanIn) -> CatalogPlan:
        return CatalogPlan(key=data.key, name=data.name, monthly_price=Decimal(str(data.monthly_price)), seat_price=Decimal(str(data.seat_price)), limits=[], highlight=data.highlight)

    async def add_product(self, data: ProductIn, auth: AccessTokenClaims) -> CatalogProduct:
        self._require_super_admin(auth)
        await self.catalog()
        if (await self.db.execute(select(CatalogProduct).where(CatalogProduct.key == data.key))).scalars().first():
            raise ConflictError("A product with this key already exists.", code="PRODUCT_EXISTS")
        if len({plan.key for plan in data.plans}) != len(data.plans):
            raise ValidationFailedError("Plan keys must be different.")
        count = (await self.db.execute(select(func.count()).select_from(CatalogProduct))).scalar_one()
        product = CatalogProduct(key=data.key, name=data.name, icon=data.icon, tagline=data.tagline, description=data.description, features=list(data.features), modules=[], position=count)
        product.plans = [self._plan_row(plan) for plan in data.plans]
        self.db.add(product)
        await self.db.commit()
        return await self._product(data.key)

    async def add_plan(self, product_key: str, data: PlanIn, auth: AccessTokenClaims) -> CatalogProduct:
        self._require_super_admin(auth)
        product = await self._product(product_key)
        if any(plan.key == data.key for plan in product.plans):
            raise ConflictError("This product already has a plan with this key.", code="PLAN_EXISTS")
        product.plans.append(self._plan_row(data))
        await self.db.commit()
        return await self._product(product_key)

    async def set_price(self, product_key: str, plan_key: str, monthly: float, seat: float, auth: AccessTokenClaims) -> CatalogProduct:
        """New orders use the new price. Subscriptions already bought are not changed."""
        self._require_super_admin(auth)
        product = await self._product(product_key)
        plan = next((p for p in product.plans if p.key == plan_key), None)
        if plan is None:
            raise NotFoundError("Plan not found.", code="PLAN_NOT_FOUND")
        plan.monthly_price, plan.seat_price = Decimal(str(monthly)), Decimal(str(seat))
        await self.db.commit()
        return await self._product(product_key)

    # ---- buying ----------------------------------------------------------------------------------------------------

    async def _price(self, data: OrderIn) -> list[PricedLine]:
        products = {p.key: p for p in await self.catalog()}
        organization = data.scope == "organization"
        seen: set[str] = set()
        priced: list[PricedLine] = []
        for line in data.lines:
            product = products.get(line.product_key)
            plan = next((p for p in product.plans if p.key == line.plan_key), None) if product else None
            if product is None or plan is None:
                raise ValidationFailedError(f"{line.product_key} / {line.plan_key} is not for sale.")
            if line.product_key in seen:
                raise ValidationFailedError("Each product can be in the basket once.")
            seen.add(line.product_key)
            if line.months not in TERMS:
                raise ValidationFailedError("Choose 1, 3, 6 or 12 months.")
            if organization and not 1 <= line.seats <= MAX_SEATS:
                raise ValidationFailedError(f"Seats must be from 1 to {MAX_SEATS}.")
            by_key = {m["key"]: m for m in product.modules}
            if any(key not in by_key for key in line.module_keys):
                raise ValidationFailedError("A chosen module is not part of this product.")
            subtotal, discount = price_line(
                monthly_price=plan.monthly_price, seat_price=plan.seat_price, module_prices=[Decimal(str(by_key[k]["monthly_price"])) for k in set(line.module_keys)],
                months=line.months, seats=line.seats if organization else 1, organization=organization,
            )
            priced.append(PricedLine(line.product_key, line.plan_key, line.months, line.seats if organization else 1, tuple(sorted(set(line.module_keys))), subtotal, discount))
        return priced

    async def purchase(self, data: OrderIn, auth: AccessTokenClaims, key: str | None, *, is_head: bool) -> PlatformOrder:
        if data.scope == "organization" and (auth.organization_id is None or not is_head):
            raise PermissionDeniedError("Only an organization's administrator can buy for it.")
        owner = owner_key_for(data.scope, user_id=auth.user_id, organization_id=auth.organization_id)
        if key:
            existing = (await self.db.execute(select(PlatformOrder).where(PlatformOrder.buyer_user_id == auth.user_id, PlatformOrder.idempotency_key == key))).scalars().first()
            if existing:
                return existing  # a retried request: the first answer stands
        lines = await self._price(data)
        total = money(sum((line.amount for line in lines), Decimal("0")))
        discount = money(sum((line.discount for line in lines), Decimal("0")))

        declined = data.test_outcome == "declined"
        if self.settings.PAYMENTS_MODE != "test":
            raise BadRequestError("Online payment is not available yet.", code="PAYMENT_PROVIDER_NOT_CONFIGURED")
        order = PlatformOrder(
            public_id=new_public_id(), owner_key=owner, scope=data.scope, buyer_user_id=auth.user_id, idempotency_key=key,
            lines=[{"product_key": ln.product_key, "plan_key": ln.plan_key, "months": ln.months, "seats": ln.seats, "module_keys": list(ln.module_keys), "amount": float(ln.amount)} for ln in lines],
            discount=discount, total=total, status="failed" if declined else "paid", failure_reason="Your bank declined the payment. Try another card." if declined else None,
        )
        self.db.add(order)
        if not declined:
            for line in lines:
                await self._apply(data.scope, owner, auth, line)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise ConflictError("This order was already processed.", code="ORDER_ALREADY_PROCESSED") from None
        return order

    async def _apply(self, scope: str, owner: str, auth: AccessTokenClaims, line: PricedLine) -> None:
        now = utcnow()
        current = (
            await self.db.execute(select(ProductSubscription).where(ProductSubscription.owner_key == owner, ProductSubscription.product_key == line.product_key).with_for_update())
        ).scalars().first()
        if current is None:
            self.db.add(
                ProductSubscription(
                    public_id=new_public_id(), owner_key=owner, scope=scope, user_id=auth.user_id if scope == "individual" else None,
                    organization_id=auth.organization_id if scope == "organization" else None, product_key=line.product_key, plan_key=line.plan_key,
                    seats=line.seats, module_keys=list(line.module_keys), starts_at=now, ends_at=add_months(now, line.months),
                )
            )
            return
        live = current.ends_at > now
        if scope == "organization":
            assigned = await self._assigned_count(auth.organization_id or 0, line.product_key)
            seats = max(current.seats, line.seats) if live else line.seats
            if seats < assigned:
                raise ConflictError(f"{assigned} people have this product. Buy at least {assigned} seats.", code="SEATS_BELOW_ASSIGNED")
            current.seats = seats
        current.plan_key, current.module_keys = line.plan_key, list(line.module_keys)
        if live:
            current.ends_at = add_months(current.ends_at, line.months)
        else:
            current.starts_at, current.ends_at = now, add_months(now, line.months)

    async def orders(self, auth: AccessTokenClaims, scope: str) -> list[PlatformOrder]:
        owner = owner_key_for(scope, user_id=auth.user_id, organization_id=auth.organization_id)
        rows = await self.db.execute(select(PlatformOrder).where(PlatformOrder.owner_key == owner).order_by(PlatformOrder.created_at.desc()).limit(200))
        return list(rows.scalars())

    async def all_orders(self, auth: AccessTokenClaims, status: str | None, limit: int) -> list[PlatformOrder]:
        """Every order on the platform, newest first (super admin)."""
        self._require_super_admin(auth)
        query = select(PlatformOrder).order_by(PlatformOrder.created_at.desc()).limit(limit)
        if status:
            query = query.where(PlatformOrder.status == status)
        return list((await self.db.execute(query)).scalars())

    # ---- subscriptions and seats -----------------------------------------------------------------------------------

    async def subscriptions(self, auth: AccessTokenClaims, scope: str) -> list[tuple[ProductSubscription, int]]:
        owner = owner_key_for(scope, user_id=auth.user_id, organization_id=auth.organization_id)
        rows = (await self.db.execute(select(ProductSubscription).where(ProductSubscription.owner_key == owner).order_by(ProductSubscription.product_key))).scalars().all()
        result = []
        for subscription in rows:
            used = await self._assigned_count(subscription.organization_id, subscription.product_key) if scope == "organization" and subscription.organization_id else 0
            result.append((subscription, used))
        return result

    async def _assigned_count(self, organization_id: int, product_key: str) -> int:
        return (await self.db.execute(select(func.count()).select_from(ProductAssignment).where(ProductAssignment.organization_id == organization_id, ProductAssignment.product_key == product_key))).scalar_one()

    async def assignments(self, organization_id: int) -> list[ProductAssignment]:
        rows = await self.db.execute(select(ProductAssignment).where(ProductAssignment.organization_id == organization_id).order_by(ProductAssignment.created_at))
        return list(rows.scalars())

    async def assign(self, organization_id: int, user_id: int, product_key: str, by: int) -> ProductAssignment:
        subscription = (
            await self.db.execute(select(ProductSubscription).where(ProductSubscription.owner_key == f"o:{organization_id}", ProductSubscription.product_key == product_key).with_for_update())
        ).scalars().first()
        if subscription is None:
            raise ConflictError("Your organization has not bought this product.", code="PRODUCT_NOT_PURCHASED")
        if status_of(subscription) == "expired":
            raise ConflictError("This subscription has expired. Renew it to assign seats.", code="SUBSCRIPTION_EXPIRED")
        existing = (await self.db.execute(select(ProductAssignment).where(ProductAssignment.organization_id == organization_id, ProductAssignment.user_id == user_id, ProductAssignment.product_key == product_key))).scalars().first()
        if existing:
            return existing  # already assigned: nothing changes and no seat is used twice
        if await self._assigned_count(organization_id, product_key) >= subscription.seats:
            raise ConflictError("No seats left. Buy more seats first.", code="NO_SEATS_LEFT")
        row = ProductAssignment(organization_id=organization_id, user_id=user_id, product_key=product_key, assigned_by=by)
        self.db.add(row)
        await self.db.commit()
        return row

    async def unassign(self, organization_id: int, user_id: int, product_key: str) -> None:
        row = (await self.db.execute(select(ProductAssignment).where(ProductAssignment.organization_id == organization_id, ProductAssignment.user_id == user_id, ProductAssignment.product_key == product_key))).scalars().first()
        if row is None:
            raise NotFoundError("This person does not have this product.", code="ASSIGNMENT_NOT_FOUND")
        await self.db.delete(row)
        await self.db.commit()

    async def entitlements(self, auth: AccessTokenClaims) -> list[tuple[str, str, ProductSubscription]]:
        """Every product this person may open right now: their own live subscriptions, plus products an organization
        they belong to has bought, assigned to them, and still keeps live."""
        now = utcnow()
        found: dict[str, tuple[str, str, ProductSubscription]] = {}
        own = (await self.db.execute(select(ProductSubscription).where(ProductSubscription.owner_key == f"u:{auth.user_id}"))).scalars().all()
        for subscription in own:
            if subscription.ends_at > now:
                found[subscription.product_key] = ("personal", status_of(subscription, now), subscription)
        given = (await self.db.execute(select(ProductAssignment).where(ProductAssignment.user_id == auth.user_id))).scalars().all()
        for assignment in given:
            subscription = (await self.db.execute(select(ProductSubscription).where(ProductSubscription.owner_key == f"o:{assignment.organization_id}", ProductSubscription.product_key == assignment.product_key))).scalars().first()
            if subscription and subscription.ends_at > now and assignment.product_key not in found:
                found[assignment.product_key] = ("organization", status_of(subscription, now), subscription)
        return list(found.values())
