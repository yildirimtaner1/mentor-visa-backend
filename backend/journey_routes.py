"""
API routes for the PR Journey system.
Handles journey state CRUD, document tracking, and migration of existing evaluations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import datetime

import database
import db_models
from journey_models import (
    PRJourney, DocumentItem, ImmitrackerCase,
    JourneyUpdateRequest, JourneyResponse, DocumentUpdateRequest, DocumentCreateRequest
)

router = APIRouter(prefix="/api/v1/journey", tags=["journey"])


# ── Dependency: get current user (imported from main.py pattern) ──
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security
import os
import jwt
from jwt import PyJWKClient

security = HTTPBearer()
CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")

_jwks_client = None
def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None and CLERK_ISSUER_URL:
        jwks_url = f"{CLERK_ISSUER_URL}/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        if not CLERK_ISSUER_URL:
            claims = jwt.decode(token, options={"verify_signature": False})
            user_id = claims.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="No user ID in token")
            return user_id
        jwks_client = _get_jwks_client()
        if not jwks_client:
            raise HTTPException(status_code=500, detail="JWKS client not configured")
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token, signing_key.key, algorithms=["RS256"],
            issuer=CLERK_ISSUER_URL, options={"verify_signature": True}
        )
        user_id = data.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="No user ID in token")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")


def ensure_user_exists(user_id: str, db: Session):
    """Create a UserAccount row if one doesn't exist yet."""
    if not user_id or user_id == "anonymous":
        return
    existing = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if not existing:
        db.add(db_models.UserAccount(user_id=user_id))
        db.commit()


def _doc_to_dict(doc) -> dict:
    """Serialize a DocumentItem to the response shape (shared by all document endpoints)."""
    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "label": doc.label,
        "status": doc.status,
        "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
        "notes": doc.notes,
        "person_ref": doc.person_ref or "principal",
        "meta": doc.meta,
    }


def _journey_to_response(journey: PRJourney, documents: list) -> dict:
    """Convert a PRJourney ORM object to a response dict."""
    return {
        "id": journey.id,
        "user_id": journey.user_id,
        "current_phase": journey.current_phase or 1,
        "eligible_programs": journey.eligible_programs,
        "fswp_score": journey.fswp_score,
        "recommended_program": journey.recommended_program,
        "noc_code": journey.noc_code,
        "noc_title": journey.noc_title,
        "teer_category": journey.teer_category,
        "noc_cec_eligible": bool(journey.noc_cec_eligible) if journey.noc_cec_eligible is not None else None,
        "crs_score": journey.crs_score,
        "crs_calculated_at": journey.crs_calculated_at.isoformat() if journey.crs_calculated_at else None,
        "category_draw_eligible": journey.category_draw_eligible,
        "profile_data": journey.profile_data,
        "tracker_data": journey.tracker_data,
        "subscription_tier": journey.subscription_tier or "free",
        "documents": [_doc_to_dict(doc) for doc in documents],
        "created_at": journey.created_at.isoformat() if journey.created_at else None,
        "updated_at": journey.updated_at.isoformat() if journey.updated_at else None,
    }


# ── GET /api/v1/journey ──

