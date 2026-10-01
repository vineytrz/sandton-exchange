from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_actor_role
from app.models import Account, Instrument
from app.schemas import AccountOut, InstrumentOut, PortfolioOut, PositionOut
from app.services import get_portfolio

router = APIRouter(tags=["accounts"])


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    return db.query(Account).order_by(Account.id).all()


@router.get("/accounts/{account_id}/portfolio", response_model=PortfolioOut)
def account_portfolio(
    account_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    try:
        data = get_portfolio(db, account_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Account not found")
    return PortfolioOut(
        account_id=data["account_id"],
        account_name=data["account_name"],
        cash_balance=data["cash_balance"],
        positions=[PositionOut(**p) for p in data["positions"]],
    )


@router.get("/instruments", response_model=list[InstrumentOut])
def list_instruments(
    db: Session = Depends(get_db),
    _: str = Depends(get_actor_role),
):
    return db.query(Instrument).order_by(Instrument.ticker).all()
