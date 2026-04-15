from database import engine
from sqlalchemy import text

def enable_rls():
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;'))
        conn.execute(text('ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;'))
        conn.commit()
    print('RLS Enabled successfully!')

if __name__ == "__main__":
    enable_rls()
