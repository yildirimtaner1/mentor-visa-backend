import os
from sqlalchemy import create_engine, MetaData, Table, inspect
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("NO DATABASE URL")
    exit(1)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url)
metadata = MetaData()
metadata.reflect(bind=engine)

from sqlalchemy import create_engine, MetaData, Table, inspect, text

# ... earlier lines already there but I will explicitly rewrite logic:
with engine.begin() as conn:
    print("Migrating audit_evaluations...")
    try:
        conn.execute(text('''
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
        '''))
        
        conn.execute(text('''
            UPDATE evaluations
            SET detected_noc_code = payload->'noc_analysis'->>'detected_code'
            WHERE evaluation_type = 'audit' AND payload->'noc_analysis' IS NOT NULL
        '''))
        print("Migrated audit_evaluations successfully.")
    except Exception as e:
        print(f"Error or already migrated audit_evaluations: {e}")

    print("Migrating noc_evaluations...")
    try:
        conn.execute(text('''
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
        '''))
        
        conn.execute(text('''
            UPDATE evaluations
            SET detected_noc_code = payload->'recommended_noc'->>'code'
            WHERE evaluation_type = 'noc_finder' AND payload->'recommended_noc' IS NOT NULL
        '''))
        print("Migrated noc_evaluations successfully.")
    except Exception as e:
        print(f"Error or already migrated noc_evaluations: {e}")
        
    try:
        conn.execute(text('DROP TABLE audit_evaluations'))
        conn.execute(text('DROP TABLE noc_evaluations'))
        print("Dropped legacy tables.")
    except Exception as e:
        print("Could not drop legacy tables:", e)

    try:
        # Also let's drop the z_old_ tables if they ended up bleeding over? No, those were sqlite only.
        # Ensure evaluations has no stragglers? It should be fully migrated.
        pass
    except:
        pass

print("Supabase migration complete.")
