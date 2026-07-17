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

def _has_raw(c, key):
    return (c.raw or {}).get(key) not in (None, "", "N/A")


def furthest_stage(c) -> str:
    """The furthest milestone this case has reported (for the community snapshot)."""
    if c.aor_to_ecopr is not None or _has_raw(c, "eCoPR Date (Inland Landing)"):
        return "ecopr"
    if _has_raw(c, "Portal 2 Email / PPR Date") or _has_raw(c, "Portal 1 Email (Inland)"):
        return "p1_ppr"
    if c.aor_to_decision is not None:
        return "decision"
    if _has_raw(c, "Last BGS change Date"):
        return "bg_check"
    if c.aor_to_meds is not None:
        return "medical"
    if c.aor_to_bil is not None:
        return "bil"
    return "aor"


SNAPSHOT_STAGES = ["aor", "bil", "medical", "bg_check", "decision", "p1_ppr", "ecopr"]
snap_counts = {s: 0 for s in SNAPSHOT_STAGES}
inland = 0
for c in cases:
    snap_counts[furthest_stage(c)] += 1
    if (c.country_of_residence or "").strip().lower() == "canada":
        inland += 1

data = {
    "generated": datetime.date.today().isoformat(),
    "total_cases": len(cases),
    "all": stats_for(lambda c: True),
    "by_stream": {s: stats_for(lambda c, s=s: c.stream == s) for s in STREAMS},
    "snapshot": {
        "stages": snap_counts,
        "inland_pct": round(100 * inland / len(cases)) if cases else 0,
    },
}
data["by_stream"] = {s: v for s, v in data["by_stream"].items() if v}

# ── ADR impact: do cases with an Additional Document Request take longer? ──────
_adr_with, _adr_without = [], []
for c in cases:
    if c.aor_to_ppr is None:
        continue
    has_adr = (c.raw or {}).get("Additional Document Request Date (if any)") not in (None, "", "N/A")
    (_adr_with if has_adr else _adr_without).append(c.aor_to_ppr)
if len(_adr_with) >= 10 and _adr_without:
    _wm, _wom = int(st.median(_adr_with)), int(st.median(_adr_without))
    if _wm > _wom:
        data["adr_impact"] = {
            "metric": "aor_to_ppr", "with_median": _wm, "without_median": _wom,
            "delta": _wm - _wom, "n_with": len(_adr_with), "n_without": len(_adr_without),
        }

out_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "data", "processingTimes.json")

# ── "What changed": remember the previous update's medians for month-over-month deltas.
# If this run produced identical medians (no new scrape), keep the older reference so
# re-runs don't wipe the comparison.
try:
    with open(out_path, encoding="utf-8") as f:
        _existing = json.load(f)
    _ex_meds = {k: v.get("median") for k, v in (_existing.get("all") or {}).items()}
    _new_meds = {k: v.get("median") for k, v in data["all"].items()}
    if _ex_meds == _new_meds and _existing.get("previous"):
        data["previous"] = _existing["previous"]
    elif _ex_meds:
        data["previous"] = {"generated": _existing.get("generated"), "medians": _ex_meds}
except (FileNotFoundError, json.JSONDecodeError):
    pass

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print(f"Wrote {out_path} | total_cases={data['total_cases']} streams={list(data['by_stream'])} "
      f"| adr_impact={'yes' if 'adr_impact' in data else 'no'} | previous={'yes' if 'previous' in data else 'no'}")
