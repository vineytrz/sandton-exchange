"""Add trade affirmation columns

Revision ID: 002
Revises: 001
Create Date: 2026-10-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

affirmation_enum = sa.Enum(
    "PENDING_AFFIRMATION",
    "AFFIRMED",
    name="affirmationstatus",
)


def upgrade() -> None:
    affirmation_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "trades",
        sa.Column(
            "affirmation_status",
            affirmation_enum,
            nullable=False,
            server_default="PENDING_AFFIRMATION",
        ),
    )
    op.add_column(
        "trades",
        sa.Column("affirmed_by", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "trades",
        sa.Column("affirmed_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("trades", "affirmed_at")
    op.drop_column("trades", "affirmed_by")
    op.drop_column("trades", "affirmation_status")
    affirmation_enum.drop(op.get_bind(), checkfirst=True)
