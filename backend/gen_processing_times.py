"""Generate a static public processing-times dataset (by stream) for the SEO content page.
Re-run monthly after import_immitracker.py. Writes frontend/src/data/processingTimes.json."""
import json, statistics as st, datetime, os
import database
from journey_models import ImmitrackerCase

TRANSITIONS = [
    ("aor_to_bil", "AOR to Biometrics"),
    ("aor_to_meds", "AOR to Medical Passed"),
    ("aor_to_decision", "AOR to Final Decision"),
    ("aor_to_p1", "AOR to P1 (PR Portal)"),
    ("aor_to_ppr", "AOR to PPR / Portal 2"),
    ("aor_to_ecopr", "AOR to eCOPR"),
]
STREAMS = ["CEC", "FSW-Outland", "PNP-Inland", "FSW-Inland", "PNP-Outland"]
MIN_N = 10

def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]

db = database.SessionLocal()
cases = db.query(ImmitrackerCase).all()
db.close()

def stats_for(filter_fn):
    out = {}
    for key, label in TRANSITIONS:
        vals = [getattr(c, key) for c in cases if filter_fn(c) and getattr(c, key) is not None]
        if len(vals) >= MIN_N:
            out[key] = {"label": label, "n": len(vals), "p25": pct(vals, 25), "median": int(st.median(vals)), "p75": pct(vals, 75)}
    return out

data = {
    "generated": datetime.date.today().isoformat(),
    "total_cases": len(cases),
    "all": stats_for(lambda c: True),
    "by_stream": {s: stats_for(lambda c, s=s: c.stream == s) for s in STREAMS},
}
data["by_stream"] = {s: v for s, v in data["by_stream"].items() if v}

out_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data", "processingTimes.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print(f"Wrote {out_path} | total_cases={data['total_cases']} streams={list(data['by_stream'])}")
