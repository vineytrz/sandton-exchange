from datetime import datetime

from pydantic import BaseModel, Field

from app.models import AffirmationStatus, OrderSide, OrderStatus, SettlementStatus


class AccountOut(BaseModel):
    id: int
    name: str
    role_hint: str
    cash_balance: float
    created_at: datetime

    model_config = {"from_attributes": True}


class InstrumentOut(BaseModel):
    id: int
    ticker: str
    name: str
    last_price: float
    currency: str

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    account_id: int
    instrument_id: int
    side: OrderSide
    qty: int = Field(gt=0)
    price: float = Field(gt=0)


class OrderOut(BaseModel):
    id: int
    account_id: int
    instrument_id: int
    side: OrderSide
    qty: int
    filled_qty: int
    price: float
    status: OrderStatus
    created_at: datetime
    ticker: str | None = None

    model_config = {"from_attributes": True}


class TradeOut(BaseModel):
    id: int
    buy_order_id: int
    sell_order_id: int
    instrument_id: int
    qty: int
    price: float
    traded_at: datetime
    affirmation_status: AffirmationStatus
    affirmed_by: str | None = None
    affirmed_at: datetime | None = None
    ticker: str | None = None

    model_config = {"from_attributes": True}


class SettlementOut(BaseModel):
    id: int
    trade_id: int
    settlement_date: datetime
    status: SettlementStatus
    confirmed_by: str | None
    confirmed_at: datetime | None
    trade: TradeOut | None = None

    model_config = {"from_attributes": True}


class PositionOut(BaseModel):
    instrument_id: int
    ticker: str
    qty: int
    avg_price: float


class PortfolioOut(BaseModel):
    account_id: int
    account_name: str
    cash_balance: float
    positions: list[PositionOut]


class OrderBookLevel(BaseModel):
    price: float
    qty: int
    order_count: int


class OrderBookOut(BaseModel):
    instrument_id: int
    ticker: str
    bids: list[OrderBookLevel]
    asks: list[OrderBookLevel]


class AuditEventOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    actor: str
    payload_json: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkConfirmRequest(BaseModel):
    settlement_ids: list[int] = Field(min_length=1)


class OpsDashboardOut(BaseModel):
    market_open: bool
    open_orders: int
    pending_affirmations: int
    pending_settlements: int
    todays_trades: int
    confirmed_settlements: int
    audit_events_today: int


class InstrumentTickerOut(BaseModel):
    ticker: str
    last_price: float
    currency: str
