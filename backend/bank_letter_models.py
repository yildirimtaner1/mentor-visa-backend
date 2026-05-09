"""
Bank Letter Auditor — Pydantic schemas for the AI response.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


class BankLetterElement(BaseModel):
    """Individual element checked in the bank letter audit."""
    element_name: str = Field(description="Name of the required element")
    element_number: int = Field(description="Element number (1-7)")
    present: bool = Field(description="Whether this element was found in the document")
    extracted_value: Optional[str] = Field(default=None, description="The value extracted from the document for this element, if found")
    fix_instruction: Optional[str] = Field(default=None, description="Specific, actionable instruction for the user to fix this element if it is missing")


class BankLetterAuditResponse(BaseModel):
    """Full response from the Bank Letter Auditor AI."""
    elements: List[BankLetterElement] = Field(description="List of 7 required elements with their audit results")
    total_elements_found: int = Field(description="Number of elements found (out of 7)")
    total_balance_detected: Optional[float] = Field(default=None, description="Total balance amount detected in the letter")
    currency: Optional[str] = Field(default=None, description="Currency of the detected balance (e.g., 'CAD', 'USD', 'INR')")
    bank_name: Optional[str] = Field(default=None, description="Name of the bank that issued the letter")
    letter_date: Optional[str] = Field(default=None, description="Date shown on the letter")
    account_holder_name: Optional[str] = Field(default=None, description="Account holder name as shown in the letter")
    overall_compliance: str = Field(description="One of: 'compliant' (7/7), 'partial' (4-6/7), 'non_compliant' (0-3/7)")
    summary: str = Field(description="A brief 1-2 sentence summary of the audit results")
    suggested_actions: List[str] = Field(description="List of specific actions the user should take to fix any issues")


# Pydantic v2 schema export for Gemini structured output
BankLetterAuditSchema = BankLetterAuditResponse.model_json_schema()
