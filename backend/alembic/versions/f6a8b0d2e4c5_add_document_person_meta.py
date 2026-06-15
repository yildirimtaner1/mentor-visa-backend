"""add person_ref + meta to document_items (per-person docs, multi police certs)

Revision ID: f6a8b0d2e4c5
Revises: e5f7a9c1d3b4
Create Date: 2026-06-10 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f6a8b0d2e4c5'
down_revision = 'e5f7a9c1d3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('document_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('person_ref', sa.String(), nullable=True, server_default='principal'))
        batch_op.add_column(sa.Column('meta', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('document_items', schema=None) as batch_op:
        batch_op.drop_column('meta')
        batch_op.drop_column('person_ref')
