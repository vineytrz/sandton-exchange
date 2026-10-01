"""Seed JSE-style demo data. Run via: python -m app.seed"""

import sys

from sqlalchemy.orm import Session

from app.audit import log_event
from app.database import SessionLocal
from app.migrations import run_migrations
from app.models import (
    Account,
    AuditEvent,
    Instrument,
    Order,
    OrderSide,
    OrderStatus,
    Trade,
)
from app.services import run_matching, validate_order

INSTRUMENTS = [
    {"ticker": "NPN", "name": "Naspers Ltd", "last_price": 2850.00},
    {"ticker": "SOL", "name": "Sasol Ltd", "last_price": 142.50},
    {"ticker": "AGL", "name": "Anglo American Platinum", "last_price": 520.75},
    {"ticker": "MTN", "name": "MTN Group Ltd", "last_price": 98.30},
    {"ticker": "FSR", "name": "FirstRand Ltd", "last_price": 68.45},
]

ACCOUNTS = [
    {"name": "Trader Alpha", "role_hint": "trader", "cash_balance": 5_000_000.0},
    {"name": "Trader Beta", "role_hint": "trader", "cash_balance": 3_000_000.0},
    {"name": "Back Office Ops", "role_hint": "ops", "cash_balance": 0.0},
]


def seed(db: Session) -> dict:
    run_migrations()

    if db.query(Instrument).count() > 0:
        return {
            "instruments": db.query(Instrument).count(),
            "accounts": db.query(Account).count(),
            "orders": db.query(Order).count(),
            "trades": db.query(Trade).count(),
            "audit_events": db.query(AuditEvent).count(),
            "skipped": True,
        }

    instruments = []
    for data in INSTRUMENTS:
        inst = Instrument(**data, currency="ZAR")
        db.add(inst)
        instruments.append(inst)
    db.flush()

    accounts = []
    for data in ACCOUNTS:
        acct = Account(**data)
        db.add(acct)
        accounts.append(acct)
    db.flush()

    trader_a, trader_b = accounts[0], accounts[1]
    npn = next(i for i in instruments if i.ticker == "NPN")
    sol = next(i for i in instruments if i.ticker == "SOL")

    seed_orders = [
        Order(
            account_id=trader_a.id,
            instrument_id=npn.id,
            side=OrderSide.BUY,
            qty=100,
            price=2850.00,
            status=OrderStatus.PENDING,
        ),
        Order(
            account_id=trader_b.id,
            instrument_id=npn.id,
            side=OrderSide.SELL,
            qty=100,
            price=2850.00,
            status=OrderStatus.PENDING,
        ),
        Order(
            account_id=trader_a.id,
            instrument_id=sol.id,
            side=OrderSide.BUY,
            qty=500,
            price=142.50,
            status=OrderStatus.PENDING,
        ),
        Order(
            account_id=trader_b.id,
            instrument_id=sol.id,
            side=OrderSide.SELL,
            qty=200,
            price=142.50,
            status=OrderStatus.PENDING,
        ),
    ]

    for order in seed_orders:
        db.add(order)
    db.flush()

    for order in seed_orders:
        log_event(
            db,
            "order",
            order.id,
            "order_placed",
            "seed",
            {"side": order.side.value, "qty": order.qty, "price": order.price},
        )
        if validate_order(db, order):
            order.status = OrderStatus.VALIDATED
            log_event(db, "order", order.id, "order_validated", "seed", {})
            order.status = OrderStatus.OPEN
            log_event(db, "order", order.id, "order_open", "seed", {})
            run_matching(db, order, "seed")
        else:
            order.status = OrderStatus.REJECTED
            log_event(db, "order", order.id, "order_rejected", "seed", {})

    db.commit()

    return {
        "instruments": db.query(Instrument).count(),
        "accounts": db.query(Account).count(),
        "orders": db.query(Order).count(),
        "trades": db.query(Trade).count(),
        "audit_events": db.query(AuditEvent).count(),
        "skipped": False,
    }


def main():
    db = SessionLocal()
    try:
        result = seed(db)
        print("Seed complete:", result)
        if result["trades"] == 0 and not result.get("skipped"):
            print("WARNING: No trades created during seed", file=sys.stderr)
            sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
