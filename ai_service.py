import os
import json
import io
import datetime
import fitz  # PyMuPDF
from docx import Document as DocxDocument
from google import genai
from google.genai import types
from models import AnalysisResponse
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

# Load the NOC index once at startup
_noc_index_path = os.path.join(os.path.dirname(__file__), "noc_index.json")
with open(_noc_index_path, "r", encoding="utf-8") as f:
    NOC_INDEX = json.load(f)
print(f"Loaded NOC index: {len(NOC_INDEX)} unit groups")

# MIME type mapping for images
IMAGE_MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.webp': 'image/webp',
}

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    return text

def pdf_pages_to_images(pdf_bytes: bytes) -> list[tuple[bytes, str]]:
    """Convert each page of a PDF to a PNG image. Returns list of (image_bytes, mime_type)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        # Render at 2x resolution for better OCR quality
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png"))
    print(f"Converted {len(images)} PDF page(s) to images for vision processing")
    return images

def extract_text_from_docx(docx_bytes: bytes) -> str:
    doc = DocxDocument(io.BytesIO(docx_bytes))
    paragraphs = []
    for para in doc.paragraphs:
        if para.text.strip():
            paragraphs.append(para.text)
    # Also extract text from tables
    for table in doc.tables:
        for row in table.rows:
            row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_text:
                paragraphs.append(" | ".join(row_text))
    return "\n".join(paragraphs)

def _build_prompt_text(noc_reference: str, target_noc: str = None) -> str:
    """Builds the system instruction for the skeptical immigration officer auditor prompt."""
    
    task_noc_matching = """
=== TASK 1 - NOC DETECTION & ALIGNMENT ===

Read the employment letter carefully. Compare the duties described in the letter against the "duties" arrays in the NOC 2021 database.

NOC MATCHING STRATEGY:
Step 1: Identify TOP 3 candidate NOCs based on duties
Step 2: Select BEST-FIT NOC (highest duty coverage)
Step 3: Provide alternatives with lower confidence

=== CRITICAL: SEMANTIC MATCHING, NOT KEYWORD MATCHING ===
Do NOT match based on surface-level keywords. Focus on the SEMANTIC MEANING of what the person actually does day-to-day.
For example, a "Fire Watch Team Member" who inspects work areas for hazards, documents conditions, and recommends controls is performing SAFETY SPECIALIST duties — not firefighter duties — even though the word "fire" appears frequently. Always ask: "What is this person's core function?" rather than "What keywords appear most often?"

=== NO OVER-RELIANCE ON JOB TITLES ===
Job titles are NOT determinative. Duties override titles. A "Manager" who only does clerical work is NOT performing management duties.

=== TIE-BREAKING RULE ===
If two or more NOC codes score within 5 percentage points of each other, select the NOC whose LEAD STATEMENT most accurately describes the person's primary role. List the close runner-up as the first alternative NOC and explicitly note in the explanation that these two codes are close matches.

- In `noc_analysis.detected_code`, return the 5-digit code.
- In `noc_analysis.detected_title`, return the exact title from the database.
- In `noc_analysis.match_score`, evaluate objective duty coverage out of 100.
- In `noc_analysis.confidence`, rate how confident you are in this selection (0-100). Low match_score + high confidence = sure it's the right NOC but the letter is weak.
- In `noc_analysis.alternative_nocs`, list secondary matches >= 50%.
  **IMPORTANT: Score each alternative NOC as if you were doing a deep, dedicated evaluation against that specific NOC. Do NOT give rough estimates.**
"""

    if target_noc:
        task_noc_matching = f"""
=== TASK 1 - TARGETED NOC EVALUATION ===
The user explicitly requested to evaluate this document against NOC {target_noc}.
You MUST lock the primary match to NOC {target_noc}. Evaluate how strongly the applicant's duties align specifically with NOC {target_noc}.
- Set `noc_analysis.detected_code` strictly to "{target_noc}".
- Fetch and set `noc_analysis.detected_title` to the exact title for {target_noc} from the database.
- In `noc_analysis.match_score`, evaluate the objective percentage out of 100 showing how well their duties align with {target_noc}. (It is okay if it is low, be honest).
- In `noc_analysis.confidence`, rate how confident you are in this selection (0-100).
- You may still list other better fits in `alternative_nocs`.
- Map their duties strictly against the official duties of NOC {target_noc}. Explain where they overlap and note glaring gaps if any.
"""

    return f"""You are an advanced AI system acting as a STRICT, SKEPTICAL, and FAIR Canadian Immigration Officer auditing employment letters under Express Entry - Canadian Experience Class (CEC).

**IMPORTANT: Today's date is {datetime.date.today().strftime('%B %d, %Y')}. Use this as the current date for any date-related analysis. Do NOT hallucinate or guess a different date.**

PRIMARY OBJECTIVE:
Determine whether the applicant's work experience, as described in the employment letter, would likely be:
1) ACCEPTED
2) FLAGGED FOR PROCEDURAL FAIRNESS LETTER (PFL)
3) REFUSED

You must think like an IRCC officer whose role is to VERIFY, NOT TRUST.
Do NOT assume the applicant qualifies. The burden of proof is on the applicant.

You have been given:
1. A structured database of ALL 516 NOC 2021 unit groups, each with their official code, title, lead statement, and main duties.
2. A document uploaded by the user - either as extracted text or as an image.

---

=== CORE PRINCIPLES ===

1. BURDEN OF PROOF - Only consider what is explicitly stated or strongly implied in the letter. Do NOT assume missing duties were performed.
2. SKEPTICAL REVIEW - Actively look for weaknesses, ambiguity, and gaps that could justify refusal.
3. DUTY-BASED MATCHING - Match duties semantically, not by keywords. The applicant must demonstrate the MAJORITY (>=70%) of the MAIN DUTIES of a single NOC.
4. PARTIAL MATCH = RISK - If duties are vague, generic, or incomplete, increase refusal risk.

