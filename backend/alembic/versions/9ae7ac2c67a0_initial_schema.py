"""Initial schema

Revision ID: 9ae7ac2c67a0
Revises: 
Create Date: 2026-04-11 22:53:37.387413

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9ae7ac2c67a0'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create payment_events table
    op.create_table('payment_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('stripe_session_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('pass_type', sa.String(), nullable=False),
        sa.Column('timestamp_utc', sa.DateTime(), nullable=True),
        sa.Column('timestamp_toronto', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('payment_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_payment_events_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_payment_events_stripe_session_id'), ['stripe_session_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_payment_events_user_id'), ['user_id'], unique=False)

    # 1.5. Ensure all referenced users exist before creating foreign keys
    op.execute("INSERT INTO users (user_id, find_noc_credits, audit_letter_credits) SELECT DISTINCT user_id, 0, 0 FROM evaluations WHERE user_id NOT IN (SELECT user_id FROM users)")
    op.execute("INSERT INTO users (user_id, find_noc_credits, audit_letter_credits) SELECT DISTINCT user_id, 0, 0 FROM audit_evaluations WHERE user_id NOT IN (SELECT user_id FROM users)")
    op.execute("INSERT INTO users (user_id, find_noc_credits, audit_letter_credits) SELECT DISTINCT user_id, 0, 0 FROM noc_evaluations WHERE user_id NOT IN (SELECT user_id FROM users)")

    # 2. Add columns to evaluations
    with op.batch_alter_table('evaluations', schema=None) as batch_op:
        # Pass server_default so existing rows don't error on nullable=False temporarily
        batch_op.add_column(sa.Column('evaluation_type', sa.String(), server_default='legacy', nullable=False))
        batch_op.add_column(sa.Column('detected_noc_code', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('timestamp_utc', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('timestamp_toronto', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_evaluations_detected_noc_code'), ['detected_noc_code'], unique=False)
        batch_op.create_index(batch_op.f('ix_evaluations_evaluation_type'), ['evaluation_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_evaluations_stored_file_id'), ['stored_file_id'], unique=False)
        # Ensure foreign key exists
        try:
            batch_op.create_foreign_key(None, 'users', ['user_id'], ['user_id'])
        except Exception:
            pass # might already exist in some Postgres configs
    
    # Update existing legacy evaluation rows
    op.execute("UPDATE evaluations SET timestamp_toronto = timestamp, timestamp_utc = timestamp")

    # 3. Migrate data from old tables into evaluations
    # For audit_evaluations
    op.execute('''
        INSERT INTO evaluations (
            user_id, evaluation_type, document_type, role_name, company_name, 
            original_filename, stored_file_id, compliance_status, is_premium_unlocked, 
            timestamp_utc, timestamp_toronto, payload
        )
        SELECT 
            user_id, 'audit', document_type, role_name, company_name, 
            original_filename, stored_file_id, compliance_status, is_premium_unlocked, 
            timestamp, timestamp, payload
        FROM audit_evaluations
    ''')
    op.execute('''
        UPDATE evaluations
        SET detected_noc_code = payload->'noc_analysis'->>'detected_code'
        WHERE evaluation_type = 'audit' AND payload->'noc_analysis' IS NOT NULL
    ''')

    # For noc_evaluations
    op.execute('''
        INSERT INTO evaluations (
            user_id, evaluation_type, document_type, role_name, company_name, 
            original_filename, stored_file_id, compliance_status, is_premium_unlocked, 
            timestamp_utc, timestamp_toronto, payload
        )
        SELECT 
            user_id, 'noc_finder', document_type, role_name, company_name, 
            original_filename, stored_file_id, compliance_status, is_premium_unlocked, 
            timestamp, timestamp, payload
        FROM noc_evaluations
    ''')
    op.execute('''
        UPDATE evaluations
        SET detected_noc_code = payload->'recommended_noc'->>'code'
        WHERE evaluation_type = 'noc_finder' AND payload->'recommended_noc' IS NOT NULL
    ''')

    # 4. Drop the timestamp column from evaluations now that it is migrated
    with op.batch_alter_table('evaluations', schema=None) as batch_op:
        batch_op.drop_column('timestamp')

    # 5. Drop old tables
    with op.batch_alter_table('audit_evaluations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_audit_evaluations_id'))
        batch_op.drop_index(batch_op.f('ix_audit_evaluations_user_id'))
    op.drop_table('audit_evaluations')
    
    with op.batch_alter_table('noc_evaluations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_noc_evaluations_id'))
        batch_op.drop_index(batch_op.f('ix_noc_evaluations_user_id'))
    op.drop_table('noc_evaluations')


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('evaluations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('timestamp', postgresql.TIMESTAMP(), autoincrement=False, nullable=True))
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_evaluations_stored_file_id'))
        batch_op.drop_index(batch_op.f('ix_evaluations_evaluation_type'))
        batch_op.drop_index(batch_op.f('ix_evaluations_detected_noc_code'))
        batch_op.drop_column('timestamp_toronto')
        batch_op.drop_column('timestamp_utc')
        batch_op.drop_column('detected_noc_code')
        batch_op.drop_column('evaluation_type')

    op.create_table('noc_evaluations',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('document_type', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('role_name', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('company_name', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('original_filename', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('stored_file_id', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('compliance_status', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('is_premium_unlocked', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('timestamp', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('payload', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('noc_evaluations_pkey'))
    )
    with op.batch_alter_table('noc_evaluations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_noc_evaluations_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_noc_evaluations_id'), ['id'], unique=False)

    op.create_table('audit_evaluations',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.VARCHAR(), autoincrement=False, nullable=False),
    sa.Column('document_type', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('role_name', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('company_name', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('original_filename', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('stored_file_id', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('compliance_status', sa.VARCHAR(), autoincrement=False, nullable=True),
    sa.Column('is_premium_unlocked', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('timestamp', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('payload', postgresql.JSON(astext_type=sa.Text()), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('audit_evaluations_pkey'))
    )
    with op.batch_alter_table('audit_evaluations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_audit_evaluations_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_audit_evaluations_id'), ['id'], unique=False)

    # ### end Alembic commands ###
