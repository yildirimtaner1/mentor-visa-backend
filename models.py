from pydantic import BaseModel, Field
from typing import List, Literal


# ── Auditor Schema (v2 — Skeptical Immigration Officer) ──

class EvidenceMapping(BaseModel):
    """Maps an official NOC duty to evidence found in the applicant's employment letter."""
    noc_duty: str = Field(description="The exact wording of the main duty from the official NOC 2021 database")
    letter_evidence: str = Field(description="The exact quote from the applicant's employment letter that maps to this NOC duty. If no match, write 'NOT FOUND IN LETTER'")
    match_strength: Literal["strong", "partial", "weak", "missing"] = Field(description="How strongly the letter evidence aligns with the NOC duty: strong (clear semantic match), partial (related but vague), weak (tangential), missing (not found)")
    overlap_description: str = Field(description="A brief 1-sentence explanation of why these duties align (or why they don't)")


class AlternativeNOC(BaseModel):
    noc_code: str = Field(description="The 5-digit NOC 2021 code")
    noc_title: str = Field(description="The official NOC 2021 title for the alternative code")
    match_score: int = Field(description="Match percentage (0-100) for this alternative NOC. Score as if doing a full dedicated evaluation against this NOC alone.")
    explanation: str = Field(description="Brief explanation of why this NOC is a secondary option")


class NOCAnalysis(BaseModel):
    applicable: bool = Field(description="Whether NOC comparison is applicable for this document type")
    detected_code: str = Field(description="The 5-digit NOC 2021 code that best matches the duties (e.g. '21232')")
    detected_title: str = Field(description="The official NOC 2021 title for the detected code")
    match_score: int = Field(description="Overall duty coverage percentage (0-100). Count how many of the NOC's main duties are demonstrated in the letter.")
    confidence: int = Field(description="How confident are you in this NOC selection (0-100). A low match_score with high confidence means you're sure this IS the right NOC but the letter is weak.")
    alternative_nocs: List[AlternativeNOC] = Field(description="Secondary NOC codes that also match well (>= 50%). If none, pass an empty list.")
    notes: str = Field(description="Explanation of why this NOC was selected, and what key duties are missing or weak")
    lead_statement_official: str = Field(description="The exact lead statement from the official NOC 2021 database for the detected code")
    lead_statement_applicant: str = Field(description="A quote from the applicant's letter showing they perform the core action described in the lead statement. If not found, write 'NOT FOUND'")
    lead_statement_overlap: str = Field(description="A brief 1-sentence description explaining how the applicant's role aligns (or doesn't) with the lead statement")
    duties_match: List[EvidenceMapping] = Field(description="Side-by-side comparison of ALL official NOC main duties vs applicant's letter evidence. Include EVERY main duty from the NOC, even if NOT matched.")
    missing_critical_duties: List[str] = Field(description="List of main NOC duties that are NOT demonstrated in the letter at all. These are the duties that weaken the case.")
    duty_coverage_percentage: int = Field(description="Percentage of the NOC's main duties that are demonstrated (strong or partial) in the letter. This drives the ACCEPT/PFL_RISK/REFUSE decision.")
    location_of_experience: Literal["canada", "outside_canada", "unknown"] = Field(description="Where the employment experience was gained based on addresses, postal codes, province references.")


class MandatoryRequirements(BaseModel):
    """Boolean verification checklist of all IRCC required elements for CEC employment letters."""
    company_letterhead: bool = Field(description="True if printed on official company letterhead or stationery")
    applicant_name: bool = Field(description="True if applicant's full name is clearly stated")
    contact_information: bool = Field(description="True if company contact information (address, phone, email) is present")
    job_title: bool = Field(description="True if job title(s) are stated")
    dates_of_employment: bool = Field(description="True if specific start and end dates or ongoing status are stated")
    hours_worked: bool = Field(description="True if hours worked per week are stated")
    salary_compensation: bool = Field(description="True if salary/compensation is stated in any format")
    signatory: bool = Field(description="True if signed by a supervisor or HR officer")


class KeyRisk(BaseModel):
    """A specific risk that could jeopardize the application."""
    issue: str = Field(description="The specific risk or issue found")
    severity: Literal["low", "medium", "high"] = Field(description="Severity: low (unlikely to cause issues), medium (may delay processing or trigger PFL), high (likely refusal)")
    impact: str = Field(description="What an IRCC officer would conclude from this issue")
    recommendation: str = Field(description="Specific, actionable fix — not generic advice")


class RiskAssessment(BaseModel):
    overall_risk: Literal["low", "moderate", "high"] = Field(description="Overall risk level for this application")
    pfl_likelihood: Literal["low", "medium", "high"] = Field(description="Likelihood that IRCC would issue a Procedural Fairness Letter before making a final decision")
    key_risks: List[KeyRisk] = Field(description="All identified risks, ordered by severity (highest first)")


class Compliance(BaseModel):
    score: int = Field(description="Compliance score (0-100) based on how many mandatory IRCC elements are present and properly formatted")
    missing_elements: List[str] = Field(description="IRCC-required elements that are completely absent from the document")
    warnings: List[str] = Field(description="Elements that are present but may be insufficient, ambiguous, or improperly formatted")


