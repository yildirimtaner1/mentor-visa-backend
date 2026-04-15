from dotenv import load_dotenv
load_dotenv()
from database import SessionLocal
import db_models
import json

db = SessionLocal()

# Get the specific record
r = db.query(db_models.Evaluation).filter_by(id=461).first()
if r:
    print(f"document_type: '{r.document_type}'")
    print(f"evaluation_type: '{r.evaluation_type}'")
    payload = r.payload
    if isinstance(payload, str):
        payload = json.loads(payload)
    # Check if document_type is in payload
    print(f"payload.document_type: '{payload.get('document_type', 'NOT SET')}'")
    print(f"\nFull payload (truncated):")
    print(json.dumps(payload, indent=2)[:3000])
else:
    print("Record not found")

db.close()