---

=== VALIDATION PIPELINE (PRE-CHECKS - Do this FIRST) ===

Classify each check as HARD_FAIL (stop analysis) or SOFT_FAIL (continue with warnings) or PASS.

CHECK 1 - READABLE CONTENT (HARD_FAIL if blank/corrupted):
- If the document is blank, empty, corrupted, or contains no readable text whatsoever, REJECT.
- Set `document_type` to "Blank / Unreadable Document".

CHECK 2 - DOCUMENT TYPE (HARD_FAIL if wrong type):
Only ACCEPTABLE:
  Employment / Reference / Experience letter issued BY an employer
  Job offer letter that includes duties/responsibilities
  A single letter covering multiple roles at the SAME company

NOT ACCEPTABLE (REJECT with clear explanation):
  Payslips, T4/T4A slips, ROE, tax/payroll documents
  Resumes or CVs (self-authored)
  Cover letters (applicant-authored)
  Job postings / advertisements
  LinkedIn profile screenshots
  Contracts without duties section
  Bank statements, invoices, receipts, ID documents
  Business cards, certificates, diplomas
  Unrelated photos or images

CHECK 3 - MULTIPLE EMPLOYERS (HARD_FAIL):
- If letters from TWO OR MORE DIFFERENT employers/companies are merged into one file, REJECT.
- A single letter covering multiple ROLES at the SAME company is perfectly valid.

CHECK 4 - LANGUAGE (SOFT_FAIL):
- If NOT in English or French, add a medium-severity risk. Still attempt analysis if duties are discernible.

CHECK 5 - DUTIES QUALITY (SOFT_FAIL):
- If fewer than 2 duties, flag as high-severity risk.
- If duties appear copy-pasted VERBATIM from the NOC website, flag as high-severity risk.

CHECK 6 - HEAVY REDACTION (SOFT_FAIL):
- If significant portions are redacted, add a warning noting which elements could not be verified.

=== REJECTION OUTPUT FORMAT ===
If ANY of Checks 1-3 result in HARD_FAIL:
- Set `decision` to "REFUSE", `confidence_score` to 95+.
- Set `noc_analysis.applicable` to false, `noc_analysis.detected_code` to "", `noc_analysis.match_score` to 0.
- Write a clear `officer_narrative` explaining what was detected and what to upload instead.
- Populate `refusal_reasons` with specific grounds.
- STOP. Do NOT attempt NOC matching or compliance auditing.

If all checks pass (or only SOFT_FAIL), proceed with the full analysis.

---

{task_noc_matching}

---

=== TASK 2 - DUTY EVIDENCE MAPPING (CRITICAL - This drives the decision) ===

You MUST map EVERY main duty from the selected NOC against the letter's content:

For `duties_match`, include ALL main duties from the NOC database - not just the ones that match.
For each duty, set `match_strength`:
  - "strong" - clear semantic alignment, specific evidence quoted from the letter
  - "partial" - related language but vague or incomplete
  - "weak" - only tangentially related
  - "missing" - no evidence in the letter at all

For `missing_critical_duties`, list every NOC duty that received "missing" or "weak" match_strength.
For `duty_coverage_percentage`, calculate: (count of "strong" + "partial") / (total NOC main duties) x 100