class AnalysisResponse(BaseModel):
    """The complete auditor output for an employment letter analysis."""
    # Identity
    document_type: str = Field(description="Identified document type, e.g. 'Employment Letter - Canada', 'T4 Slip', 'Resume (Rejected)', etc.")
    role_name: str = Field(default="Unknown Role", description="The specific job title found in the document. If none found, write 'Unknown Role'")
    company_name: str = Field(default="Unknown Company", description="The company issuing the document. If none found, write 'Unknown Company'")

    # Core Decision
    decision: Literal["ACCEPT", "PFL_RISK", "REFUSE"] = Field(description="The officer's decision: ACCEPT (>=75% duty match, clear evidence), PFL_RISK (50-75% match or ambiguity), REFUSE (<50% match or critical gaps)")
    confidence_score: int = Field(description="Overall confidence in the decision (0-100)")

    # Officer's Assessment 
    officer_narrative: str = Field(description="A 3-5 sentence assessment written in formal IRCC officer tone. Evidence-based, slightly skeptical. Must reference specific duties and gaps.")

    # NOC Analysis
    noc_analysis: NOCAnalysis = Field(description="Full NOC matching analysis with duty-by-duty evidence mapping")

    # Compliance
    compliance: Compliance = Field(description="IRCC formatting and completeness compliance assessment")
    mandatory_requirements: MandatoryRequirements = Field(description="Boolean verification checklist of all 8 IRCC required elements")

    # Risk
    risk_assessment: RiskAssessment = Field(description="Risk analysis including PFL likelihood and prioritized risk list")

    # Actionable Outputs
    refusal_reasons: List[str] = Field(description="If decision is PFL_RISK or REFUSE, list the specific grounds. Empty list if ACCEPT.")
    action_plan: List[str] = Field(description="Priority-ordered, specific, actionable fixes the applicant should make. Most critical first.")
    suggested_wording: List[str] = Field(description="If applicable, suggested improved sample sentences the applicant can give to their employer to strengthen the letter's alignment with the NOC.")


# ── NOC Finder Schema v2 ──
# Designed for fast, reliable NOC suggestion — deep duty mapping is the auditor's job.

class RecommendedNOC(BaseModel):
    code: str = Field(description="The 5-digit NOC 2021 code (e.g. '21232')")
    title: str = Field(description="The official NOC 2021 title (e.g. 'Software developers and programmers')")
    confidence: int = Field(description="Confidence score 0-100 for this match")

class NOCFinderAlternative(BaseModel):
    code: str = Field(description="5-digit NOC 2021 code")
    title: str = Field(description="Official NOC 2021 title")
    confidence: int = Field(description="Confidence score 0-100, honestly scored as if doing a full evaluation against this NOC")

class NOCFinderResponseSchema(BaseModel):
    # Input validation
    document_valid: bool = Field(description="True if the input provides a meaningful job description or valid document")
    rejection_reason: str = Field(description="Clear explanation of why input is invalid. Empty string if valid.")

    # Extracted metadata
    role_name: str = Field(default="Unknown Role", description="Job title/role name found in the input (e.g. 'Software Engineer')")
    company_name: str = Field(default="Unknown Company", description="Company name found in the input (e.g. 'Google'). 'Unknown Company' if not found or typed manually.")

    # Result classification
    result_type: Literal["STRONG_MATCH", "MODERATE_MATCH", "NO_MATCH"] = Field(
        description="STRONG_MATCH if >=75% duty alignment, MODERATE_MATCH if 60-74%, NO_MATCH if <60%"
    )

    # Primary recommendation
    recommended_noc: RecommendedNOC = Field(description="The best-matching NOC code. Populate even for NO_MATCH (best available candidate).")

    # Explanation
    confidence_level: Literal["high", "medium", "low"] = Field(description="Overall confidence in the recommendation")
    why_this_noc: str = Field(description="1-2 sentence explanation of why this NOC was selected")
    key_matches: List[str] = Field(description="Up to 5 strongest aligned responsibilities between input and NOC duties")
    key_gaps: List[str] = Field(description="Up to 3 missing or weak areas where the input doesn't cover the NOC's main duties")

    # Alternatives
    alternatives: List[NOCFinderAlternative] = Field(description="Up to 2 alternative NOC codes with honest confidence scores")

    # Meta
    input_reliability: Literal["high", "medium", "low"] = Field(
        description="'high' for employment letters, 'medium' for resumes/job descriptions, 'low' for sparse manual input"
    )
    location_of_experience: Literal["canada", "outside_canada", "unknown"] = Field(description="Where the employment experience was gained")

    # CTA
    important_note: str = Field(
        default="This is a best-match estimate. Your application may still be refused if your employment letter does not clearly demonstrate these duties.",
        description="Disclaimer note about the suggestion"
    )
    next_step: str = Field(
        default="Run a full Employment Letter Audit to confirm eligibility and reduce refusal risk.",
        description="CTA directing user to the paid auditor"
    )
