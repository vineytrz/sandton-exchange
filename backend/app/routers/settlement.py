from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_actor_role, require_ops
from app.models import Settlement, SettlementStatus, Trade
from app.schemas import SettlementOut, TradeOut
from app.services import confirm_settlement, create_settlement_batch

router = APIRouter(prefix="/settlement", tags=["settlement"])


def _trade_out(trade: Trade) -> TradeOut:
    return TradeOut(
        id=trade.id,
        buy_order_id=trade.buy_order_id,
        sell_order_id=trade.sell_order_id,
        instrument_id=trade.instrument_id,
        qty=trade.qty,
        price=trade.price,
        traded_at=trade.traded_at,
        ticker=trade.instrument.ticker if trade.instrument else None,
    )


def _settlement_out(settlement: Settlement) -> SettlementOut:
    return SettlementOut(
        id=settlement.id,
        trade_id=settlement.trade_id,
        settlement_date=settlement.settlement_date,
        status=settlement.status,
        confirmed_by=settlement.confirmed_by,
        confirmed_at=settlement.confirmed_at,
        trade=_trade_out(settlement.trade) if settlement.trade else None,
    )


@router.get("/pending", response_model=list[SettlementOut])
def list_pending(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    settlements = (
        db.query(Settlement)
        .options(joinedload(Settlement.trade).joinedload(Trade.instrument))
        .filter(Settlement.status == SettlementStatus.PENDING)
        .order_by(Settlement.settlement_date)
        .all()
    )
    return [_settlement_out(s) for s in settlements]


@router.post("/batch", response_model=list[SettlementOut])
def batch_settlements(
    db: Session = Depends(get_db),
    actor_role: str = Depends(require_ops),
):
    settlements = create_settlement_batch(db, actor_role)
    db.commit()
    result = []
    for s in settlements:
        db.refresh(s)
        loaded = (
            db.query(Settlement)
            .options(joinedload(Settlement.trade).joinedload(Trade.instrument))
            .filter(Settlement.id == s.id)
            .first()
        )
        if loaded:
            result.append(_settlement_out(loaded))
    return result


@router.post("/{settlement_id}/confirm", response_model=SettlementOut)
def confirm(
    settlement_id: int,
    db: Session = Depends(get_db),
    actor_role: str = Depends(require_ops),
):
    settlement = (
        db.query(Settlement)
        .options(joinedload(Settlement.trade).joinedload(Trade.instrument))
        .filter(Settlement.id == settlement_id)
        .first()
    )
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    if settlement.status != SettlementStatus.PENDING:
        raise HTTPException(status_code=400, detail="Settlement not pending")

    try:
        confirm_settlement(db, settlement, actor_role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    db.commit()
    db.refresh(settlement)
    return _settlement_out(settlement)
