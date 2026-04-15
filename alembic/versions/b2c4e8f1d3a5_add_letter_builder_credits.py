"""Add letter_builder_credits to users table

Revision ID: b2c4e8f1d3a5
Revises: 9ae7ac2c67a0
Create Date: 2026-04-14 02:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c4e8f1d3a5'
down_revision: Union[str, Sequence[str], None] = '9ae7ac2c67a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('letter_builder_credits', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('letter_builder_credits')
