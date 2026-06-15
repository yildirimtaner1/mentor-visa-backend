"""Import community Express Entry case data (Immitracker export) into immitracker_cases.

Run monthly when a fresh export is provided:
    ./venv/Scripts/python.exe import_immitracker.py path/to/cases.json [--replace]

Idempotent: upserts by Case ID. Pass --replace to wipe the table first for a clean reload.
The full source row is stored in `raw` for fidelity; cohort dims + milestone day-deltas are
extracted into typed columns that power the tracker's processing-time predictions.
"""
import sys
import json
import datetime

import database
from journey_models import ImmitrackerCase

# Pre-computed day-delta fields already in the source -> model column
DAY_FIELDS = {
    "Number of days from AOR to BIL": "aor_to_bil",
    "Number of Days after AOR to Meds passed": "aor_to_meds",
    "Days from AOR to PPR": "aor_to_ppr",
    "Days from Submission to PPR": "submission_to_ppr",
    "Number of Days after Meds passed to PPR": "meds_to_ppr",
}

# Deltas we compute ourselves from raw dates: model column -> source date field (anchored on AOR)
DATE_DELTA_FIELDS = {
    "aor_to_p1": "Portal 1 Email (Inland)",
    "aor_to_decision": "Decision Made",
    "aor_to_ecopr": "eCoPR Date (Inland Landing)",
}


def _parse_date(s):
    if s in (None, "", "N/A"):
        return None
    s = " ".join(str(s).split())
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _int(v, lo=-5, hi=1000):
    """Parse an int from messy strings; return None if missing/garbage/out-of-range."""
    if v in (None, "", "N/A"):
        return None
    try:
        x = int(float(str(v).strip()))
    except (ValueError, TypeError):
        return None
    return x if lo < x < hi else None


def _str(v):
    if v in (None, "", "N/A"):
        return None
    return str(v).strip()


def row_to_fields(r: dict) -> dict:
    f = {
        "stream": _str(r.get("Stream")),
        "country_of_residence": _str(r.get("Country of Residence")),
        "primary_vo": _str(r.get("Primary VO")),
        "ee_draw_category": _str(r.get("EE Draw Category")),
        "nationality": _str(r.get("Nationality")),
        "noc_code": _str(r.get("NOC Code")),
        "crs_score": _int(r.get("CRS Score"), lo=0, hi=1200),
        "current_status": _str(r.get("Current Status")),
        "state": _str(r.get("State")),
        "raw": r,
    }
    for src, col in DAY_FIELDS.items():
        f[col] = _int(r.get(src))
    # Compute late-stage deltas from raw dates (AOR -> milestone).
    aor = _parse_date(r.get("AOR Date"))
    for col, date_field in DATE_DELTA_FIELDS.items():
        target = _parse_date(r.get(date_field))
        f[col] = (target - aor).days if (aor and target and -5 < (target - aor).days < 1500) else None
    return f


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    replace = "--replace" in sys.argv
    path = args[0] if args else r"C:\Users\yildi\.gemini\antigravity\scratch\immitracker-scraper\immitracker_cases_since_june_2025.json"

    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    print(f"Loaded {len(data)} records from {path}")

    db = database.SessionLocal()
    try:
        if replace:
            n = db.query(ImmitrackerCase).delete()
            db.commit()
            print(f"--replace: cleared {n} existing rows")

        existing = {c.case_id: c for c in db.query(ImmitrackerCase).all()}
        created = updated = skipped = 0
        for r in data:
            cid = _str(r.get("Case ID"))
            if not cid:
                skipped += 1
                continue
            fields = row_to_fields(r)
            obj = existing.get(cid)
            if obj:
                for k, v in fields.items():
                    setattr(obj, k, v)
                updated += 1
            else:
                obj = ImmitrackerCase(case_id=cid, **fields)
                db.add(obj)
                existing[cid] = obj
                created += 1
        db.commit()
        total = db.query(ImmitrackerCase).count()
        print(f"Done. created={created} updated={updated} skipped(no id)={skipped} | table total={total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