For `lead_statement_*`:
  - Quote the official lead statement from the NOC database
  - Quote the most relevant evidence from the letter
  - Explain how they align (or don't)

---

=== TASK 3 - IRCC COMPLIANCE AUDIT ===

Evaluate the employment letter against the official IRCC requirements for CEC reference letters.

MANDATORY ELEMENTS (populate `mandatory_requirements` booleans - set TRUE only if verifiably present):
1. OFFICIAL COMPANY LETTERHEAD
2. APPLICANT'S FULL NAME
3. COMPANY CONTACT INFORMATION - Address, telephone, email
4. JOB TITLE(S)
5. DATES OF EMPLOYMENT - Specific start and end dates
6. HOURS WORKED PER WEEK - Must prove full-time (30+) or state part-time hours
7. SALARY / COMPENSATION - Any format acceptable (hourly, weekly, monthly, annual)
8. SIGNATORY - Name, title, and signature of supervisor OR HR officer (both valid)

For `compliance.score`: (count of true mandatory_requirements / 8) x 100
For `compliance.missing_elements`: List mandatory elements completely absent.
For `compliance.warnings`: List elements present but insufficient/ambiguous.

=== DO NOT FLAG (IMPORTANT - These are NOT issues) ===
- Letter dated AFTER employment end date (normal for reference letters)
- Salary in any format (hourly, monthly, biweekly - all acceptable)
- HR signatory instead of supervisor (both valid per IRCC)
- Ongoing employment as "currently employed", "to date", "present" (all acceptable)
- Job title not matching NOC title exactly (duties override titles)
- Minor wording differences from official NOC descriptions
- Minor formatting inconsistencies

---

=== TASK 4 - RISK ASSESSMENT ===

`overall_risk`: low (strong case) / moderate (gaps but defensible) / high (likely refusal)
`pfl_likelihood`: low / medium / high - how likely is IRCC to issue a Procedural Fairness Letter?
`key_risks`: Every identified risk, ordered by severity (highest first). Each must be specific and actionable.

---

=== TASK 5 - DECISION (You MUST choose ONE. No neutrality allowed.) ===

ACCEPT if:
- >=75% duty coverage
- Clear, specific, verifiable duties
- All critical compliance elements present

PFL_RISK if:
- 50-75% duty coverage OR
- Ambiguity / vague duties OR
- Missing supporting clarity
- You MUST populate `refusal_reasons` with the specific grounds that would trigger a PFL.

REFUSE if:
- <50% duty coverage OR
- Missing key duties entirely OR
- Insufficient evidence to establish NOC alignment
- You MUST populate `refusal_reasons`.

---

=== TASK 6 - OFFICER NARRATIVE ===

Write `officer_narrative` in a realistic IRCC officer tone:
- Formal, concise, evidence-based, slightly skeptical
- 3-5 sentences referencing specific duties and gaps
- Example: "The duties described are insufficiently detailed to establish alignment with the claimed NOC. While the applicant references supervisory responsibilities, the letter lacks specificity regarding..."

---

=== TASK 7 - ACTION PLAN & SUGGESTED WORDING ===

`action_plan`: Priority-ordered, specific, actionable fixes. Most critical first. Each item must be directly tied to an identified risk or gap. Not generic advice.
`suggested_wording`: If duties are weak or missing, provide sample sentences the applicant can give to their employer to strengthen the letter's alignment with the NOC.

---

=== TASK 8 - LOCATION OF EXPERIENCE ===

Analyze the company address, letterhead, and geographic references:
- Canadian address/postal code/province -> "canada"
- Non-Canadian address -> "outside_canada"
- Cannot determine -> "unknown"

---

=== NOC 2021 DATABASE (All 516 Unit Groups with Codes, Titles, and Duties) ===
{noc_reference}

---

=== FINAL RULE ===
If evidence is weak or missing, you MUST penalize heavily.
You MUST NOT "help" the applicant pass.
Your role is to PROTECT the integrity of the immigration system while giving fair, actionable feedback.

Output your analysis strictly conforming to the requested JSON schema. Be precise and evidence-based.
"""

def build_noc_finder_prompt(noc_reference: str, target_noc: str = None) -> str:
    """Builds the NOC Finder prompt v2 — fast, reliable, IRCC-consistent NOC suggestion."""

    today = datetime.date.today().strftime('%B %d, %Y')

    # --- Task 1 block varies for auto vs targeted evaluation ---
    if target_noc:
        task_1 = f"""
=== TASK 1 — TARGETED NOC EVALUATION ===

The user explicitly requested evaluation against NOC {target_noc}.
You MUST lock the primary match to NOC {target_noc}.

- Set `recommended_noc.code` strictly to "{target_noc}".
- Set `recommended_noc.title` to the exact title for {target_noc} from the database.

=== CONFIDENCE CALCULATION (MUST FOLLOW THIS EXACTLY) ===

To compute `recommended_noc.confidence`, you MUST:
1. Look up ALL main duties for NOC {target_noc} from the database.
2. For EACH main duty, classify the applicant's evidence:
   - "strong" = clear semantic alignment with specific evidence from the input
   - "partial" = related language but vague or incomplete
   - "missing" = no evidence in the input at all
3. Calculate: confidence = (count of "strong" + "partial") / (total main duties) × 100

This is the SAME scoring methodology used by IRCC auditors. Do NOT estimate — count the duties.

- Classify `result_type` based on confidence: STRONG_MATCH (≥75%), MODERATE_MATCH (60-74%), NO_MATCH (<60%).
- `key_matches`: List the duties classified as "strong" (up to 5)
- `key_gaps`: List the duties classified as "missing" (up to 3)
- You may still list better fits in `alternatives`.
"""
    else:
        task_1 = """
=== TASK 1 — NOC MATCHING ===

Steps:

1. Read the user's duties carefully.
2. Compare duties against candidate NOCs in the database:
   - Lead statement alignment
   - Main duties overlap (SEMANTIC, not keyword matching)
3. For your top candidate NOC, compute DUTY COVERAGE using the method below.
4. Select the BEST NOC based on priority order:
   a) Duty coverage %
   b) Lead statement alignment
   c) Specificity of duties
5. Also evaluate up to 2 ALTERNATIVE NOCs with honest scores.

=== CRITICAL: SEMANTIC MATCHING, NOT KEYWORD MATCHING ===
Focus on the SEMANTIC MEANING of what the person actually does day-to-day.
Example: A "Fire Watch Team Member" who inspects work areas for hazards and recommends controls
is performing SAFETY SPECIALIST duties — not firefighter duties — even though the word "fire"
appears frequently. Always ask: "What is this person's core function?"

=== TIE-BREAKING RULE ===
If two NOC codes score within 5 points, select the NOC whose LEAD STATEMENT most accurately
describes the person's primary role. List the runner-up as the first alternative.

=== CONFIDENCE CALCULATION (MUST FOLLOW THIS EXACTLY) ===

To compute `recommended_noc.confidence`, you MUST:
1. Look up ALL main duties for the selected NOC from the database.
2. For EACH main duty, classify the applicant's evidence:
   - "strong" = clear semantic alignment with specific evidence from the input
   - "partial" = related language but vague or incomplete
   - "missing" = no evidence in the input at all
3. Calculate: confidence = (count of "strong" + "partial") / (total main duties) × 100

This is the SAME scoring methodology used by IRCC auditors. Do NOT estimate — count the duties.

=== MATCH CLASSIFICATION ===
Based on computed confidence:
- ≥75% → result_type = "STRONG_MATCH"
- 60–74% → result_type = "MODERATE_MATCH"
- <60% → result_type = "NO_MATCH"

If NO NOC reaches ~60%, still return the best candidate but set result_type to NO_MATCH
and explain in `why_this_noc` that alignment is weak.

=== OUTPUT MAPPING ===
- `recommended_noc.code`: Best-matching 5-digit NOC code
- `recommended_noc.title`: Exact title from the database
- `recommended_noc.confidence`: Computed duty coverage percentage (0-100)
- `why_this_noc`: 1-2 sentence explanation of selection + any key concerns
- `key_matches`: Duties classified as "strong" (up to 5, short strings)
- `key_gaps`: Duties classified as "missing" (up to 3, short strings)
- `alternatives`: Up to 2 alternative NOCs with their computed confidence scores
"""

    return f"""You are a Canadian immigration NOC (National Occupational Classification) expert specializing in NOC 2021.

