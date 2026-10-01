"""Back-office platform services — recon, exceptions, compliance, risk, corp actions."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session, joinedload

from app.audit import log_event
from app.models import (
    Account,
    AffirmationStatus,
    ComplianceAlert,
    CorporateAction,
    CorporateActionStatus,
    CorporateActionType,
    CustodianCash,
    CustodianPosition,
    ExceptionCategory,
    ExceptionSeverity,
    Instrument,
    OnboardingStatus,
    Order,
    OrderSide,
    OrderStatus,
    ReconBreak,
    RiskLimit,
    Settlement,
    SettlementStatus,
    Trade,
)
from app.services import get_portfolio


def check_risk_limits(db: Session, order: Order) -> tuple[bool, str | None]:
    limits = db.query(RiskLimit).all()
    account = db.get(Account, order.account_id)
    if not account:
        return False, "Account not found"

    notional = order.qty * order.price

    for limit in limits:
        if limit.account_id and limit.account_id != order.account_id:
            continue
        if limit.instrument_id and limit.instrument_id != order.instrument_id:
            continue

        if limit.limit_type == "MAX_ORDER_NOTIONAL" and notional > limit.threshold:
            return False, f"Order notional {notional:.2f} exceeds limit {limit.threshold:.2f}"

        if limit.limit_type == "MAX_POSITION_QTY" and order.side == OrderSide.BUY:
            portfolio = get_portfolio(db, order.account_id)
            current = next(
                (p["qty"] for p in portfolio["positions"] if p["instrument_id"] == order.instrument_id),
                0,
            )
            if current + order.qty > limit.threshold:
                return False, f"Position would be {current + order.qty}, limit {limit.threshold:.0f}"

        if limit.limit_type == "MIN_CASH_BALANCE" and order.side == OrderSide.BUY:
            remaining = account.cash_balance - notional
            if remaining < limit.threshold:
                return False, f"Cash after order {remaining:.2f} below minimum {limit.threshold:.2f}"

    return True, None


def run_reconciliation(db: Session, actor: str) -> list[ReconBreak]:
    db.query(ReconBreak).filter(ReconBreak.status == "OPEN").update({"status": "SUPERSEDED"})

    breaks: list[ReconBreak] = []
    now = datetime.utcnow()
    accounts = db.query(Account).filter(Account.role_hint == "trader").all()

    for account in accounts:
        portfolio = get_portfolio(db, account.id)
        internal_positions = {p["instrument_id"]: p["qty"] for p in portfolio["positions"]}

        custodian_positions = (
            db.query(CustodianPosition)
            .filter(CustodianPosition.account_id == account.id)
            .all()
        )
        cust_map = {cp.instrument_id: cp.qty for cp in custodian_positions}

        all_instruments = set(internal_positions.keys()) | set(cust_map.keys())
        for inst_id in all_instruments:
            internal_qty = internal_positions.get(inst_id, 0)
            cust_qty = cust_map.get(inst_id, 0)
            if internal_qty != cust_qty:
                brk = ReconBreak(
                    account_id=account.id,
                    instrument_id=inst_id,
                    break_type="POSITION",
                    internal_value=float(internal_qty),
                    custodian_value=float(cust_qty),
                    variance=float(internal_qty - cust_qty),
                    status="OPEN",
                )
                db.add(brk)
                db.flush()
                log_event(db, "recon_break", brk.id, "recon_break_found", actor,
                          {"variance": brk.variance, "instrument_id": inst_id})
                breaks.append(brk)

        cust_cash = db.query(CustodianCash).filter_by(account_id=account.id).first()
        if cust_cash and abs(account.cash_balance - cust_cash.cash_balance) > 0.01:
            brk = ReconBreak(
                account_id=account.id,
                instrument_id=None,
                break_type="CASH",
                internal_value=account.cash_balance,
                custodian_value=cust_cash.cash_balance,
                variance=account.cash_balance - cust_cash.cash_balance,
                status="OPEN",
            )
            db.add(brk)
            db.flush()
            log_event(db, "recon_break", brk.id, "recon_break_found", actor,
                      {"break_type": "CASH", "variance": brk.variance})
            breaks.append(brk)

    log_event(db, "recon", 0, "recon_completed", actor, {"breaks_found": len(breaks)})
    return breaks


def get_settlement_fails(db: Session) -> list[dict]:
    now = datetime.utcnow()
    results: list[dict] = []

    failed = (
        db.query(Settlement)
        .options(joinedload(Settlement.trade).joinedload(Trade.instrument))
        .filter(Settlement.status == SettlementStatus.FAILED)
        .all()
    )
    for s in failed:
        results.append(_fail_item(s, "FAILED", s.fail_reason or "Settlement failed"))

    overdue = (
        db.query(Settlement)
        .options(joinedload(Settlement.trade).joinedload(Trade.instrument))
        .filter(
            Settlement.status == SettlementStatus.PENDING,
            Settlement.settlement_date < now,
        )
        .all()
    )
    for s in overdue:
        days = (now - s.settlement_date).days
        results.append(_fail_item(s, "OVERDUE", f"Aging fail — {days} day(s) past settlement date"))

    return results


def _fail_item(settlement: Settlement, fail_type: str, reason: str) -> dict:
    trade = settlement.trade
    return {
        "settlement_id": settlement.id,
        "trade_id": settlement.trade_id,
        "fail_type": fail_type,
        "reason": reason,
        "settlement_date": settlement.settlement_date,
        "ticker": trade.instrument.ticker if trade and trade.instrument else None,
        "qty": trade.qty if trade else None,
        "price": trade.price if trade else None,
        "status": settlement.status.value,
    }


def mark_settlement_failed(db: Session, settlement: Settlement, reason: str, actor: str) -> None:
    settlement.status = SettlementStatus.FAILED
    settlement.fail_reason = reason
    settlement.failed_at = datetime.utcnow()
    log_event(db, "settlement", settlement.id, "settlement_failed", actor, {"reason": reason})


def run_surveillance(db: Session, actor: str) -> list[ComplianceAlert]:
    db.query(ComplianceAlert).filter(ComplianceAlert.status == "OPEN").update(
        {"status": "SUPERSEDED"}
    )
    alerts: list[ComplianceAlert] = []

    trades = db.query(Trade).options(joinedload(Trade.buy_order), joinedload(Trade.sell_order)).all()
    for trade in trades:
        if trade.buy_order.account_id == trade.sell_order.account_id:
            alert = ComplianceAlert(
                alert_type="WASH_TRADE",
                severity=ExceptionSeverity.HIGH,
                entity_type="trade",
                entity_id=trade.id,
                description=f"Wash trade suspected: same account on buy and sell (trade #{trade.id})",
            )
            db.add(alert)
            alerts.append(alert)

    accounts = db.query(Account).filter(Account.role_hint == "trader").all()
    for account in accounts:
        orders = db.query(Order).filter(Order.account_id == account.id).all()
        if len(orders) < 5:
            continue
        cancelled = sum(1 for o in orders if o.status == OrderStatus.CANCELLED)
        ratio = cancelled / len(orders)
        if ratio > 0.5:
            alert = ComplianceAlert(
                alert_type="HIGH_CANCEL_RATIO",
                severity=ExceptionSeverity.MEDIUM,
                entity_type="account",
                entity_id=account.id,
                description=f"Cancel ratio {ratio:.0%} on account {account.name} ({cancelled}/{len(orders)} orders)",
            )
            db.add(alert)
            alerts.append(alert)

    for alert in alerts:
        db.flush()
        log_event(db, "compliance_alert", alert.id, "alert_raised", actor,
                  {"alert_type": alert.alert_type, "severity": alert.severity.value})

    return alerts


def get_exceptions(db: Session) -> list[dict]:
    exceptions: list[dict] = []
    now = datetime.utcnow()

    for trade in db.query(Trade).filter(
        Trade.affirmation_status == AffirmationStatus.PENDING_AFFIRMATION
    ).all():
        exceptions.append({
            "id": f"affirm-{trade.id}",
            "type": "AFFIRMATION_PENDING",
            "severity": ExceptionSeverity.MEDIUM.value,
            "category": ExceptionCategory.NEEDS_HUMAN.value,
            "entity_type": "trade",
            "entity_id": trade.id,
            "description": f"Trade #{trade.id} awaiting Ops affirmation",
            "created_at": trade.traded_at.isoformat(),
        })

    for brk in db.query(ReconBreak).filter(ReconBreak.status == "OPEN").all():
        exceptions.append({
            "id": f"recon-{brk.id}",
            "type": "RECON_BREAK",
            "severity": ExceptionSeverity.HIGH.value,
            "category": ExceptionCategory.NEEDS_HUMAN.value,
            "entity_type": "recon_break",
            "entity_id": brk.id,
            "description": f"Recon break: {brk.break_type} variance {brk.variance:+.0f}",
            "created_at": brk.created_at.isoformat(),
        })

    for fail in get_settlement_fails(db):
        cat = ExceptionCategory.RETRY_SAFE if fail["fail_type"] == "OVERDUE" else ExceptionCategory.NEEDS_HUMAN
        exceptions.append({
            "id": f"fail-{fail['settlement_id']}",
            "type": "SETTLEMENT_FAIL",
            "severity": ExceptionSeverity.HIGH.value,
            "category": cat.value,
            "entity_type": "settlement",
            "entity_id": fail["settlement_id"],
            "description": fail["reason"],
            "created_at": now.isoformat(),
        })

    for inst in db.query(Instrument).filter(
        Instrument.onboarding_status == OnboardingStatus.PENDING_REVIEW
    ).all():
        exceptions.append({
            "id": f"onboard-{inst.id}",
            "type": "INSTRUMENT_ONBOARDING",
            "severity": ExceptionSeverity.LOW.value,
            "category": ExceptionCategory.NEEDS_HUMAN.value,
            "entity_type": "instrument",
            "entity_id": inst.id,
            "description": f"New listing {inst.ticker} pending approval",
            "created_at": now.isoformat(),
        })

    for alert in db.query(ComplianceAlert).filter(ComplianceAlert.status == "OPEN").all():
        exceptions.append({
            "id": f"compliance-{alert.id}",
            "type": "COMPLIANCE_ALERT",
            "severity": alert.severity.value,
            "category": ExceptionCategory.INFORMATIONAL.value,
            "entity_type": alert.entity_type,
            "entity_id": alert.entity_id,
            "description": alert.description,
            "created_at": alert.created_at.isoformat(),
        })

    for action in db.query(CorporateAction).filter(
        CorporateAction.status == CorporateActionStatus.PENDING
    ).all():
        exceptions.append({
            "id": f"corp-{action.id}",
            "type": "CORPORATE_ACTION",
            "severity": ExceptionSeverity.MEDIUM.value,
            "category": ExceptionCategory.NEEDS_HUMAN.value,
            "entity_type": "corporate_action",
            "entity_id": action.id,
            "description": f"Corporate action pending: {action.action_type.value}",
            "created_at": action.ex_date.isoformat(),
        })

    return sorted(exceptions, key=lambda x: x["created_at"], reverse=True)


def apply_corporate_action(db: Session, action: CorporateAction, actor: str) -> None:
    if action.status == CorporateActionStatus.APPLIED:
        raise ValueError("Already applied")

    accounts = db.query(Account).filter(Account.role_hint == "trader").all()

    if action.action_type == CorporateActionType.DIVIDEND:
        amount = action.amount_per_share or 0
        for account in accounts:
            portfolio = get_portfolio(db, account.id)
            for pos in portfolio["positions"]:
                if pos["instrument_id"] == action.instrument_id:
                    dividend = pos["qty"] * amount
                    account.cash_balance += dividend

    elif action.action_type == CorporateActionType.SPLIT:
        ratio = action.split_ratio or 1.0
        log_event(db, "corporate_action", action.id, "split_applied", actor,
                  {"ratio": ratio, "note": "Position qty adjustment recorded in audit"})

    action.status = CorporateActionStatus.APPLIED
    log_event(db, "corporate_action", action.id, "corporate_action_applied", actor,
              {"action_type": action.action_type.value})


def generate_account_statement(db: Session, account_id: int) -> dict:
    account = db.get(Account, account_id)
    if not account:
        raise ValueError("Account not found")
    portfolio = get_portfolio(db, account_id)
    all_trades = (
        db.query(Trade)
        .options(
            joinedload(Trade.instrument),
            joinedload(Trade.buy_order),
            joinedload(Trade.sell_order),
        )
        .order_by(Trade.traded_at.desc())
        .all()
    )
    trades = [
        t for t in all_trades
        if t.buy_order.account_id == account_id or t.sell_order.account_id == account_id
    ][:20]
    return {
        "account_id": account.id,
        "account_name": account.name,
        "statement_date": datetime.utcnow().isoformat(),
        "cash_balance": portfolio["cash_balance"],
        "positions": portfolio["positions"],
        "recent_trades": [
            {
                "id": t.id,
                "ticker": t.instrument.ticker if t.instrument else None,
                "qty": t.qty,
                "price": t.price,
                "traded_at": t.traded_at.isoformat(),
            }
            for t in trades
        ],
    }


def generate_eod_report(db: Session) -> dict:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "report_date": datetime.utcnow().isoformat(),
        "total_accounts": db.query(Account).count(),
        "trades_today": db.query(Trade).filter(Trade.traded_at >= today_start).count(),
        "open_orders": db.query(Order).filter(
            Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIAL])
        ).count(),
        "pending_settlements": db.query(Settlement).filter(
            Settlement.status == SettlementStatus.PENDING
        ).count(),
        "open_recon_breaks": db.query(ReconBreak).filter(ReconBreak.status == "OPEN").count(),
        "open_compliance_alerts": db.query(ComplianceAlert).filter(
            ComplianceAlert.status == "OPEN"
        ).count(),
        "pending_affirmations": db.query(Trade).filter(
            Trade.affirmation_status == AffirmationStatus.PENDING_AFFIRMATION
        ).count(),
    }
