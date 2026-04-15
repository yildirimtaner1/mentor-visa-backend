from dotenv import load_dotenv
load_dotenv()

import database
import db_models
import json

db = next(database.get_db())

records = db.query(db_models.NocEvaluationRecord).order_by(db_models.NocEvaluationRecord.id.desc()).limit(5).all()

with open('db_clean.txt', 'w', encoding='utf-8') as f:
    for r in records:
        f.write(f"ID: {r.id}\n")
        f.write(f"Role: {r.role_name}\n")
        f.write(f"Premium: {r.is_premium_unlocked}\n")
        f.write(json.dumps(r.payload, indent=2) + "\n")
        f.write("-" * 40 + "\n")