Your role is to IDENTIFY the most likely NOC for a user's work experience, while ensuring consistency with IRCC evaluation standards.

---

PRIMARY OBJECTIVE:
Recommend the MOST LIKELY NOC based on the user's duties, BUT ONLY if the duties appear to demonstrate meaningful alignment with that NOC.

You are NOT allowed to confidently recommend a NOC if alignment is weak. Be honest.

---

IMPORTANT CONTEXT:
- Today's date: {today}
- The applicant must demonstrate a MAJORITY (~60-70%) of the main duties of a NOC to be considered a strong match.
- Your output must be CONSISTENT with a future audit. Do NOT recommend a NOC that would likely fail a detailed audit.

---

=== INPUT VALIDATION (RUN FIRST) ===

IF DOCUMENT INPUT:

1. READABILITY:
   - If blank, corrupted, or no readable text → Set document_valid=false, rejection_reason="Document is blank or unreadable."

2. DOCUMENT TYPE:
   ACCEPT: Employment/reference/experience letters, Job offer letters WITH duties, Single document with multiple roles at SAME company
   ALLOW WITH LOWER CONFIDENCE: Resume/CV, Job descriptions (set applicable=true but note lower reliability in `notes`)
   REJECT: Payslips, T4s, ID documents, contracts without duties

3. MULTIPLE EMPLOYERS:
   - If multiple DIFFERENT employers → REJECT

4. DUTIES:
   - If fewer than 2 meaningful duties → REJECT

IF MANUAL INPUT:
   - If no clear job title OR fewer than 2 concrete duties → REJECT

VALIDATION RESULT:
- If PASSES: set document_valid=true, rejection_reason=""
- If FAILS: set document_valid=false, write clear rejection_reason. Do NOT populate noc_analysis.

{task_1}

=== TASK 2 — LOCATION OF EXPERIENCE ===
- If the input clearly mentions a Canadian address/province → "canada"
- If it clearly mentions a location outside Canada → "outside_canada"
- If unclear → "unknown"

=== STRICT RULES ===
- NEVER assume missing duties were performed
- NEVER rely on job title alone — always evaluate actual duties
- ALWAYS prefer accuracy over completeness
- KEEP notes/explanations short and precise (1-2 sentences)
- ENSURE consistency with IRCC-style evaluation logic
- Score alternative NOCs honestly as if doing a full dedicated evaluation against each

Your goal is to provide a FAST, RELIABLE, and TRUSTWORTHY NOC suggestion — not a full audit.

=== NOC 2021 DATABASE ===
{noc_reference}

Output your analysis strictly conforming to the requested JSON schema.
"""


def analyze_document_with_ai(uploaded_doc_bytes: bytes, file_extension: str, is_image: bool = False, target_noc: str = None) -> dict:
    try:
        noc_reference = json.dumps(NOC_INDEX, ensure_ascii=False)
        system_prompt = _build_prompt_text(noc_reference, target_noc)
        
        if is_image:
            # For standalone images: send directly to Gemini's vision model
            mime_type = IMAGE_MIME_TYPES.get(file_extension, 'image/jpeg')
            print(f"Processing image ({mime_type}) via Gemini Vision...")
            
            contents = [
                system_prompt,
                "\n=== USER'S EMPLOYMENT LETTER (Image — read all text visible in this document image) ===\n",
                types.Part.from_bytes(data=uploaded_doc_bytes, mime_type=mime_type),
            ]
        elif file_extension == '.pdf':
            # HYBRID MODE: Always send page images (so AI can see letterhead, logo, signature)
            # plus extracted text when available (for precise content analysis)
            print("Processing PDF in hybrid mode (images + text)...")
            
            # 1. Convert pages to images (so AI sees letterhead, logos, signatures)
            page_images = pdf_pages_to_images(uploaded_doc_bytes)
            
            # 2. Also try to extract text for precise content matching
            user_text = extract_text_from_pdf(uploaded_doc_bytes)
            has_text = len(user_text.strip()) >= 50
            
            if has_text:
                print(f"PDF has both text ({len(user_text):,} chars) and {len(page_images)} page image(s)")
            else:
                print(f"PDF is image-based (scanned). Sending {len(page_images)} page image(s) only.")
            
            # Build multimodal content: prompt + images + optional text
            contents = [
                system_prompt,
                "\n=== USER'S EMPLOYMENT LETTER (Page images — examine the letterhead, logo, signature, and overall formatting) ===\n",
            ]
            for img_bytes, mime in page_images:
                contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
            
            if has_text:
                contents.append(f"\n=== EXTRACTED TEXT FROM THE SAME DOCUMENT (Use this for precise duty and content analysis) ===\n{user_text}")
        else:
            # Word documents and other text files
            if file_extension in ('.docx', '.doc'):
                print("Extracting text from Word document...")
                user_text = extract_text_from_docx(uploaded_doc_bytes)
            else:
                user_text = uploaded_doc_bytes.decode('utf-8', errors='replace')
            
            contents = system_prompt + f"\n\n=== USER'S EMPLOYMENT LETTER ===\n{user_text}"
        
        print(f"Asking Gemini to analyze and auto-detect NOC code...")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AnalysisResponse,
                temperature=0.0,
            ),
        )
        
        return json.loads(response.text)
        
    except Exception as e:
        print(f"AI Service Error: {e}")
        raise e


# ── Letter Builder Functions ──

def get_noc_details(noc_code: str) -> dict | None:
    """Look up a single NOC code from the loaded index. Returns the entry or None."""
    for entry in NOC_INDEX:
        if entry.get("code") == noc_code:
            return entry
    return None


def build_duty_analysis_prompt(noc_entry: dict, user_duty: str) -> str:
    """Builds a lightweight prompt to evaluate ONE duty against ONE NOC's official duties."""
    
    noc_code = noc_entry.get("code", "")
    noc_title = noc_entry.get("title", "")
    lead_statement = noc_entry.get("lead_statement", "")
    duties = noc_entry.get("duties", [])
    duties_text = "\n".join(f"  {i+1}. {d}" for i, d in enumerate(duties))
    
    return f"""You are an IRCC employment letter compliance assistant specializing in NOC 2021.

Your ONLY task: evaluate whether a user-written duty statement aligns with the official duties of NOC {noc_code} ({noc_title}).

=== OFFICIAL NOC {noc_code} INFORMATION ===
Title: {noc_title}
Lead Statement: {lead_statement}
Main Duties:
{duties_text}

=== USER'S DUTY STATEMENT ===
"{user_duty}"

=== YOUR TASK ===

1. Determine which official duty (if any) this user statement most closely aligns with.
2. Rate the alignment: strong (clear match), partial (related but vague), weak (tangential), none (no alignment).
3. If the duty is vague or incomplete, provide up to 3 specific coaching questions to help them make it stronger and more IRCC-compliant.
4. Determine if this duty is "IRCC ready" — meaning it is specific enough, action-oriented, and clearly aligns with the NOC to be included in a formal employment letter.

=== STRICT RULES ===
- Do NOT rewrite the duty for them
- Do NOT invent information the user didn't provide
- Do NOT suggest duties the user didn't mention performing
- If the duty has NO alignment with any official NOC duty, set alignment to "none" and explain clearly
- Coaching questions should ask about SPECIFICS: tools, frequency, scope, outcomes, who they report to
- Be encouraging but honest

Output your analysis strictly conforming to the requested JSON schema.
"""


