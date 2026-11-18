"""What a basket costs. Always worked out here from the catalogue: the browser's prices are never trusted."""

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

TERMS = (1, 3, 6, 12)  # months a buyer may choose
# Longest term first: the first one a basket reaches is the discount it gets.
DISCOUNTS = ((12, Decimal("10")), (6, Decimal("5")))
MAX_SEATS = 10_000

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def discount_percent(months: int) -> Decimal:
    return next((percent for threshold, percent in DISCOUNTS if months >= threshold), Decimal("0"))


@dataclass(frozen=True, slots=True)
class PricedLine:
    product_key: str
    plan_key: str
    months: int
    seats: int
    module_keys: tuple[str, ...]
    subtotal: Decimal
    discount: Decimal

    @property
    def amount(self) -> Decimal:
        return money(self.subtotal - self.discount)


def price_line(
    *,
    monthly_price: Decimal,
    seat_price: Decimal,
    module_prices: list[Decimal],
    months: int,
    seats: int,
    organization: bool,
) -> tuple[Decimal, Decimal]:
    """(subtotal, discount) of one line. An individual pays the plan price; an organization adds the seat price for
    every seat. Chosen modules add their monthly price."""
    monthly = monthly_price + sum(module_prices, Decimal("0")) + (seat_price * seats if organization else Decimal("0"))
    subtotal = money(monthly * months)
    return subtotal, money(subtotal * discount_percent(months) / 100)


def add_months(start: datetime, months: int) -> datetime:
    """The same day `months` later; the last day of a shorter month when that day does not exist."""
    month_index = start.month - 1 + months
    year, month = start.year + month_index // 12, month_index % 12 + 1
    for day in (start.day, 30, 29, 28):
        try:
            return start.replace(year=year, month=month, day=day)
        except ValueError:
            continue
    raise ValueError("unreachable")
