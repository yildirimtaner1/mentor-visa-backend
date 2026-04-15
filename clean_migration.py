import sqlite3
import json
import os

db_path = "mentorvisa.db"
if not os.path.exists(db_path):
    print("No mentorvisa.db found, skipping manual data migration.")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables_to_rename = {
    "evaluations": "z_old_evaluations",
    "audit_evaluations": "z_old_audit_evaluations",
    "noc_evaluations": "z_old_noc_evaluations"
}

for old, new in tables_to_rename.items():
    try:
        cursor.execute(f"ALTER TABLE {old} RENAME TO {new}")
        print(f"Renamed {old} to {new}")
    except Exception as e:
        print(f"Skipping {old} rename: {e}")

conn.commit()

# Now create new schema with SQLAlchemy
import db_models
from database import engine

db_models.Base.metadata.create_all(bind=engine)

def migrate_data(table_name, default_type):
    try:
        cursor.execute(f"SELECT id, user_id, document_type, role_name, company_name, original_filename, stored_file_id, compliance_status, is_premium_unlocked, timestamp, payload FROM {table_name}")
        rows = cursor.fetchall()
    except Exception as e:
        print(f"Could not read {table_name}: {e}")
        return

    for row in rows:
        old_id, user_id, document_type, role_name, company_name, original_filename, stored_file_id, compliance_status, is_premium_unlocked, timestamp, payload_str = row
        
        detected_noc_code = None
        if payload_str:
            try:
                payload_dict = json.loads(payload_str)
                if "noc_analysis" in payload_dict and "detected_code" in payload_dict["noc_analysis"]:
                    detected_noc_code = payload_dict["noc_analysis"]["detected_code"]
                elif "recommended_noc" in payload_dict and "code" in payload_dict["recommended_noc"]:
                    detected_noc_code = payload_dict["recommended_noc"]["code"]
            except Exception:
                pass
        
        eval_type = default_type
        if default_type == "audit" and document_type == "NOC Finder Query":
            eval_type = "noc_finder"
            
        cursor.execute("""
            INSERT INTO evaluations (
                user_id, evaluation_type, document_type, role_name, company_name, 
                original_filename, stored_file_id, compliance_status, detected_noc_code,
                is_premium_unlocked, timestamp_utc, timestamp_toronto, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, eval_type, document_type, role_name, company_name,
            original_filename, stored_file_id, compliance_status, detected_noc_code,
            is_premium_unlocked, timestamp, timestamp, payload_str
        ))
    
    print(f"Migrated {len(rows)} rows from {table_name}")

migrate_data("z_old_audit_evaluations", "audit")
migrate_data("z_old_noc_evaluations", "noc_finder")
migrate_data("z_old_evaluations", "audit")

try:
    cursor.execute("DROP TABLE z_old_audit_evaluations")
    cursor.execute("DROP TABLE z_old_noc_evaluations")
    cursor.execute("DROP TABLE z_old_evaluations")
    print("Cleaned up old tables.")
except Exception as e:
    print(f"Could not drop some tables: {e}")

conn.commit()
conn.close()
print("Migration completely successful.")
