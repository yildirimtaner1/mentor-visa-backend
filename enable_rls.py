import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv('DATABASE_URL')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

engine = create_engine(database_url)
inspector = inspect(engine)
tables = inspector.get_table_names()

with engine.begin() as conn:
    for table in tables:
        print(f'Enabling RLS on {table}...')
        conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;'))

print('Successfully enabled RLS on all tables.')
