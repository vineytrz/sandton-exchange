import enum
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    VALIDATED = "VALIDATED"
    OPEN = "OPEN"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class SettlementStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class AffirmationStatus(str, enum.Enum):
    PENDING_AFFIRMATION = "PENDING_AFFIRMATION"
    AFFIRMED = "AFFIRMED"


class OnboardingStatus(str, enum.Enum):
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class CorporateActionType(str, enum.Enum):
    DIVIDEND = "DIVIDEND"
    SPLIT = "SPLIT"


class CorporateActionStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    APPLIED = "APPLIED"


class ExceptionSeverity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ExceptionCategory(str, enum.Enum):
    RETRY_SAFE = "RETRY_SAFE"
    NEEDS_HUMAN = "NEEDS_HUMAN"
    INFORMATIONAL = "INFORMATIONAL"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_hint: Mapped[str] = mapped_column(String(20), nullable=False)
    cash_balance: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    orders: Mapped[list["Order"]] = relationship(back_populates="account")


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="ZAR")
    onboarding_status: Mapped[OnboardingStatus] = mapped_column(
        Enum(OnboardingStatus), default=OnboardingStatus.APPROVED
    )

    orders: Mapped[list["Order"]] = relationship(back_populates="instrument")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id"), nullable=False
    )
    side: Mapped[OrderSide] = mapped_column(Enum(OrderSide), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    filled_qty: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    account: Mapped["Account"] = relationship(back_populates="orders")
    instrument: Mapped["Instrument"] = relationship(back_populates="orders")

    @property
    def remaining_qty(self) -> int:
        return self.qty - self.filled_qty


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buy_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    sell_order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False
    )
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id"), nullable=False
    )
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    traded_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    affirmation_status: Mapped[AffirmationStatus] = mapped_column(
        Enum(AffirmationStatus), default=AffirmationStatus.PENDING_AFFIRMATION
    )
    affirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    affirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    buy_order: Mapped["Order"] = relationship(foreign_keys=[buy_order_id])
    sell_order: Mapped["Order"] = relationship(foreign_keys=[sell_order_id])
    instrument: Mapped["Instrument"] = relationship()
    settlement: Mapped["Settlement | None"] = relationship(
        back_populates="trade", uselist=False
    )


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.id"), unique=True)
    settlement_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[SettlementStatus] = mapped_column(
        Enum(SettlementStatus), default=SettlementStatus.PENDING
    )
    confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fail_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    trade: Mapped["Trade"] = relationship(back_populates="settlement")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class CustodianPosition(Base):
    __tablename__ = "custodian_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id"), nullable=False
    )
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    as_of_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CustodianCash(Base):
    __tablename__ = "custodian_cash"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), unique=True)
    cash_balance: Mapped[float] = mapped_column(Float, nullable=False)
    as_of_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class ReconBreak(Base):
    __tablename__ = "recon_breaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True
    )
    break_type: Mapped[str] = mapped_column(String(20), nullable=False)
    internal_value: Mapped[float] = mapped_column(Float, nullable=False)
    custodian_value: Mapped[float] = mapped_column(Float, nullable=False)
    variance: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class RiskLimit(Base):
    __tablename__ = "risk_limits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    instrument_id: Mapped[int | None] = mapped_column(
        ForeignKey("instruments.id"), nullable=True
    )
    limit_type: Mapped[str] = mapped_column(String(30), nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=False)


class CorporateAction(Base):
    __tablename__ = "corporate_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(
        ForeignKey("instruments.id"), nullable=False
    )
    action_type: Mapped[CorporateActionType] = mapped_column(
        Enum(CorporateActionType), nullable=False
    )
    ex_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    pay_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    amount_per_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    split_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[CorporateActionStatus] = mapped_column(
        Enum(CorporateActionStatus), default=CorporateActionStatus.PENDING
    )

    instrument: Mapped["Instrument"] = relationship()


class ComplianceAlert(Base):
    __tablename__ = "compliance_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[ExceptionSeverity] = mapped_column(
        Enum(ExceptionSeverity), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
