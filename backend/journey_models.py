"""
PR Journey data models for the Canada PR Platform.
These models support the end-to-end journey tracking system
that connects all tools (Eligibility, Documents, CRS, etc.).
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, ForeignKey, Float
from sqlalchemy.sql import func
from database import Base
from pydantic import BaseModel, Field
from typing import Optional, List
import datetime


# ── SQLAlchemy ORM Models ──

class PRJourney(Base):
    """Master journey record per user. Tracks overall progress and key data
    that flows between tools (NOC code, CRS score, eligible programs, etc.)."""
    __tablename__ = "pr_journeys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), unique=True, index=True, nullable=False)
    
    # Journey progress
    current_phase = Column(Integer, default=1)  # 1-7 matching PRD phases
    
    # Eligibility results
    eligible_programs = Column(JSON, nullable=True)  # {"fswp": true, "cec": true, "fstp": false}
    fswp_score = Column(Integer, nullable=True)       # 67-point grid score
    recommended_program = Column(String, nullable=True)  # "CEC", "FSWP", "FSTP"
    
    # NOC (populated from NOC Finder)
    noc_code = Column(String, nullable=True)
    noc_title = Column(String, nullable=True)
    teer_category = Column(String, nullable=True)
    noc_cec_eligible = Column(Integer, nullable=True)  # 0 or 1
    
    # CRS
    crs_score = Column(Integer, nullable=True)
    crs_calculated_at = Column(DateTime, nullable=True)
    category_draw_eligible = Column(JSON, nullable=True)  # ["STEM", "Healthcare"]
    
    # Profile data (shared across tools)
    profile_data = Column(JSON, nullable=True)  # Full profile: age, education, language, experience, etc.
    
    # Subscription
    subscription_tier = Column(String, default="free")  # "free", "starter", "complete"
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class DocumentItem(Base):
    """Individual document in a user's PR application checklist.
    Status is tracked from 'not_started' through to 'obtained'."""
    __tablename__ = "document_items"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("pr_journeys.id"), index=True, nullable=False)
    
    document_type = Column(String, nullable=False)  # "ielts", "eca", "police_cert_india", etc.
    label = Column(String, nullable=True)            # Human-readable label
    status = Column(String, default="not_started")   # "not_started", "in_progress", "obtained"
    expiry_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class DrawResult(Base):
    """Cached Express Entry draw results from IRCC.
    Updated daily via automated scraper (Phase 2) or manual entry."""
    __tablename__ = "draw_results"

    id = Column(Integer, primary_key=True, index=True)
    draw_number = Column(Integer, unique=True, index=True, nullable=False)
    draw_date = Column(DateTime, nullable=False)
    draw_type = Column(String, nullable=False)       # "general", "pnp", "cec", "category_stem", etc.
    crs_cutoff = Column(Integer, nullable=False)
    invitations_issued = Column(Integer, nullable=False)
    tie_breaking_rule = Column(DateTime, nullable=True)
    
    fetched_at = Column(DateTime, default=func.now())


class NOCCategoryMapping(Base):
    """Maps NOC codes to category-based draw categories.
    Used to determine if a user qualifies for targeted draws
    (Healthcare, STEM, Trades, French, etc.)."""
    __tablename__ = "noc_category_mappings"

    noc_code = Column(String, primary_key=True, index=True)
    categories = Column(JSON, nullable=False)  # ["STEM", "Healthcare"]
    
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# ── Pydantic Request/Response Schemas ──

class JourneyProfileData(BaseModel):
    """User profile data shared across all journey tools."""
    age: Optional[int] = None
    country_of_citizenship: Optional[str] = None
    country_of_residence: Optional[str] = None
    education_level: Optional[str] = None
    education_in_canada: Optional[bool] = None
    has_eca: Optional[bool] = None
    
    # Language
    primary_language_test: Optional[str] = None  # "ielts_general", "celpip", "tef", "tcf"
    primary_speaking: Optional[float] = None
    primary_listening: Optional[float] = None
    primary_reading: Optional[float] = None
    primary_writing: Optional[float] = None
    secondary_language_test: Optional[str] = None
    secondary_speaking: Optional[float] = None
    secondary_listening: Optional[float] = None
    secondary_reading: Optional[float] = None
    secondary_writing: Optional[float] = None
    
    # Work experience
    total_skilled_experience_years: Optional[int] = None
    canadian_experience_years: Optional[int] = None
    primary_occupation: Optional[str] = None
    
    # Additional factors
    has_job_offer: Optional[bool] = None
    has_provincial_nomination: Optional[bool] = None
    marital_status: Optional[str] = None  # "single", "married", "common_law"
    spouse_accompanying: Optional[bool] = None
    
    # Spouse details (if applicable)
    spouse_education_level: Optional[str] = None
    spouse_language_test: Optional[str] = None
    spouse_speaking: Optional[float] = None
    spouse_listening: Optional[float] = None
    spouse_reading: Optional[float] = None
    spouse_writing: Optional[float] = None
    spouse_canadian_experience_years: Optional[int] = None
    
    # Countries lived in (for police certificate requirements)
    countries_lived_in: Optional[List[dict]] = None  # [{"country": "India", "months": 24}]


class JourneyUpdateRequest(BaseModel):
    """Partial update request for the journey state.
    Only non-None fields will be updated."""
    current_phase: Optional[int] = None
    eligible_programs: Optional[dict] = None
    fswp_score: Optional[int] = None
    recommended_program: Optional[str] = None
    noc_code: Optional[str] = None
    noc_title: Optional[str] = None
    teer_category: Optional[str] = None
    noc_cec_eligible: Optional[bool] = None
    crs_score: Optional[int] = None
    category_draw_eligible: Optional[List[str]] = None
    profile_data: Optional[dict] = None
    subscription_tier: Optional[str] = None


class JourneyResponse(BaseModel):
    """Full journey state returned to the frontend."""
    id: int
    user_id: str
    current_phase: int
    eligible_programs: Optional[dict] = None
    fswp_score: Optional[int] = None
    recommended_program: Optional[str] = None
    noc_code: Optional[str] = None
    noc_title: Optional[str] = None
    teer_category: Optional[str] = None
    noc_cec_eligible: Optional[bool] = None
    crs_score: Optional[int] = None
    crs_calculated_at: Optional[str] = None
    category_draw_eligible: Optional[List[str]] = None
    profile_data: Optional[dict] = None
    subscription_tier: str = "free"
    documents: List[dict] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentUpdateRequest(BaseModel):
    """Update a single document item's status or expiry."""
    status: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
