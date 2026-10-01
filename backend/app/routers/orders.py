from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.audit import log_event
from app.database import get_db
from app.deps import get_actor_role, require_trader
from app.models import Instrument, Order, OrderStatus
from app.schemas import OrderBookLevel, OrderBookOut, OrderCreate, OrderOut
from app.services import run_matching, validate_order

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        account_id=order.account_id,
        instrument_id=order.instrument_id,
        side=order.side,
        qty=order.qty,
        filled_qty=order.filled_qty,
        price=order.price,
        status=order.status,
        created_at=order.created_at,
        ticker=order.instrument.ticker if order.instrument else None,
    )


@router.post("", response_model=OrderOut)
def create_order(
    body: OrderCreate,
    db: Session = Depends(get_db),
    actor_role: str = Depends(require_trader),
):
    order = Order(
        account_id=body.account_id,
        instrument_id=body.instrument_id,
        side=body.side,
        qty=body.qty,
        price=body.price,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.flush()

    log_event(
        db,
        "order",
        order.id,
        "order_placed",
        actor_role,
        {
            "account_id": order.account_id,
            "instrument_id": order.instrument_id,
            "side": order.side.value,
            "qty": order.qty,
            "price": order.price,
        },
    )

    if not validate_order(db, order):
        log_event(
            db,
            "order",
            order.id,
            "order_rejected",
            actor_role,
            {"reason": "validation_failed"},
        )
        db.commit()
        db.refresh(order)
        raise HTTPException(status_code=400, detail="Order validation failed")

    order.status = OrderStatus.VALIDATED
    log_event(
        db,
        "order",
        order.id,
        "order_validated",
        actor_role,
        {"status": order.status.value},
    )

    order.status = OrderStatus.OPEN
    log_event(
        db,
        "order",
        order.id,
        "order_open",
        actor_role,
        {"status": order.status.value},
    )

    run_matching(db, order, actor_role)
    db.commit()
    db.refresh(order)
    order = (
        db.query(Order)
        .options(joinedload(Order.instrument))
        .filter(Order.id == order.id)
        .first()
    )
    return _order_out(order)


@router.get("", response_model=list[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    orders = (
        db.query(Order)
        .options(joinedload(Order.instrument))
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_order_out(o) for o in orders]


@router.get("/book/{instrument_id}", response_model=OrderBookOut)
def get_order_book(
    instrument_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    instrument = db.get(Instrument, instrument_id)
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    orders = (
        db.query(Order)
        .filter(
            Order.instrument_id == instrument_id,
            Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIAL]),
        )
        .all()
    )

    bids: dict[float, dict] = defaultdict(lambda: {"qty": 0, "count": 0})
    asks: dict[float, dict] = defaultdict(lambda: {"qty": 0, "count": 0})

    for order in orders:
        remaining = order.remaining_qty
        if remaining <= 0:
            continue
        book = bids if order.side.value == "BUY" else asks
        book[order.price]["qty"] += remaining
        book[order.price]["count"] += 1

    bid_levels = [
        OrderBookLevel(price=p, qty=d["qty"], order_count=d["count"])
        for p, d in sorted(bids.items(), key=lambda x: -x[0])
    ]
    ask_levels = [
        OrderBookLevel(price=p, qty=d["qty"], order_count=d["count"])
        for p, d in sorted(asks.items(), key=lambda x: x[0])
    ]

    return OrderBookOut(
        instrument_id=instrument.id,
        ticker=instrument.ticker,
        bids=bid_levels,
        asks=ask_levels,
    )


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.instrument))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_out(order)


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    actor_role: str = Depends(require_trader),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.instrument))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.OPEN, OrderStatus.PARTIAL, OrderStatus.VALIDATED):
        raise HTTPException(status_code=400, detail="Order cannot be cancelled")

    order.status = OrderStatus.CANCELLED
    log_event(
        db,
        "order",
        order.id,
        "order_cancelled",
        actor_role,
        {"status": order.status.value},
    )
    db.commit()
    db.refresh(order)
    return _order_out(order)
