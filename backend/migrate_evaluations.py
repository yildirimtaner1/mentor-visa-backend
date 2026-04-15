import os
from database import SessionLocal
import db_models
from sqlalchemy.orm import Session

def migrate_data():
    db: Session = SessionLocal()
    
    print("Fetching legacy records from 'evaluations' table...")
    # Get all records from the old EvaluationRecord table
    legacy_records = db.query(db_models.EvaluationRecord).all()
    print(f"Found {len(legacy_records)} records.")
    
    migrated_count = 0
    for record in legacy_records:
        doc_type = record.document_type or "Unknown"
        payload = record.payload or {}
        
        if payload.get("evaluation_type") == "noc_finder" or doc_type == "NOC Finder Query":
            # Check if it already exists to avoid duplicates if run multiple times
            exists = db.query(db_models.NocEvaluationRecord).filter_by(
                user_id=record.user_id, stored_file_id=record.stored_file_id
            ).first()
            if not exists:
                new_record = db_models.NocEvaluationRecord(
                    user_id=record.user_id,
                    document_type=record.document_type,
                    role_name=record.role_name,
                    company_name=record.company_name,
                    original_filename=record.original_filename,
                    stored_file_id=record.stored_file_id,
                    compliance_status=record.compliance_status,
                    is_premium_unlocked=record.is_premium_unlocked,
                    timestamp=record.timestamp,
                    payload=record.payload
                )
                db.add(new_record)
                migrated_count += 1
        else:
            # Audit
            exists = db.query(db_models.AuditEvaluationRecord).filter_by(
                user_id=record.user_id, stored_file_id=record.stored_file_id
            ).first()
            if not exists:
                new_record = db_models.AuditEvaluationRecord(
                    user_id=record.user_id,
                    document_type=record.document_type,
                    role_name=record.role_name,
                    company_name=record.company_name,
                    original_filename=record.original_filename,
                    stored_file_id=record.stored_file_id,
                    compliance_status=record.compliance_status,
                    is_premium_unlocked=record.is_premium_unlocked,
                    timestamp=record.timestamp,
                    payload=record.payload
                )
                db.add(new_record)
                migrated_count += 1

    db.commit()
    db.close()
    print(f"Migration complete. Successfully migrated {migrated_count} records.")

if __name__ == "__main__":
    migrate_data()
