from datetime import datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.audit import log_event
from app.matching_engine import BookOrder, Side
from app.matching_engine import OrderStatus as EngineStatus
from app.matching_engine import match_order
from app.models import (
    Account,
    Instrument,
    Order,
    OrderSide,
    OrderStatus,
    Settlement,
    SettlementStatus,
    Trade,
)


def _to_book_order(order: Order) -> BookOrder:
    return BookOrder(
        id=order.id,
        side=Side.BUY if order.side == OrderSide.BUY else Side.SELL,
        qty=order.qty,
        filled_qty=order.filled_qty,
        price=order.price,
        created_at=order.created_at,
        status=EngineStatus(order.status.value)
        if order.status
        in (OrderStatus.OPEN, OrderStatus.PARTIAL, OrderStatus.FILLED, OrderStatus.CANCELLED)
        else EngineStatus.OPEN,
    )


def _engine_to_db_status(engine_status: EngineStatus) -> OrderStatus:
    mapping = {
        EngineStatus.OPEN: OrderStatus.OPEN,
        EngineStatus.PARTIAL: OrderStatus.PARTIAL,
        EngineStatus.FILLED: OrderStatus.FILLED,
        EngineStatus.CANCELLED: OrderStatus.CANCELLED,
    }
    return mapping[engine_status]


def validate_order(db: Session, order: Order) -> bool:
    account = db.get(Account, order.account_id)
    instrument = db.get(Instrument, order.instrument_id)
    if not account or not instrument:
        order.status = OrderStatus.REJECTED
        return False
    if order.qty <= 0 or order.price <= 0:
        order.status = OrderStatus.REJECTED
        return False
    if order.side == OrderSide.BUY:
        required = order.qty * order.price
        if account.cash_balance < required:
            order.status = OrderStatus.REJECTED
            return False
    return True


def run_matching(db: Session, incoming: Order, actor: str) -> list[Trade]:
    open_orders = (
        db.query(Order)
        .filter(
            Order.instrument_id == incoming.instrument_id,
            Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIAL]),
        )
        .all()
    )

    book = [_to_book_order(o) for o in open_orders if o.id != incoming.id]
    incoming_book = _to_book_order(incoming)
    result = match_order(incoming_book, book)

    trades: list[Trade] = []
    for trade_result in result.trades:
        trade = Trade(
            buy_order_id=trade_result.buy_order_id,
            sell_order_id=trade_result.sell_order_id,
            instrument_id=incoming.instrument_id,
            qty=trade_result.qty,
            price=trade_result.price,
        )
        db.add(trade)
        db.flush()

        instrument = db.get(Instrument, incoming.instrument_id)
        if instrument:
            instrument.last_price = trade_result.price

        log_event(
            db,
            "trade",
            trade.id,
            "trade_created",
            actor,
            {
                "buy_order_id": trade.buy_order_id,
                "sell_order_id": trade.sell_order_id,
                "qty": trade.qty,
                "price": trade.price,
            },
        )
        trades.append(trade)

    for order_id, updated in result.updated_orders.items():
        db_order = db.get(Order, order_id)
        if db_order:
            db_order.filled_qty = updated.filled_qty
            db_order.status = _engine_to_db_status(updated.status)
            log_event(
                db,
                "order",
                db_order.id,
                "order_matched",
                actor,
                {
                    "filled_qty": db_order.filled_qty,
                    "status": db_order.status.value,
                },
            )

    return trades


def create_settlement_batch(db: Session, actor: str) -> list[Settlement]:
    unsettled_trades = (
        db.query(Trade)
        .outerjoin(Settlement)
        .filter(Settlement.id.is_(None))
        .all()
    )

    settlements: list[Settlement] = []
    settlement_date = datetime.utcnow() + timedelta(days=3)

    for trade in unsettled_trades:
        settlement = Settlement(
            trade_id=trade.id,
            settlement_date=settlement_date,
            status=SettlementStatus.PENDING,
        )
        db.add(settlement)
        db.flush()
        log_event(
            db,
            "settlement",
            settlement.id,
            "settlement_batched",
            actor,
            {"trade_id": trade.id, "settlement_date": settlement_date.isoformat()},
        )
        settlements.append(settlement)

    return settlements


def confirm_settlement(db: Session, settlement: Settlement, actor: str) -> None:
    trade = db.get(Trade, settlement.trade_id)
    if not trade:
        raise ValueError("Trade not found")

    buy_order = db.get(Order, trade.buy_order_id)
    sell_order = db.get(Order, trade.sell_order_id)
    if not buy_order or not sell_order:
        raise ValueError("Orders not found")

    buy_account = db.get(Account, buy_order.account_id)
    sell_account = db.get(Account, sell_order.account_id)
    if not buy_account or not sell_account:
        raise ValueError("Accounts not found")

    amount = trade.qty * trade.price
    buy_account.cash_balance -= amount
    sell_account.cash_balance += amount

    settlement.status = SettlementStatus.CONFIRMED
    settlement.confirmed_by = actor
    settlement.confirmed_at = datetime.utcnow()

    log_event(
        db,
        "settlement",
        settlement.id,
        "settlement_confirmed",
        actor,
        {
            "trade_id": trade.id,
            "amount": amount,
            "buy_account_id": buy_account.id,
            "sell_account_id": sell_account.id,
        },
    )


def get_portfolio(db: Session, account_id: int) -> dict:
    account = db.get(Account, account_id)
    if not account:
        raise ValueError("Account not found")

    confirmed_settlements = (
        db.query(Settlement)
        .options(joinedload(Settlement.trade))
        .filter(Settlement.status == SettlementStatus.CONFIRMED)
        .all()
    )

    positions: dict[int, dict] = {}
    for settlement in confirmed_settlements:
        trade = settlement.trade
        buy_order = db.get(Order, trade.buy_order_id)
        sell_order = db.get(Order, trade.sell_order_id)

        for order, sign in ((buy_order, 1), (sell_order, -1)):
            if order.account_id != account_id:
                continue
            inst_id = trade.instrument_id
            if inst_id not in positions:
                positions[inst_id] = {"qty": 0, "total_cost": 0.0}
            positions[inst_id]["qty"] += sign * trade.qty
            positions[inst_id]["total_cost"] += sign * trade.qty * trade.price

    position_list = []
    for inst_id, data in positions.items():
        if data["qty"] == 0:
            continue
        instrument = db.get(Instrument, inst_id)
        avg_price = abs(data["total_cost"] / data["qty"]) if data["qty"] else 0
        position_list.append(
            {
                "instrument_id": inst_id,
                "ticker": instrument.ticker if instrument else "UNKNOWN",
                "qty": data["qty"],
                "avg_price": round(avg_price, 2),
            }
        )

    return {
        "account_id": account.id,
        "account_name": account.name,
        "cash_balance": round(account.cash_balance, 2),
        "positions": position_list,
    }
