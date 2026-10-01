from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_actor_role
from app.models import Trade
from app.schemas import TradeOut

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
        ticker=trade.instrument.ticker if trade.instrument else None,
    )


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
