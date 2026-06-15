"""add immitracker_cases (community processing-time data for tracker predictions)

Revision ID: a7b9c1e3f5d6
Revises: f6a8b0d2e4c5
Create Date: 2026-06-10 02:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'a7b9c1e3f5d6'
down_revision = 'f6a8b0d2e4c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'immitracker_cases',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('case_id', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('stream', sa.String(), nullable=True, index=True),
        sa.Column('country_of_residence', sa.String(), nullable=True, index=True),
        sa.Column('primary_vo', sa.String(), nullable=True),
        sa.Column('ee_draw_category', sa.String(), nullable=True, index=True),
        sa.Column('nationality', sa.String(), nullable=True),
        sa.Column('noc_code', sa.String(), nullable=True),
        sa.Column('crs_score', sa.Integer(), nullable=True),
        sa.Column('aor_to_bil', sa.Integer(), nullable=True),
        sa.Column('aor_to_meds', sa.Integer(), nullable=True),
        sa.Column('aor_to_ppr', sa.Integer(), nullable=True),
        sa.Column('submission_to_ppr', sa.Integer(), nullable=True),
        sa.Column('meds_to_ppr', sa.Integer(), nullable=True),
        sa.Column('current_status', sa.String(), nullable=True),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('raw', sa.JSON(), nullable=True),
        sa.Column('imported_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('immitracker_cases')
