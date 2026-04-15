import database, db_models, json

db = next(database.get_db())
records = db.query(db_models.NocEvaluationRecord).order_by(db_models.NocEvaluationRecord.id.desc()).limit(5).all()

for r in records:
    print(f"--- ID={r.id} ---")
    payload = r.payload if isinstance(r.payload, dict) else {}
    duties = payload.get("matched_duties", [])
    if isinstance(duties, list) and len(duties) > 0:
        first = duties[0]
        if isinstance(first, str):
            print("  Format: LIST OF STRINGS")
            print(f"  First: {first[:100].encode('utf-8')}")
        elif isinstance(first, dict):
            print(f"  Format: LIST OF DICTS, Keys: {list(first.keys())}")
            print(f"  First app_duty: {str(first.get('applicant_duty', ''))[:100].encode('utf-8')}")
        else:
            print(f"  Format: OTHER ({type(first)})")
    else:
        print("  Format: EMPTY OR NOT LIST")
    print()
