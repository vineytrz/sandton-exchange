from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_actor_role, require_ops
from app.models import (
    CorporateAction,
    CorporateActionStatus,
    CorporateActionType,
    Instrument,
    OnboardingStatus,
    ReconBreak,
    RiskLimit,
    Settlement,
    SettlementStatus,
    ComplianceAlert,
)
from app.platform_services import (
    apply_corporate_action,
    generate_account_statement,
    generate_eod_report,
    get_exceptions,
    get_settlement_fails,
    mark_settlement_failed,
    run_reconciliation,
    run_surveillance,
)
from app.audit import log_event

router = APIRouter(tags=["platform"])


class FailSettlementRequest(BaseModel):
    reason: str = Field(min_length=1)


class OnboardInstrumentRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    name: str
    last_price: float = Field(gt=0)


class CorporateActionCreate(BaseModel):
    instrument_id: int
    action_type: CorporateActionType
    ex_date: datetime
    pay_date: datetime
    amount_per_share: float | None = None
    split_ratio: float | None = None


@router.get("/exceptions")
def list_exceptions(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    return get_exceptions(db)


@router.get("/recon/breaks")
def list_recon_breaks(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    breaks = (
        db.query(ReconBreak)
        .filter(ReconBreak.status == "OPEN")
        .order_by(ReconBreak.created_at.desc())
        .all()
    )
    return [
        {
            "id": b.id,
            "account_id": b.account_id,
            "instrument_id": b.instrument_id,
            "break_type": b.break_type,
            "internal_value": b.internal_value,
            "custodian_value": b.custodian_value,
            "variance": b.variance,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in breaks
    ]


@router.post("/recon/run")
def run_recon(db: Session = Depends(get_db), actor: str = Depends(require_ops)):
    breaks = run_reconciliation(db, actor)
    db.commit()
    return {"breaks_found": len(breaks), "breaks": [{"id": b.id, "variance": b.variance} for b in breaks]}


@router.get("/settlement/fails")
def settlement_fails(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    return get_settlement_fails(db)


@router.post("/settlement/{settlement_id}/fail")
def fail_settlement(
    settlement_id: int,
    body: FailSettlementRequest,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    settlement = db.get(Settlement, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    mark_settlement_failed(db, settlement, body.reason, actor)
    db.commit()
    return {"id": settlement.id, "status": settlement.status.value, "reason": body.reason}


@router.get("/compliance/alerts")
def compliance_alerts(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    alerts = (
        db.query(ComplianceAlert)
        .filter(ComplianceAlert.status == "OPEN")
        .order_by(ComplianceAlert.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity.value,
            "entity_type": a.entity_type,
            "entity_id": a.entity_id,
            "description": a.description,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.post("/compliance/scan")
def compliance_scan(db: Session = Depends(get_db), actor: str = Depends(require_ops)):
    alerts = run_surveillance(db, actor)
    db.commit()
    return {"alerts_found": len(alerts)}


@router.get("/risk/limits")
def risk_limits(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    limits = db.query(RiskLimit).all()
    return [
        {
            "id": l.id,
            "account_id": l.account_id,
            "instrument_id": l.instrument_id,
            "limit_type": l.limit_type,
            "threshold": l.threshold,
            "description": l.description,
        }
        for l in limits
    ]


@router.get("/corporate-actions")
def list_corporate_actions(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    actions = (
        db.query(CorporateAction)
        .options(joinedload(CorporateAction.instrument))
        .order_by(CorporateAction.ex_date.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "instrument_id": a.instrument_id,
            "ticker": a.instrument.ticker if a.instrument else None,
            "action_type": a.action_type.value,
            "ex_date": a.ex_date,
            "pay_date": a.pay_date,
            "amount_per_share": a.amount_per_share,
            "split_ratio": a.split_ratio,
            "status": a.status.value,
        }
        for a in actions
    ]


@router.post("/corporate-actions")
def create_corporate_action(
    body: CorporateActionCreate,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    action = CorporateAction(
        instrument_id=body.instrument_id,
        action_type=body.action_type,
        ex_date=body.ex_date,
        pay_date=body.pay_date,
        amount_per_share=body.amount_per_share,
        split_ratio=body.split_ratio,
        status=CorporateActionStatus.PENDING,
    )
    db.add(action)
    db.flush()
    log_event(db, "corporate_action", action.id, "corporate_action_created", actor, {})
    db.commit()
    return {"id": action.id, "status": action.status.value}


@router.post("/corporate-actions/{action_id}/confirm")
def confirm_corporate_action(
    action_id: int,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    action = db.get(CorporateAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Not found")
    action.status = CorporateActionStatus.CONFIRMED
    log_event(db, "corporate_action", action.id, "corporate_action_confirmed", actor, {})
    db.commit()
    return {"id": action.id, "status": action.status.value}


@router.post("/corporate-actions/{action_id}/apply")
def apply_corp_action(
    action_id: int,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    action = db.get(CorporateAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Not found")
    if action.status != CorporateActionStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Must be confirmed first")
    try:
        apply_corporate_action(db, action, actor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    return {"id": action.id, "status": action.status.value}


@router.get("/accounts/{account_id}/statement")
def account_statement(
    account_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    try:
        return generate_account_statement(db, account_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/reporting/eod")
def eod_report(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    return generate_eod_report(db)


@router.get("/instruments/pending")
def pending_instruments(db: Session = Depends(get_db), _: str = Depends(get_actor_role)):
    pending = (
        db.query(Instrument)
        .filter(Instrument.onboarding_status == OnboardingStatus.PENDING_REVIEW)
        .all()
    )
    return [
        {
            "id": i.id,
            "ticker": i.ticker,
            "name": i.name,
            "last_price": i.last_price,
            "onboarding_status": i.onboarding_status.value,
        }
        for i in pending
    ]


@router.post("/instruments/onboard")
def onboard_instrument(
    body: OnboardInstrumentRequest,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    existing = db.query(Instrument).filter(Instrument.ticker == body.ticker.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ticker already exists")
    inst = Instrument(
        ticker=body.ticker.upper(),
        name=body.name,
        last_price=body.last_price,
        currency="ZAR",
        onboarding_status=OnboardingStatus.PENDING_REVIEW,
    )
    db.add(inst)
    db.flush()
    log_event(db, "instrument", inst.id, "instrument_onboarded", actor, {"ticker": inst.ticker})
    db.commit()
    return {"id": inst.id, "ticker": inst.ticker, "status": inst.onboarding_status.value}


@router.post("/instruments/{instrument_id}/approve")
def approve_instrument(
    instrument_id: int,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    inst = db.get(Instrument, instrument_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Not found")
    inst.onboarding_status = OnboardingStatus.APPROVED
    log_event(db, "instrument", inst.id, "instrument_approved", actor, {})
    db.commit()
    return {"id": inst.id, "ticker": inst.ticker, "status": inst.onboarding_status.value}


@router.post("/instruments/{instrument_id}/reject")
def reject_instrument(
    instrument_id: int,
    db: Session = Depends(get_db),
    actor: str = Depends(require_ops),
):
    inst = db.get(Instrument, instrument_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Not found")
    inst.onboarding_status = OnboardingStatus.REJECTED
    log_event(db, "instrument", inst.id, "instrument_rejected", actor, {})
    db.commit()
    return {"id": inst.id, "ticker": inst.ticker, "status": inst.onboarding_status.value}
