"""add tracker_data to pr_journeys (PR Application Tracker milestones)

Revision ID: e5f7a9c1d3b4
Revises: d4e6f8a0b2c3
Create Date: 2026-06-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f7a9c1d3b4'
down_revision = 'd4e6f8a0b2c3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Milestone dates + stream + dependents for the PR Application Tracker (free tier).
    # Nullable JSON, so existing rows are unaffected.
    with op.batch_alter_table('pr_journeys', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tracker_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('pr_journeys', schema=None) as batch_op:
        batch_op.drop_column('tracker_data')
