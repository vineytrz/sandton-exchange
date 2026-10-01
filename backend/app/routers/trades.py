from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_actor_role, require_ops
from app.models import AffirmationStatus, Trade
from app.schemas import TradeOut
from app.services import affirm_trade

router = APIRouter(prefix="/trades", tags=["trades"])


def _trade_out(trade: Trade) -> TradeOut:
    return TradeOut(
        id=trade.id,
        buy_order_id=trade.buy_order_id,
        sell_order_id=trade.sell_order_id,
        instrument_id=trade.instrument_id,
        qty=trade.qty,
        price=trade.price,
        traded_at=trade.traded_at,
        affirmation_status=trade.affirmation_status,
        affirmed_by=trade.affirmed_by,
        affirmed_at=trade.affirmed_at,
        ticker=trade.instrument.ticker if trade.instrument else None,
    )


@router.get("/pending-affirmation", response_model=list[TradeOut])
def list_pending_affirmation(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    trades = (
        db.query(Trade)
        .options(joinedload(Trade.instrument))
        .filter(Trade.affirmation_status == AffirmationStatus.PENDING_AFFIRMATION)
        .order_by(Trade.traded_at.desc())
        .all()
    )
    return [_trade_out(t) for t in trades]


@router.get("", response_model=list[TradeOut])
def list_trades(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    trades = (
        db.query(Trade)
        .options(joinedload(Trade.instrument))
        .order_by(Trade.traded_at.desc())
        .all()
    )
    return [_trade_out(t) for t in trades]


@router.post("/{trade_id}/affirm", response_model=TradeOut)
def affirm(
    trade_id: int,
    db: Session = Depends(get_db),
    actor_role: str = Depends(require_ops),
):
    trade = (
        db.query(Trade)
        .options(joinedload(Trade.instrument))
        .filter(Trade.id == trade_id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    try:
        affirm_trade(db, trade, actor_role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    db.refresh(trade)
    return _trade_out(trade)


@router.get("/{trade_id}", response_model=TradeOut)
def get_trade(
    trade_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    trade = (
        db.query(Trade)
        .options(joinedload(Trade.instrument))
        .filter(Trade.id == trade_id)
        .first()
    )
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return _trade_out(trade)