def analyze_single_duty(user_duty: str, noc_code: str) -> dict:
    """Analyze a single user-written duty against a specific NOC code using AI."""
    from letter_builder_models import DutyAnalysisResponse
    
    noc_entry = get_noc_details(noc_code)
    if not noc_entry:
        raise ValueError(f"NOC code {noc_code} not found in index")
    
    prompt = build_duty_analysis_prompt(noc_entry, user_duty)
    
    print(f"Analyzing duty against NOC {noc_code}: '{user_duty[:60]}...'")
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DutyAnalysisResponse,
            temperature=0.0,
        ),
    )
    
    return json.loads(response.text)


def assemble_letter_text(employment_details: dict, noc_code: str, noc_title: str, approved_duties: list) -> dict:
    """Assemble a complete IRCC-compliant employment letter from user-approved data.
    
    This is pure Python template rendering — NO AI call needed.
    Every word in the output was provided or approved by the user.
    """
    import datetime as _dt
    
    d = employment_details
    today = _dt.date.today().strftime("%B %d, %Y")
    
    # Determine employment status phrasing
    is_ongoing = d.get("end_date", "").lower() in ("ongoing", "present", "current", "to date", "")
    if is_ongoing:
        period_phrase = f"since {d['start_date']}"
        status_phrase = f"is currently employed"
        end_display = "Present"
    else:
        period_phrase = f"from {d['start_date']} to {d['end_date']}"
        status_phrase = f"was employed"
        end_display = d['end_date']
    
    # Salary formatting
    salary_str = f"{d['salary_amount']} {d['salary_currency']} {d['salary_period']}"
    
    # Build duties bullet list
    duties_bullets = "\n".join(f"    • {duty['text']}" for duty in approved_duties)
    
    # Assemble intro paragraph
    intro = (
        f"This letter is to confirm that {d['applicant_name']} "
        f"{status_phrase} by {d['company_name']} as a {d['job_title']} "
        f"{period_phrase}."
    )
    
    # Employment details paragraph
    emp_details = (
        f"{d['applicant_name']} works {d['hours_per_week']} hours per week on a "
        f"{d['employment_type']} basis. "
        f"{'Their' if is_ongoing else 'Their'} compensation is {salary_str}. "
        f"The position is based in {d['work_city']}, {d['work_country']}."
    )
    
    # Duties section
    duties_section = (
        f"During {'their' if is_ongoing else 'their'} employment, "
        f"{d['applicant_name']}'s main duties and responsibilities include:\n\n"
        f"{duties_bullets}"
    )
    
    # Closing
    closing = (
        f"Should you require any further information regarding "
        f"{d['applicant_name']}'s employment, please do not hesitate "
        f"to contact the undersigned at {d['supervisor_contact']}."
    )
    
    # Supervisor block
    supervisor_block = (
        f"Sincerely,\n\n"
        f"{d['supervisor_name']}\n"
        f"{d['supervisor_title']}\n"
        f"{d['company_name']}\n"
        f"{d.get('company_address', '')}"
    )
    
    # Full letter
    full_text = (
        f"[COMPANY LETTERHEAD]\n\n"
        f"{today}\n\n"
        f"To Whom It May Concern,\n\n"
        f"{intro}\n\n"
        f"{emp_details}\n\n"
        f"{duties_section}\n\n"
        f"{closing}\n\n"
        f"{supervisor_block}\n\n"
        f"[SIGNATURE]"
    )
    
    # Warnings
    warnings = []
    if len(approved_duties) < 4:
        warnings.append(f"Only {len(approved_duties)} duties provided. IRCC typically expects at least 4 meaningful duties.")
    
    strong_count = sum(1 for d in approved_duties if d.get("alignment") == "strong")
    if strong_count < 2:
        warnings.append("Fewer than 2 duties have strong NOC alignment. Consider strengthening your duty statements.")
    
    return {
        "status": "APPROVED" if len(approved_duties) >= 4 else "INCOMPLETE",
        "noc_code": noc_code,
        "noc_title": noc_title,
        "letter_sections": {
            "header_placeholder": "[COMPANY LETTERHEAD]",
            "date": today,
            "addressee": "To Whom It May Concern,",
            "intro_paragraph": intro,
            "employment_details_paragraph": emp_details,
            "duties_section": duties_section,
            "closing_paragraph": closing,
            "supervisor_block": supervisor_block,
            "signature_placeholder": "[SIGNATURE]",
        },
        "letter_full_text": full_text,
        "warnings": warnings,
    }


