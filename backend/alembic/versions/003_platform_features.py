"""Platform features: recon, risk, corp actions, compliance, onboarding

Revision ID: 003
Revises: 002
Create Date: 2026-10-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    onboarding_enum = postgresql.ENUM(
        "PENDING_REVIEW", "APPROVED", "REJECTED", name="onboardingstatus", create_type=False
    )
    corp_type_enum = postgresql.ENUM(
        "DIVIDEND", "SPLIT", name="corporateactiontype", create_type=False
    )
    corp_status_enum = postgresql.ENUM(
        "PENDING", "CONFIRMED", "APPLIED", name="corporateactionstatus", create_type=False
    )
    severity_enum = postgresql.ENUM(
        "LOW", "MEDIUM", "HIGH", name="exceptionseverity", create_type=False
    )

    for enum_type in (onboarding_enum, corp_type_enum, corp_status_enum, severity_enum):
        enum_type.create(bind, checkfirst=True)

    op.add_column(
        "instruments",
        sa.Column(
            "onboarding_status",
            onboarding_enum,
            nullable=False,
            server_default="APPROVED",
        ),
    )
    op.add_column(
        "settlements",
        sa.Column("fail_reason", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "settlements",
        sa.Column("failed_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "custodian_positions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("as_of_date", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "custodian_cash",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("cash_balance", sa.Float(), nullable=False),
        sa.Column("as_of_date", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id"),
    )
    op.create_table(
        "recon_breaks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=True),
        sa.Column("break_type", sa.String(length=20), nullable=False),
        sa.Column("internal_value", sa.Float(), nullable=False),
        sa.Column("custodian_value", sa.Float(), nullable=False),
        sa.Column("variance", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "risk_limits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=True),
        sa.Column("instrument_id", sa.Integer(), nullable=True),
        sa.Column("limit_type", sa.String(length=30), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "corporate_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=False),
        sa.Column("action_type", corp_type_enum, nullable=False),
        sa.Column("ex_date", sa.DateTime(), nullable=False),
        sa.Column("pay_date", sa.DateTime(), nullable=False),
        sa.Column("amount_per_share", sa.Float(), nullable=True),
        sa.Column("split_ratio", sa.Float(), nullable=True),
        sa.Column("status", corp_status_enum, nullable=True),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "compliance_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("severity", severity_enum, nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("compliance_alerts")
    op.drop_table("corporate_actions")
    op.drop_table("risk_limits")
    op.drop_table("recon_breaks")
    op.drop_table("custodian_cash")
    op.drop_table("custodian_positions")
    op.drop_column("settlements", "failed_at")
    op.drop_column("settlements", "fail_reason")
    op.drop_column("instruments", "onboarding_status")
    sa.Enum(name="exceptionseverity").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="corporateactionstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="corporateactiontype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="onboardingstatus").drop(op.get_bind(), checkfirst=True)
