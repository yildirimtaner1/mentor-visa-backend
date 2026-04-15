import database, db_models, json

db = next(database.get_db())
records = db.query(db_models.AuditEvaluationRecord).order_by(db_models.AuditEvaluationRecord.id.desc()).limit(10).all()

issues = 0
for r in records:
    payload = r.payload if isinstance(r.payload, dict) else {}
    duties = payload.get("noc_analysis", {}).get("duties_match", [])
    if isinstance(duties, list) and len(duties) > 0:
        first = duties[0]
        if isinstance(first, str):
            print(f"Auditor ID {r.id}: FOUND STRING ARRAY IN DUTIES: {first[:50]}")
            issues += 1
        elif not isinstance(first, dict):
            print(f"Auditor ID {r.id}: WEIRD FORMAT {type(first)}")
            issues += 1
        else:
            # check dict keys
            if "applicant_duty" not in first or "official_noc_duty" not in first:
                print(f"Auditor ID {r.id}: DICT MISSING KEYS: {first.keys()}")
                issues += 1

if issues == 0:
    print("ALL 10 RECENT AUDITOR PAYLOADS CLEAN AND PROPERLY FORMATTED.")
