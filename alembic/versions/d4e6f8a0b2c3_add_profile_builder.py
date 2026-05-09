"""add profile_builder_credits and conversations table

Revision ID: d4e6f8a0b2c3
Revises: c3d5f7a9e1b2
Create Date: 2026-04-30 02:50:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e6f8a0b2c3'
down_revision = 'c3d5f7a9e1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add profile_builder_credits to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('profile_builder_credits', sa.Integer(), nullable=False, server_default='0'))

    # 2. Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('conversation_id', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False, index=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('messages', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('conversations')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('profile_builder_credits')
