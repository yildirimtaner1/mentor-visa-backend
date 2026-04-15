from pydantic import BaseModel, Field
from typing import List, Optional, Literal


# ── Duty Analysis (Step 3 — per-duty AI evaluation) ──

class DutyAnalysisRequest(BaseModel):
    """Request to analyze a single user-written duty against a target NOC."""
    duty_text: str = Field(description="The user's written duty statement to analyze")
    noc_code: str = Field(description="The 5-digit NOC 2021 code to evaluate against")


class DutyAnalysisResponse(BaseModel):
    """AI response evaluating how well a single duty aligns with the target NOC."""
    alignment: Literal["strong", "partial", "weak", "none"] = Field(
        description="How well this duty aligns with the target NOC: strong (clear match), partial (related but vague), weak (tangential), none (no alignment)"
    )
    matched_noc_duty: str = Field(
        description="The specific official NOC duty this most closely aligns with. Empty string if no alignment."
    )
    match_confidence: int = Field(
        description="Confidence score 0-100 for the alignment with the matched NOC duty"
    )
    feedback: str = Field(
        description="1-2 sentence assessment of the duty's IRCC compliance readiness. Be specific and constructive."
    )
    coaching_questions: List[str] = Field(
        description="Up to 3 specific questions to help the user make this duty stronger. Only include if the duty is weak or partial. Empty list if strong."
    )
    ircc_ready: bool = Field(
        description="True if this duty is specific enough and well-aligned enough to include in an IRCC employment letter as-is"
    )


# ── NOC Duties Lookup ──

class NOCDutyItem(BaseModel):
    """A single official NOC duty."""
    duty_text: str
    index: int  # Position in the duties list


class NOCDutiesResponse(BaseModel):
    """Official duties for a given NOC code."""
    noc_code: str
    noc_title: str
    lead_statement: str
    duties: List[NOCDutyItem]


# ── Letter Generation (Step 4 — template assembly) ──

class EmploymentDetails(BaseModel):
    """All the basic employment info collected in Step 1."""
    applicant_name: str
    company_name: str
    company_address: str
    job_title: str
    start_date: str  # ISO format or human-readable
    end_date: str     # ISO format, "ongoing", or "present"
    hours_per_week: str
    employment_type: str  # "Full-time" or "Part-time"
    salary_amount: str
    salary_currency: str  # "CAD", "USD", etc.
    salary_period: str    # "hourly", "weekly", "biweekly", "monthly", "annually"
    work_city: str
    work_country: str
    supervisor_name: str
    supervisor_title: str
    supervisor_contact: str  # email or phone


class ApprovedDuty(BaseModel):
    """A duty that the user has written and approved through the workshop."""
    text: str
    alignment: str  # Alignment status from the duty analysis
    matched_noc_duty: str  # Which official duty it maps to


class LetterGenerationRequest(BaseModel):
    """Complete data for generating the final employment letter."""
    employment_details: EmploymentDetails
    noc_code: str
    noc_title: str
    approved_duties: List[ApprovedDuty]


class LetterSections(BaseModel):
    """The structured letter broken into editable sections."""
    header_placeholder: str = "[COMPANY LETTERHEAD]"
    date: str
    addressee: str = "To Whom It May Concern,"
    intro_paragraph: str
    employment_details_paragraph: str
    duties_section: str
    closing_paragraph: str
    supervisor_block: str
    signature_placeholder: str = "[SIGNATURE]"


class LetterGenerationResponse(BaseModel):
    """Response containing the structured letter."""
    status: str  # "APPROVED" or "INCOMPLETE"
    noc_code: str
    noc_title: str
    letter_sections: LetterSections
    letter_full_text: str  # The complete assembled letter as one string
    warnings: List[str]  # Any issues (e.g., "Only 3 duties provided, 4 recommended")
