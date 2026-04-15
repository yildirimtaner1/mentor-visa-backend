"""add_ita_strategy_credits

Revision ID: c3d5f7a9e1b2
Revises: b2c4e8f1d3a5
Create Date: 2026-04-14 20:58:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d5f7a9e1b2'
down_revision = 'b2c4e8f1d3a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ita_strategy_credits', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('ita_strategy_credits')
