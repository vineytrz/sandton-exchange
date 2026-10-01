from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, Enum):
    OPEN = "OPEN"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"


@dataclass
class BookOrder:
    id: int
    side: Side
    qty: int
    filled_qty: int
    price: float
    created_at: datetime
    status: OrderStatus = OrderStatus.OPEN

    @property
    def remaining_qty(self) -> int:
        return self.qty - self.filled_qty

    @classmethod
    def from_dict(cls, data: dict) -> "BookOrder":
        return cls(
            id=data["id"],
            side=Side(data["side"]) if isinstance(data["side"], str) else data["side"],
            qty=data["qty"],
            filled_qty=data.get("filled_qty", 0),
            price=data["price"],
            created_at=data["created_at"],
            status=OrderStatus(data.get("status", OrderStatus.OPEN)),
        )


@dataclass
class TradeResult:
    buy_order_id: int
    sell_order_id: int
    qty: int
    price: float


@dataclass
class MatchResult:
    trades: list[TradeResult] = field(default_factory=list)
    updated_orders: dict[int, BookOrder] = field(default_factory=dict)


def _active_orders(orders: list[BookOrder]) -> list[BookOrder]:
    return [
        o
        for o in orders
        if o.status not in (OrderStatus.CANCELLED, OrderStatus.FILLED)
        and o.remaining_qty > 0
    ]


def match_order(incoming: BookOrder, book: list[BookOrder]) -> MatchResult:
    """Match an incoming order against the book using price-time priority."""
    result = MatchResult()
    working = BookOrder(
        id=incoming.id,
        side=incoming.side,
        qty=incoming.qty,
        filled_qty=incoming.filled_qty,
        price=incoming.price,
        created_at=incoming.created_at,
        status=incoming.status,
    )

    if working.side == Side.BUY:
        candidates = sorted(
            [
                o
                for o in _active_orders(book)
                if o.side == Side.SELL
                and o.id != working.id
                and o.price <= working.price
            ],
            key=lambda o: (o.price, o.created_at),
        )
    else:
        candidates = sorted(
            [
                o
                for o in _active_orders(book)
                if o.side == Side.BUY
                and o.id != working.id
                and o.price >= working.price
            ],
            key=lambda o: (-o.price, o.created_at),
        )

    for resting in candidates:
        if working.remaining_qty <= 0:
            break
        if resting.remaining_qty <= 0:
            continue

        trade_qty = min(working.remaining_qty, resting.remaining_qty)
        trade_price = resting.price

        if working.side == Side.BUY:
            buy_id, sell_id = working.id, resting.id
        else:
            buy_id, sell_id = resting.id, working.id

        result.trades.append(
            TradeResult(
                buy_order_id=buy_id,
                sell_order_id=sell_id,
                qty=trade_qty,
                price=trade_price,
            )
        )

        working.filled_qty += trade_qty
        resting.filled_qty += trade_qty

        for order in (working, resting):
            if order.remaining_qty <= 0:
                order.status = OrderStatus.FILLED
            elif order.filled_qty > 0:
                order.status = OrderStatus.PARTIAL

        result.updated_orders[resting.id] = resting

    if working.filled_qty > 0 and working.remaining_qty > 0:
        working.status = OrderStatus.PARTIAL
    elif working.remaining_qty <= 0:
        working.status = OrderStatus.FILLED
    else:
        working.status = OrderStatus.OPEN

    result.updated_orders[working.id] = working
    return result