# ── ITA Strategy Report Generation ──

def generate_ita_strategy(raw_inputs: dict, score: dict, breakdown: dict) -> dict:
    """
    Generate a personalized ITA (Invitation to Apply) strategy report
    based on the user's exact CRS profile inputs and calculated score.
    """
    
    # Build a human-readable profile summary for the AI
    profile_lines = []
    profile_lines.append(f"Age: {raw_inputs.get('age', 'Unknown')}")
    profile_lines.append(f"Marital Status: {raw_inputs.get('maritalStatus', 'Unknown')}")
    if raw_inputs.get('maritalStatus') in ['Married', 'Common-Law']:
        profile_lines.append(f"  Spouse is Canadian PR/Citizen: {raw_inputs.get('spouseIsPR', 'Unknown')}")
        profile_lines.append(f"  Spouse accompanying: {raw_inputs.get('spouseAccompanying', 'Unknown')}")
    
    education_labels = {
        'none': 'None or less than secondary',
        'secondary': 'Secondary diploma (high school)',
        'one-year': 'One-year post-secondary',
        'two-year': 'Two-year post-secondary',
        'bachelors': "Bachelor's degree",
        'two-or-more': 'Two or more certificates/degrees',
        'masters': "Master's degree or professional degree",
        'doctoral': 'Doctoral (PhD)',
    }
    profile_lines.append(f"Education: {education_labels.get(raw_inputs.get('education', ''), raw_inputs.get('education', 'Unknown'))}")
    profile_lines.append(f"Canadian Education: {raw_inputs.get('hasCanadianEducation', 'No')}")
    if raw_inputs.get('hasCanadianEducation') == 'Yes':
        can_edu_labels = {'one-two': '1-2 year credential', 'three-plus': '3+ years / Masters / PhD'}
        profile_lines.append(f"  Canadian Credential: {can_edu_labels.get(raw_inputs.get('canadianEducation', ''), 'Unknown')}")
    
    profile_lines.append(f"Primary Language Test: {raw_inputs.get('lang1Test', 'None')}")
    profile_lines.append(f"  Listening: {raw_inputs.get('lang1L', 'N/A')}, Speaking: {raw_inputs.get('lang1S', 'N/A')}, Reading: {raw_inputs.get('lang1R', 'N/A')}, Writing: {raw_inputs.get('lang1W', 'N/A')}")
    
    lang2 = raw_inputs.get('lang2Test', 'None / Not Applicable')
    if lang2 != 'None / Not Applicable':
        profile_lines.append(f"Second Language Test: {lang2}")
        profile_lines.append(f"  Listening: {raw_inputs.get('lang2L', 'N/A')}, Speaking: {raw_inputs.get('lang2S', 'N/A')}, Reading: {raw_inputs.get('lang2R', 'N/A')}, Writing: {raw_inputs.get('lang2W', 'N/A')}")
    else:
        profile_lines.append("Second Language Test: None")
    
    profile_lines.append(f"Canadian Work Experience: {raw_inputs.get('canadianWork', 'None')}")
    profile_lines.append(f"Foreign Work Experience: {raw_inputs.get('foreignWork', 'None')}")
    profile_lines.append(f"Provincial Nomination: {raw_inputs.get('provincialNom', 'No')}")
    profile_lines.append(f"Sibling in Canada: {raw_inputs.get('siblingInCanada', 'No')}")
    profile_lines.append(f"Certificate of Qualification: {raw_inputs.get('certOfQualification', 'No')}")
    
    # Spouse factors
    if raw_inputs.get('spouseAccompanying') == 'Yes' and raw_inputs.get('spouseIsPR') == 'No':
        profile_lines.append(f"Spouse Education: {education_labels.get(raw_inputs.get('spouseEducation', ''), 'Unknown')}")
        profile_lines.append(f"Spouse Language Test: {raw_inputs.get('spLangTest', 'None')}")
        if raw_inputs.get('spLangTest', 'None / Not Applicable') != 'None / Not Applicable':
            profile_lines.append(f"  Spouse L: {raw_inputs.get('spL', 'N/A')}, S: {raw_inputs.get('spS', 'N/A')}, R: {raw_inputs.get('spR', 'N/A')}, W: {raw_inputs.get('spW', 'N/A')}")
        profile_lines.append(f"Spouse Canadian Work: {raw_inputs.get('spouseCanadianWork', 'None')}")
    
    profile_summary = "\n".join(profile_lines)
    
    score_summary = f"""
CRS Score Breakdown:
  Total Score: {score.get('total', 0)} / 1200
  Core/Human Capital: {score.get('core', 0)}
  Spouse Factors: {score.get('spouse', 0)}
  Skill Transferability: {score.get('transferability', 0)}
  Additional Points: {score.get('additional', 0)}

Detailed Core Breakdown:
  Age Points: {breakdown.get('core', {}).get('age', 0)}
  Education Points: {breakdown.get('core', {}).get('education', 0)}
  Official Languages: {breakdown.get('core', {}).get('officialLanguages', 0)}
    First Official Language: {breakdown.get('core', {}).get('firstOfficialLanguage', 0)}
    Second Official Language: {breakdown.get('core', {}).get('secondOfficialLanguage', 0)}
  Canadian Work Experience: {breakdown.get('core', {}).get('canadianWorkExperience', 0)}

Skill Transferability Breakdown:
  Education + Language: {breakdown.get('transferability', {}).get('education', {}).get('languageAndEducation', 0)}
  Education + Canadian Work: {breakdown.get('transferability', {}).get('education', {}).get('canadianWorkAndEducation', 0)}
  Foreign Work + Language: {breakdown.get('transferability', {}).get('foreignWork', {}).get('languageAndForeignWork', 0)}
  Foreign Work + Canadian Work: {breakdown.get('transferability', {}).get('foreignWork', {}).get('canadianAndForeignWork', 0)}
  Certificate of Qualification: {breakdown.get('transferability', {}).get('certificateOfQualification', 0)}

Additional Points Breakdown:
  Provincial Nomination: {breakdown.get('additional', {}).get('provincialNomination', 0)}
  Study in Canada: {breakdown.get('additional', {}).get('studyInCanada', 0)}
  Sibling in Canada: {breakdown.get('additional', {}).get('siblingInCanada', 0)}
  French Language Skills: {breakdown.get('additional', {}).get('frenchLanguageSkills', 0)}
"""

    prompt = f"""You are an expert Canadian immigration consultant specializing in Express Entry and the Comprehensive Ranking System (CRS). You have deep knowledge of all pathways to improve CRS scores, including Provincial Nominee Programs (PNPs), language testing strategies, education credential assessment, and Canadian work experience optimization.

A user has completed their CRS calculation and their EXACT profile is below. Your job is to create a highly personalized, actionable strategy report to help them receive an Invitation to Apply (ITA).

═══════════════════════════════════════
USER PROFILE:
{profile_summary}

{score_summary}
═══════════════════════════════════════

The latest Express Entry general draw cutoff is approximately 520-540 points (as of early 2026). Category-based draws (French language, healthcare, STEM, trades, agriculture) can have lower cutoffs.

═══════════════════════════════════════
OFFICIAL CRS SCORING REFERENCE
(You MUST use these tables for ALL point calculations. Do NOT guess point values.)
═══════════════════════════════════════

A. CORE / HUMAN CAPITAL FACTORS:

Age (with spouse / without spouse):
  17 or under: 0/0, 18: 90/99, 19: 95/105, 20-29: 100/110,
  30: 95/105, 31: 90/99, 32: 85/94, 33: 80/88, 34: 75/83,
  35: 70/77, 36: 65/72, 37: 60/66, 38: 55/61, 39: 50/55,
  40: 45/50, 41: 35/39, 42: 25/28, 43: 15/17, 44: 5/6, 45+: 0/0

Education (with spouse / without spouse):
  None: 0/0, Secondary: 28/30, One-year post-sec: 84/90,
  Two-year post-sec: 91/98, Bachelor's: 112/120,
  Two or more credentials: 119/128, Master's: 126/135, Doctoral: 140/150

First Official Language PER ABILITY (with spouse / without spouse):
  CLB < 4: 0/0, CLB 4-5: 6/6, CLB 6: 8/9, CLB 7: 16/17,
  CLB 8: 22/23, CLB 9: 29/31, CLB 10+: 32/34
  (Multiply by 4 abilities for total. Max = 128/136)

Second Official Language PER ABILITY (with spouse / without spouse):
  CLB < 5: 0/0, CLB 5-6: 1/1, CLB 7-8: 3/3, CLB 9+: 5/6
  (Multiply by 4 abilities for total. Max = 20/24)

Canadian Work Experience (with spouse / without spouse):
  None: 0/0, 1yr: 35/40, 2yr: 46/53, 3yr: 56/64, 4yr: 63/72, 5+yr: 70/80

B. SPOUSE FACTORS (only when spouse is accompanying and NOT a PR/citizen):

Spouse Education:
  None: 0, Secondary: 2, One-year: 6, Two-year: 7,
  Bachelor's: 8, Two or more: 9, Master's: 10, Doctoral: 10

Spouse Language PER ABILITY:
  CLB < 5: 0, CLB 5-6: 1, CLB 7-8: 3, CLB 9+: 5
  (Multiply by 4 abilities for total. Max = 20)

Spouse Canadian Work:
  None: 0, 1yr: 5, 2yr: 7, 3yr: 8, 4yr: 9, 5+yr: 10

C. ADDITIONAL POINTS:
  Provincial Nomination: +600
  Sibling in Canada (PR/citizen): +15
  Canadian education (1-2yr credential): +15, (3+yr or grad): +30
  French language proficiency: 
    - IF user has NCLC 7+ in all 4 French abilities AND English is CLB 4 or lower (or no English test): +25 points
    - IF user has NCLC 7+ in all 4 French abilities AND English is CLB 5 or higher in all 4 abilities: +50 points
    (Note: You MUST check the user's English CLB levels before applying this bonus. If they have strong English, use 50.)

═══════════════════════════════════════
CRITICAL: When recommending actions, you MUST calculate the EXACT point difference
between the user's current level and the target level using these tables.
For example: Spouse going from no language test (0 pts) to CLB 9 all abilities = 5×4 = +20 points, NOT a rough estimate.
═══════════════════════════════════════

Generate a comprehensive, personalized ITA strategy report. You MUST return ONLY a valid JSON object with this exact structure (no markdown, no code fences, just raw JSON):

{{
  "current_score": {score.get('total', 0)},
  "estimated_cutoff": 530,
  "gap": {max(530 - score.get('total', 0), 0)},
  "overall_assessment": "YOUR_ASSESSMENT_HERE",
  "category_based_eligibility": [
    {{
      "category": "CATEGORY_NAME",
      "eligible": true,
      "note": "EXPLANATION"
    }}
  ],
  "actions": [
    {{
      "rank": 1,
      "title": "ACTION_TITLE",
      "description": "DETAILED_DESCRIPTION",
      "potential_points": "+XX to +YY",
      "effort_level": "Low or Medium or High",
      "estimated_timeline": "X-Y months",
      "estimated_cost": "$XXX CAD",
      "priority": "Critical or High or Medium or Low",
      "specific_targets": "SPECIFIC_TARGETS"
    }}
  ],
  "language_optimization": {{
    "current_first_language_points": {breakdown.get('core', {}).get('firstOfficialLanguage', 0)},
    "max_first_language_points": 136,
    "improvement_possible": 0,
    "specific_targets": "TARGET_SCORES",
    "second_language_recommendation": "RECOMMENDATION"
  }},
  "pnp_recommendations": [
    {{
      "province": "PROVINCE",
      "stream": "STREAM_NAME",
      "why_suitable": "REASON",
      "points_impact": "+600",
      "requirements_summary": "REQUIREMENTS"
    }}
  ],
  "timeline_summary": "TIMELINE_PARAGRAPH",
  "disclaimer": "This report provides general guidance based on publicly available CRS criteria and immigration program information. It is not legal advice. For personalized legal advice, consult a Regulated Canadian Immigration Consultant (RCIC) or immigration lawyer. Immigration policies and cutoff scores change frequently — always verify with IRCC's official website."
}}

═══════════════════════════════════════
OFFICIAL LANGUAGE TEST → CLB CONVERSION TABLES
(You MUST use these tables. Do NOT guess conversions.)
═══════════════════════════════════════

CELPIP-General → CLB:
  CELPIP scores map DIRECTLY 1:1 to CLB levels.
  CELPIP 4 = CLB 4, CELPIP 5 = CLB 5, CELPIP 6 = CLB 6,
  CELPIP 7 = CLB 7, CELPIP 8 = CLB 8, CELPIP 9 = CLB 9,
  CELPIP 10 = CLB 10, CELPIP 11 = CLB 11, CELPIP 12 = CLB 12.
  CELPIP uses WHOLE NUMBERS only (no decimals like 8.0 or 7.5).

IELTS General Training → CLB:
  Listening: 4.5=CLB4, 5.0=CLB5, 5.5=CLB6, 6.0=CLB7, 7.5=CLB8, 8.0=CLB9, 8.5=CLB10
  Reading:   3.5=CLB4, 4.0=CLB5, 5.0=CLB6, 6.0=CLB7, 6.5=CLB8, 7.0=CLB9, 8.0=CLB10
  Writing:   4.0=CLB4, 5.0=CLB5, 5.5=CLB6, 6.0=CLB7, 6.5=CLB8, 7.0=CLB9, 7.5=CLB10
  Speaking:  4.0=CLB4, 5.0=CLB5, 5.5=CLB6, 6.0=CLB7, 6.5=CLB8, 7.0=CLB9, 7.5=CLB10

TEF Canada → NCLC:
  Listening: 145-216=NCLC4, 217-248=NCLC5, 249-279=NCLC6, 280-297=NCLC7, 298-315=NCLC8, 316-333=NCLC9, 334-360=NCLC10
  Reading:   121-150=NCLC4, 151-180=NCLC5, 181-206=NCLC6, 207-232=NCLC7, 233-247=NCLC8, 248-262=NCLC9, 263-300=NCLC10
  Writing:   181-225=NCLC4, 226-270=NCLC5, 271-309=NCLC6, 310-348=NCLC7, 349-370=NCLC8, 371-392=NCLC9, 393-450=NCLC10
  Speaking:  181-225=NCLC4, 226-270=NCLC5, 271-309=NCLC6, 310-348=NCLC7, 349-370=NCLC8, 371-392=NCLC9, 393-450=NCLC10

TCF Canada → NCLC:
  Listening: 331-368=NCLC4, 369-397=NCLC5, 398-457=NCLC6, 458-502=NCLC7, 503-522=NCLC8, 523-548=NCLC9, 549-699=NCLC10
  Reading:   342-374=NCLC4, 375-405=NCLC5, 406-452=NCLC6, 453-498=NCLC7, 499-523=NCLC8, 524-548=NCLC9, 549-699=NCLC10
  Writing:   4=NCLC4, 6=NCLC5, 6=NCLC6, 10=NCLC7, 12=NCLC8, 14=NCLC9, 16=NCLC10
  Speaking:  4=NCLC4, 6=NCLC5, 6=NCLC6, 10=NCLC7, 12=NCLC8, 14=NCLC9, 16=NCLC10

═══════════════════════════════════════

RULES:
1. Be SPECIFIC to this user's exact profile. Reference their actual scores, not generic advice.
2. Rank actions from highest impact/easiest to lowest impact/hardest.
3. If the user already has maximum points in a category, acknowledge it and skip it.
4. Be honest — if the gap is very large, say so and suggest realistic pathways.
5. Include at least 4-6 actionable recommendations.
6. For language optimization, use ONLY the conversion tables above. NEVER mix up CELPIP and IELTS scoring. If the user took CELPIP, all targets must be in CELPIP whole numbers. If the user took IELTS, all targets must be in IELTS band scores. State both the test-specific score AND the CLB level.
7. For PNP, suggest 2-3 specific provincial programs they may qualify for based on their profile.
8. All costs should be in CAD.
9. NEVER use decimal scores (e.g., "8.0") for CELPIP — CELPIP uses whole numbers only.
10. NEVER confuse test scoring systems. Double-check every conversion against the tables above.
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=16384,
                response_mime_type="application/json",
            )
        )
        
        raw_text = response.text.strip()
        
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            lines = lines[1:]  # Remove first ```json line
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_text = "\n".join(lines)
        
        strategy = json.loads(raw_text)
        return strategy
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse ITA strategy JSON: {e}")
        print(f"Raw response: {raw_text[:1000]}")
        raise ValueError(f"AI returned invalid JSON for ITA strategy: {str(e)}")
    except Exception as e:
        print(f"ITA Strategy generation failed: {e}")
        raise