@router.get("")
def get_journey(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get the user's full journey state. Creates one if it doesn't exist."""
    ensure_user_exists(user_id, db)
    
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    
    if not journey:
        # Auto-create a journey for new users
        journey = PRJourney(user_id=user_id, current_phase=1, subscription_tier="free")
        db.add(journey)
        db.commit()
        db.refresh(journey)
    
    # Also read the user's subscription_tier from UserAccount (source of truth for payments)
    user_account = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if user_account and user_account.subscription_tier != journey.subscription_tier:
        journey.subscription_tier = user_account.subscription_tier
        db.commit()
    
    documents = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    
    return _journey_to_response(journey, documents)


# ── PUT /api/v1/journey ──

@router.put("")
def update_journey(
    update: JourneyUpdateRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Partial update of the user's journey state. Only non-None fields are updated."""
    ensure_user_exists(user_id, db)
    
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    
    if not journey:
        journey = PRJourney(user_id=user_id, current_phase=1, subscription_tier="free")
        db.add(journey)
        db.commit()
        db.refresh(journey)
    
    # Apply only the fields that were explicitly set
    update_data = update.model_dump(exclude_none=True)
    
    for field, value in update_data.items():
        if field == "noc_cec_eligible":
            value = 1 if value else 0
        if field == "crs_score" and value is not None:
            # Only update calculated_at when the score actually changes
            if journey.crs_score != value:
                setattr(journey, "crs_calculated_at", datetime.datetime.utcnow())
        setattr(journey, field, value)
    
    db.commit()
    db.refresh(journey)
    
    documents = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    return _journey_to_response(journey, documents)


# ── POST /api/v1/journey/migrate ──

@router.post("/migrate")
def migrate_journey(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """One-time migration: scans existing evaluations and pre-populates journey data.
    
    - Extracts NOC code from the most recent noc_finder evaluation
    - Extracts CRS score from the most recent crs_calculator evaluation
    - Does not overwrite existing journey data (only fills in blanks)
    """
    ensure_user_exists(user_id, db)
    
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        journey = PRJourney(user_id=user_id, current_phase=1, subscription_tier="free")
        db.add(journey)
        db.commit()
        db.refresh(journey)
    
    migrated = {"noc_migrated": False, "crs_migrated": False}
    
    # Migrate NOC code from latest noc_finder evaluation
    if not journey.noc_code:
        latest_noc = (
            db.query(db_models.Evaluation)
            .filter_by(user_id=user_id, evaluation_type="noc_finder")
            .order_by(db_models.Evaluation.timestamp_utc.desc())
            .first()
        )
        if latest_noc and latest_noc.payload:
            payload = latest_noc.payload if isinstance(latest_noc.payload, dict) else {}
            
            # Try v2 schema (recommended_noc) first, then flattened
            noc_code = None
            noc_title = None
            if "recommended_noc" in payload:
                noc_code = payload["recommended_noc"].get("code")
                noc_title = payload["recommended_noc"].get("title")
            elif "noc_code" in payload:
                noc_code = payload["noc_code"]
                noc_title = payload.get("noc_title")
            
            if noc_code:
                journey.noc_code = noc_code
                journey.noc_title = noc_title
                teer = noc_code[1] if len(noc_code) >= 2 else None
                journey.teer_category = teer
                journey.noc_cec_eligible = 1 if teer in ['0', '1', '2', '3'] else 0
                migrated["noc_migrated"] = True
    
    # Migrate CRS score from latest crs_calculator evaluation
    if not journey.crs_score:
        latest_crs = (
            db.query(db_models.Evaluation)
            .filter_by(user_id=user_id, evaluation_type="crs_calculator")
            .order_by(db_models.Evaluation.timestamp_utc.desc())
            .first()
        )
        if latest_crs and latest_crs.payload:
            payload = latest_crs.payload if isinstance(latest_crs.payload, dict) else {}
            crs_score = payload.get("crs_score") or payload.get("total_score")
            if crs_score:
                journey.crs_score = int(crs_score)
                journey.crs_calculated_at = latest_crs.timestamp_utc
                migrated["crs_migrated"] = True
    
    # Sync subscription tier from UserAccount
    user_account = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    if user_account:
        journey.subscription_tier = user_account.subscription_tier or "free"
    
    db.commit()
    db.refresh(journey)
    
    documents = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    return {
        "journey": _journey_to_response(journey, documents),
        "migration": migrated
    }


# ── Document Item Endpoints ──

@router.get("/documents")
def get_documents(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get all document items for the user's journey."""
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        return {"documents": []}
    
    documents = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    return {"documents": [_doc_to_dict(doc) for doc in documents]}


@router.put("/documents/{doc_id}")
def update_document(
    doc_id: int,
    update: DocumentUpdateRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Update a document item's status, expiry, or notes."""
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="No journey found for this user.")
    
    doc = db.query(DocumentItem).filter_by(id=doc_id, journey_id=journey.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document item not found.")
    
    if update.status is not None:
        if update.status not in ("not_started", "in_progress", "obtained"):
            raise HTTPException(status_code=400, detail="Invalid status. Must be: not_started, in_progress, or obtained.")
        doc.status = update.status
    
    if update.expiry_date is not None:
        try:
            doc.expiry_date = datetime.datetime.fromisoformat(update.expiry_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601 (YYYY-MM-DD).")
    
    if update.notes is not None:
        doc.notes = update.notes

    db.commit()
    db.refresh(doc)
    return _doc_to_dict(doc)


@router.post("/documents")
def create_document(
    create: DocumentCreateRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Create a document item — e.g. a per-country police certificate or a per-dependent doc."""
    ensure_user_exists(user_id, db)
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="No journey found for this user.")

    status = create.status or "not_started"
    if status not in ("not_started", "in_progress", "obtained"):
        raise HTTPException(status_code=400, detail="Invalid status.")

    expiry = None
    if create.expiry_date:
        try:
            expiry = datetime.datetime.fromisoformat(create.expiry_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601 (YYYY-MM-DD).")

    doc = DocumentItem(
        journey_id=journey.id,
        document_type=create.document_type,
        label=create.label,
        person_ref=create.person_ref or "principal",
        meta=create.meta,
        status=status,
        expiry_date=expiry,
        notes=create.notes,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_to_dict(doc)


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Delete a document item owned by the current user's journey."""
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="No journey found for this user.")
    doc = db.query(DocumentItem).filter_by(id=doc_id, journey_id=journey.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document item not found.")
    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}


# ── Processing-time predictions (Optimize tier) ────────────────────────────────
# Cohort-based estimates from community case data (immitracker_cases). For each milestone
# transition we use the MOST SPECIFIC cohort that has enough samples, falling back to broader
# cohorts so we always return a defensible estimate with its sample size.
# Each prediction is measured from the milestone that immediately precedes it (a conditional
# / interval model): early stages are anchored on AOR, the back half chains from the previous
# real milestone. This tightens estimates and lets the tracker re-anchor on the user's own
# actual dates as they log them. Note: Immitracker records P2 (inland portal 2) and PPR
# (outland passport request) as ONE date, so decision_to_ppr and p1_to_p2 share that end date.
_PROC_TRANSITIONS = [
    ("aor_to_bil",       "AOR to Biometrics"),
    ("aor_to_meds",      "AOR to Medical passed"),
    ("aor_to_decision",  "AOR to Final Decision"),
    ("decision_to_p1",   "Final Decision to P1"),
    ("decision_to_ppr",  "Final Decision to PPR"),
    ("p1_to_p2",         "P1 to P2"),
    ("p2_to_ecopr",      "P2 to eCOPR"),
]
_PROC_MIN_N = 15


def _proc_parse_dt(s):
    if s in (None, "", "N/A"):
        return None
    s = " ".join(str(s).split())
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def _proc_interval(a, b, lo=-5, hi=800):
    """b - a in days, kept only if within a sane range (drops typos/reversed dates)."""
    if a and b:
        n = (b - a).days
        if lo < n < hi:
            return n
    return None


def _case_transitions(c) -> dict:
    """All prediction-interval values for one case. AOR-anchored stages use the stored
    day-delta columns; the back-half intervals are computed on the fly from the raw source
    dates (Decision / Portal 1 / Portal 2-PPR / eCoPR)."""
    raw = c.raw or {}
    dec = _proc_parse_dt(raw.get("Decision Made"))
    p1 = _proc_parse_dt(raw.get("Portal 1 Email (Inland)"))
    p2 = _proc_parse_dt(raw.get("Portal 2 Email / PPR Date"))  # inland P2 == outland PPR date
    ec = _proc_parse_dt(raw.get("eCoPR Date (Inland Landing)"))
    return {
        "aor_to_bil": c.aor_to_bil,
        "aor_to_meds": c.aor_to_meds,
        "aor_to_decision": c.aor_to_decision,
        "decision_to_p1": _proc_interval(dec, p1),
        "decision_to_ppr": _proc_interval(dec, p2),
        "p1_to_p2": _proc_interval(p1, p2),
        "p2_to_ecopr": _proc_interval(p2, ec),
    }


def _percentile(xs: list, p: float):
    xs = sorted(xs)
    if not xs:
        return None
    i = min(len(xs) - 1, int(round((p / 100) * (len(xs) - 1))))
    return xs[i]


def _cohort_stats(cases: list, stream, country, category, vo):
    """Processing-time percentiles for a user's milestone sequence.

    All transitions are computed from ONE shared cohort so the milestones stay mutually
    consistent. We pick the MOST SPECIFIC cohort level at which every transition relevant to
    this applicant clears _PROC_MIN_N. Transitions are INTERVALS (each measured from its own
    anchor milestone), so they are independent durations — no cross-transition monotonic
    clamp; only the p25<=median<=p75<=p90 ordering within a transition is enforced."""
    txv = {c: _case_transitions(c) for c in cases}  # precompute once per request
    levels = [
        ("stream + country + category + office",
         lambda c: c.stream == stream and c.country_of_residence == country and c.ee_draw_category == category and (vo is None or c.primary_vo == vo)),
        ("stream + country + category",
         lambda c: c.stream == stream and c.country_of_residence == country and c.ee_draw_category == category),
        ("stream + category", lambda c: c.stream == stream and c.ee_draw_category == category),
        ("stream + country", lambda c: c.stream == stream and c.country_of_residence == country),
        ("stream", lambda c: c.stream == stream),
        ("all applicants", lambda c: True),
    ]
    if not category:
        levels = [lv for lv in levels if "category" not in lv[0]]
    if not country:
        levels = [lv for lv in levels if "country" not in lv[0]]
    if not vo:
        levels = [lv for lv in levels if "office" not in lv[0]]

    def count_at(pred, key):
        return sum(1 for c in cases if pred(c) and txv[c][key] is not None)

    # Which transitions are relevant for this applicant? A transition is "relevant" only if the
    # applicant's own stream populates it enough to be meaningful — this also drops inland-only
    # stages (e.g. aor_to_p1) for outland streams that never report them.
    stream_pred = (lambda c: c.stream == stream)
    relevant = [k for k, _ in _PROC_TRANSITIONS if count_at(stream_pred, k) >= _PROC_MIN_N]
    if not relevant:  # stream too sparse — fall back to the whole dataset for guidance
        relevant = [k for k, _ in _PROC_TRANSITIONS if count_at(lambda c: True, k) >= _PROC_MIN_N]

    # ONE cohort level for the entire sequence: most specific where ALL relevant transitions clear MIN.
    chosen_label, chosen_pred = "all applicants", (lambda c: True)
    for lvl_label, pred in levels:
        if relevant and all(count_at(pred, k) >= _PROC_MIN_N for k in relevant):
            chosen_label, chosen_pred = lvl_label, pred
            break

    out = {}
    for key, label in _PROC_TRANSITIONS:
        if key not in relevant:
            out[key] = None
            continue
        vals = [txv[c][key] for c in cases if chosen_pred(c) and txv[c][key] is not None]
        out[key] = ({
            "label": label, "n": len(vals), "cohort": chosen_label,
            "p25": _percentile(vals, 25), "median": _percentile(vals, 50),
            "p75": _percentile(vals, 75), "p90": _percentile(vals, 90),
        } if vals else None)

    # Intervals are independent durations — only enforce p25 <= median <= p75 <= p90 within each.
    for key, _ in _PROC_TRANSITIONS:
        s = out.get(key)
        if not s:
            continue
        for lo, hi in (("p25", "median"), ("median", "p75"), ("p75", "p90")):
            if s[lo] is not None and s[hi] is not None and s[hi] < s[lo]:
                s[hi] = s[lo]
    return out


@router.get("/tracker-options")
def tracker_options(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """Distinct cohort-input options present in our case data (frequency-sorted), so the tracker's
    dropdowns only offer values that actually match real cases. Available to any signed-in user."""
    cases = db.query(ImmitrackerCase).all()

    def distinct(attr):
        counts = {}
        for c in cases:
            v = getattr(c, attr)
            if v:
                counts[v] = counts.get(v, 0) + 1
        return [k for k, _ in sorted(counts.items(), key=lambda kv: -kv[1])]

    return {
        "streams": distinct("stream"),
        "countries": distinct("country_of_residence"),
        "categories": distinct("ee_draw_category"),
        "visa_offices": distinct("primary_vo"),
    }


@router.get("/processing-stats")
def processing_stats(
    stream: str = None,
    country: str = None,
    category: str = None,
    vo: str = None,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db),
):
    """Cohort processing-time estimates for the Application Tracker. Optimize tier only."""
    ua = db.query(db_models.UserAccount).filter_by(user_id=user_id).first()
    tier = (ua.subscription_tier if ua else "free") or "free"
    if tier not in ("starter", "complete"):
        raise HTTPException(status_code=403, detail="Upgrade to Optimize to unlock processing-time predictions.")

    if not stream:
        raise HTTPException(status_code=400, detail="stream is required.")

    cases = db.query(ImmitrackerCase).all()
    stats = _cohort_stats(cases, stream, country, category, vo)
    return {
        "inputs": {"stream": stream, "country": country, "category": category, "vo": vo},
        "total_cases": len(cases),
        "transitions": stats,
    }


@router.post("/documents/generate")
def generate_document_checklist(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Generate a personalized document checklist based on the user's journey profile.
    
    Reads the user's eligible programs, countries lived in, and marital status
    to create a tailored list of required documents. Idempotent — won't duplicate
    documents that already exist.
    """
    ensure_user_exists(user_id, db)
    
    journey = db.query(PRJourney).filter_by(user_id=user_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Complete the eligibility assessment first.")
    
    profile = journey.profile_data or {}
    programs = journey.eligible_programs or {}
    
    # ── Build required-document specs, each scoped to a person ──
    # spec shape: {"type", "label", "person_ref", "meta"?}
    specs = [
        {"type": "passport", "label": "Valid Passport", "person_ref": "principal"},
        {"type": "digital_photos", "label": "Digital Photos (35mm × 45mm)", "person_ref": "principal"},
        {"type": "language_test", "label": "Language Test Results (IELTS / CELPIP / TEF)", "person_ref": "principal"},
        {"type": "eca", "label": "Educational Credential Assessment (ECA)", "person_ref": "principal"},
        {"type": "medical_exam", "label": "Immigration Medical Exam", "person_ref": "principal"},
        {"type": "biometrics", "label": "Biometrics", "person_ref": "principal"},
        {"type": "employment_letter_primary", "label": "Employment Reference Letter — Primary Employer", "person_ref": "principal"},
    ]
    if programs.get("fswp"):
        specs.append({"type": "proof_of_funds", "label": "Proof of Funds (Bank Letter)", "person_ref": "principal"})

    # Principal police certificates — one per country lived in 6+ months (each its own row + country meta).
    for country_entry in profile.get("countries_lived_in", []):
        country = (country_entry.get("country") or "").strip()
        if country and country_entry.get("months", 0) >= 6:
            specs.append({
                "type": "police_cert",
                "label": f"Police Certificate — {country}",
                "person_ref": "principal",
                "meta": {"country": country},
            })

    # Per-dependent documents (from the free-tier dependents list in tracker_data).
    for dep in (journey.tracker_data or {}).get("dependents", []) or []:
        pid = dep.get("id")
        if not pid:
            continue
        nm = (dep.get("name") or dep.get("relationship") or "Dependent").strip()
        specs += [
            {"type": "passport", "label": f"{nm} — Valid Passport", "person_ref": pid},
            {"type": "medical_exam", "label": f"{nm} — Immigration Medical Exam", "person_ref": pid},
            {"type": "biometrics", "label": f"{nm} — Biometrics", "person_ref": pid},
        ]
        if dep.get("relationship") == "spouse":
            specs.append({"type": "marriage_certificate", "label": "Marriage / Common-Law Certificate", "person_ref": "principal"})

    # Idempotent: dedupe on (document_type, person_ref, country) against existing rows + within this batch.
    def _key(t, pref, meta):
        return (t, pref or "principal", (meta or {}).get("country"))

    existing = {
        _key(doc.document_type, doc.person_ref, doc.meta)
        for doc in db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    }
    created = []
    for spec in specs:
        pref = spec.get("person_ref") or "principal"
        k = _key(spec["type"], pref, spec.get("meta"))
        if k in existing:
            continue
        existing.add(k)
        db.add(DocumentItem(
            journey_id=journey.id,
            document_type=spec["type"],
            label=spec.get("label"),
            person_ref=pref,
            meta=spec.get("meta"),
            status="not_started",
        ))
        created.append(f"{spec['type']}:{pref}")

    db.commit()
    
    # Return the full updated list
    all_docs = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    return {
        "created": created,
        "total": len(all_docs),
        "documents": [_doc_to_dict(doc) for doc in all_docs
        ]
    }
