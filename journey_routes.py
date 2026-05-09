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
    PRJourney, DocumentItem,
    JourneyUpdateRequest, JourneyResponse, DocumentUpdateRequest
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
        "subscription_tier": journey.subscription_tier or "free",
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "label": doc.label,
                "status": doc.status,
                "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
                "notes": doc.notes,
            }
            for doc in documents
        ],
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
    return {
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "label": doc.label,
                "status": doc.status,
                "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
                "notes": doc.notes,
            }
            for doc in documents
        ]
    }


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
    
    return {
        "id": doc.id,
        "document_type": doc.document_type,
        "label": doc.label,
        "status": doc.status,
        "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
        "notes": doc.notes,
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
    
    # Base documents required for all Express Entry programs
    base_documents = [
        {"type": "passport", "label": "Valid Passport"},
        {"type": "digital_photos", "label": "Digital Photos (35mm × 45mm)"},
        {"type": "language_test", "label": "Language Test Results (IELTS General Training / CELPIP / TEF)"},
        {"type": "eca", "label": "Educational Credential Assessment (ECA)"},
        {"type": "medical_exam", "label": "Immigration Medical Exam (IMM 1017B)"},
        {"type": "employment_letter_primary", "label": "Employment Reference Letter — Primary Employer"},
    ]
    
    # Program-specific documents
    if programs.get("fswp"):
        base_documents.append({"type": "proof_of_funds", "label": "Proof of Funds (Bank Letter)"})
    
    # Spouse documents
    if profile.get("marital_status") in ("married", "common_law") and profile.get("spouse_accompanying"):
        base_documents.extend([
            {"type": "marriage_certificate", "label": "Marriage / Common-Law Certificate"},
            {"type": "spouse_passport", "label": "Spouse — Valid Passport"},
            {"type": "spouse_language_test", "label": "Spouse — Language Test Results"},
        ])
    
    # Police certificates based on countries lived in
    countries = profile.get("countries_lived_in", [])
    for country_entry in countries:
        country = country_entry.get("country", "")
        months = country_entry.get("months", 0)
        if country and months >= 6:
            doc_type = f"police_cert_{country.lower().replace(' ', '_')}"
            base_documents.append({
                "type": doc_type,
                "label": f"Police Certificate — {country}"
            })
    
    # Check which documents already exist for this journey
    existing_types = set()
    existing_docs = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    for doc in existing_docs:
        existing_types.add(doc.document_type)
    
    # Create only new documents
    created = []
    for doc_spec in base_documents:
        if doc_spec["type"] not in existing_types:
            new_doc = DocumentItem(
                journey_id=journey.id,
                document_type=doc_spec["type"],
                label=doc_spec["label"],
                status="not_started"
            )
            db.add(new_doc)
            created.append(doc_spec["type"])
    
    db.commit()
    
    # Return the full updated list
    all_docs = db.query(DocumentItem).filter_by(journey_id=journey.id).all()
    return {
        "created": created,
        "total": len(all_docs),
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "label": doc.label,
                "status": doc.status,
                "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
                "notes": doc.notes,
            }
            for doc in all_docs
        ]
    }
