"""Seed JSE-style demo data. Run via: python -m app.seed"""

import sys

from sqlalchemy.orm import Session

from app.audit import log_event
from app.database import SessionLocal
from app.migrations import run_migrations
from datetime import datetime, timedelta

from app.models import (
    Account,
    AuditEvent,
    CorporateAction,
    CorporateActionStatus,
    CorporateActionType,
    CustodianCash,
    CustodianPosition,
    Instrument,
    OnboardingStatus,
    Order,
    OrderSide,
    OrderStatus,
    RiskLimit,
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


def _seed_platform_extras(db: Session, accounts: list[Account], instruments: list[Instrument]) -> None:
    if db.query(RiskLimit).count() > 0:
        return

    trader_a, trader_b = accounts[0], accounts[1]
    npn = next((i for i in instruments if i.ticker == "NPN"), instruments[0])
    sol = next((i for i in instruments if i.ticker == "SOL"), instruments[0])

    if not db.query(Instrument).filter(Instrument.ticker == "SHP").first():
        db.add(
            Instrument(
                ticker="SHP",
                name="Shoprite Holdings",
                last_price=285.00,
                currency="ZAR",
                onboarding_status=OnboardingStatus.PENDING_REVIEW,
            )
        )

    now = datetime.utcnow()
    for acct in [trader_a, trader_b]:
        db.add(
            CustodianCash(
                account_id=acct.id,
                cash_balance=acct.cash_balance - 5000.0,
                as_of_date=now,
            )
        )
    db.add(
        CustodianPosition(
            account_id=trader_a.id, instrument_id=npn.id, qty=98, as_of_date=now
        )
    )
    db.add_all(
        [
            RiskLimit(
                account_id=None,
                instrument_id=None,
                limit_type="MAX_ORDER_NOTIONAL",
                threshold=2_000_000.0,
                description="Global max order notional (ZAR)",
            ),
            RiskLimit(
                account_id=trader_a.id,
                instrument_id=None,
                limit_type="MIN_CASH_BALANCE",
                threshold=100_000.0,
                description="Minimum cash after buy order",
            ),
            RiskLimit(
                account_id=trader_a.id,
                instrument_id=npn.id,
                limit_type="MAX_POSITION_QTY",
                threshold=10_000,
                description="Max NPN shares for Trader Alpha",
            ),
        ]
    )
    if not db.query(CorporateAction).count():
        db.add(
            CorporateAction(
                instrument_id=sol.id,
                action_type=CorporateActionType.DIVIDEND,
                ex_date=now + timedelta(days=7),
                pay_date=now + timedelta(days=14),
                amount_per_share=2.50,
                status=CorporateActionStatus.PENDING,
            )
        )
    db.commit()


def seed(db: Session) -> dict:
    run_migrations()

    if db.query(Instrument).count() > 0:
        accounts = db.query(Account).order_by(Account.id).all()
        instruments = db.query(Instrument).all()
        _seed_platform_extras(db, accounts, instruments)
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

    pending_inst = Instrument(
        ticker="SHP",
        name="Shoprite Holdings",
        last_price=285.00,
        currency="ZAR",
        onboarding_status=OnboardingStatus.PENDING_REVIEW,
    )
    db.add(pending_inst)
    db.flush()

    now = datetime.utcnow()
    for acct in [trader_a, trader_b]:
        db.add(CustodianCash(
            account_id=acct.id,
            cash_balance=acct.cash_balance - 5000.0,
            as_of_date=now,
        ))
    db.add(CustodianPosition(
        account_id=trader_a.id, instrument_id=npn.id, qty=98, as_of_date=now,
    ))

    db.add_all([
        RiskLimit(account_id=None, instrument_id=None, limit_type="MAX_ORDER_NOTIONAL",
                  threshold=2_000_000.0, description="Global max order notional (ZAR)"),
        RiskLimit(account_id=trader_a.id, instrument_id=None, limit_type="MIN_CASH_BALANCE",
                  threshold=100_000.0, description="Minimum cash after buy order"),
        RiskLimit(account_id=trader_a.id, instrument_id=npn.id, limit_type="MAX_POSITION_QTY",
                  threshold=10_000, description="Max NPN shares for Trader Alpha"),
    ])

    db.add(CorporateAction(
        instrument_id=sol.id,
        action_type=CorporateActionType.DIVIDEND,
        ex_date=now + timedelta(days=7),
        pay_date=now + timedelta(days=14),
        amount_per_share=2.50,
        status=CorporateActionStatus.PENDING,
    ))

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
        if validate_order(db, order, "seed"):
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
