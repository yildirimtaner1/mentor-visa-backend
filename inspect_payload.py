import database, db_models, json

db = next(database.get_db())
records = db.query(db_models.NocEvaluationRecord).order_by(db_models.NocEvaluationRecord.id.desc()).limit(3).all()

for r in records:
    payload = r.payload if isinstance(r.payload, dict) else {}
    duties = payload.get("matched_duties", [])
    print(f"--- ID={r.id}, noc={payload.get('noc_code','?')} ---")
    print(f"  matched_duties type: {type(duties)}, count: {len(duties) if isinstance(duties, list) else 'N/A'}")
    if isinstance(duties, list) and len(duties) > 0:
        print(f"  first item type: {type(duties[0])}")
        print(f"  first item: {json.dumps(duties[0]) if isinstance(duties[0], dict) else repr(duties[0])}")
    else:
        print(f"  matched_duties is EMPTY or not a list")
    print()
