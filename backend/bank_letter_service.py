"""
Bank Letter Auditor — AI analysis service.

Checks uploaded bank letters against IRCC's 7 required elements for proof of funds.
Uses the same Gemini model and infrastructure as the Employment Letter Auditor.
"""

import json
from typing import Optional
import ai_service  # Reuses existing AI client, PDF/image processing


# ── IRCC Minimum Funds (2026) ──
IRCC_MINIMUM_FUNDS_2026 = {
    1: 14690,
    2: 18288,
    3: 22483,
    4: 27297,
    5: 30690,
    6: 34606,
    7: 38522,
}


def build_bank_letter_audit_prompt() -> str:
    """Build the system prompt for the Bank Letter Auditor."""
    return """You are an expert Canadian immigration document auditor specializing in proof of funds letters for Express Entry applications.

Your task is to analyze a bank letter and check whether it contains the 7 elements required by IRCC (Immigration, Refugees and Citizenship Canada) for proof of settlement funds.

## The 7 Required Elements

1. **Bank letterhead & contact info** — The letter must be on official bank letterhead with the bank's address, phone number, and/or email address. A printout from online banking or a bank statement is NOT sufficient.

2. **Account holder name** — The full legal name of the account holder must be clearly stated. It must match the applicant's passport name exactly.

3. **Account numbers** — All account numbers included in the proof of funds must be listed.

4. **Date accounts were opened** — The opening date for each account must be stated. This shows the accounts are not newly created just for the application.

5. **Current balance** — The current balance as of a specific recent date. The date should ideally be within 30 days of the application submission.

6. **Average balance over the last 6 months** — This is the MOST COMMONLY MISSING element. IRCC wants to see that the applicant has had sustained funds, not just a recent deposit. The letter must explicitly state the average balance over the preceding 6 months.

7. **Outstanding debts** — Any credit card balances, loans, lines of credit, or other debts associated with the account holder must be disclosed.

## Instructions

1. Carefully read the uploaded bank letter.
2. For each of the 7 elements, determine if it is PRESENT or MISSING.
3. If present, extract the specific value (e.g., the balance amount, the account holder name, etc.).
4. If missing, provide a specific, actionable fix instruction that the user can give to their bank (e.g., "Ask your bank to add the opening date for each account").
5. Detect the total balance and currency.
6. Determine overall compliance: "compliant" (7/7 found), "partial" (4-6/7 found), "non_compliant" (0-3/7 found).
7. Provide a clear summary and list of suggested actions.

Be thorough but honest. If you cannot determine whether an element is present due to image quality or formatting, mark it as missing with a note.
"""


def audit_bank_letter(doc_bytes: bytes, file_extension: str, is_image: bool) -> dict:
    """
    Analyze a bank letter document using the AI model.
    
    Returns a structured JSON response matching the BankLetterAuditResponse schema.
    """
    from google.genai import types
    from bank_letter_models import BankLetterAuditSchema
    
    system_prompt = build_bank_letter_audit_prompt()
    
    # Process the document (same as existing auditor)
    user_content = ""
    page_images = []
    
    if is_image:
        user_content = "The user uploaded an image of their bank letter. Analyze it for the 7 required IRCC elements."
        mime_type = ai_service.IMAGE_MIME_TYPES.get(file_extension, 'image/jpeg')
        page_images.append((doc_bytes, mime_type))
    elif file_extension == '.pdf':
        page_images = ai_service.pdf_pages_to_images(doc_bytes)
        extracted_text = ai_service.extract_text_from_pdf(doc_bytes)
        user_content = f"=== EXTRACTED PDF TEXT ===\n{extracted_text}"
    elif file_extension in ('.docx', '.doc'):
        user_content = f"=== EXTRACTED WORD TEXT ===\n{ai_service.extract_text_from_docx(doc_bytes)}"
    else:
        user_content = f"=== EXTRACTED TEXT ===\n{doc_bytes.decode('utf-8', errors='replace')}"
    
    # Build the content for Gemini
    contents = [system_prompt, f"=== BANK LETTER DOCUMENT ===\n{user_content}"]
    if page_images:
        contents.append("=== DOCUMENT IMAGES ===")
        for img_bytes, mime in page_images:
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
    
    # Call Gemini with structured output
    response = ai_service.client.models.generate_content(
        model='gemini-2.5-flash',
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=BankLetterAuditSchema,
            temperature=0.0,
        ),
    )
    
    result = json.loads(response.text)
    return result
