"""
IRCC portal section knowledge — what each section of the Express Entry
profile asks for, and the common mistakes applicants make.

Update this module when IRCC changes portal sections or requirements.
"""

PROMPT = """## IRCC EXPRESS ENTRY PORTAL — SECTION KNOWLEDGE

Use this knowledge ONLY when relevant to the user's question. Do not overload the response with unnecessary details.

### Personal Details
- Full legal name **(must match passport exactly — even if you go by a different name)**
- Date of birth, country of citizenship, country of residence
- Marital status: Single, Married, Common-Law, Divorced, Separated, Widowed, Annulled Marriage
- **Common mistake:** Selecting "Single" when you have a common-law partner. If you've lived with a partner for 12+ continuous months, IRCC considers that common-law.
- Number of dependents (children under 22 who don't have their own spouse/partner)

### Contact Information
- Current mailing address, residential address (if different), phone, email
- This section is straightforward. Most users don't need help here.

### Education
- Highest level of education completed
- Canadian education (if any — this gives bonus CRS points)
- **ECA (Educational Credential Assessment)** — MANDATORY for any education completed outside Canada
  - Accepted organizations: WES (most popular), IQAS, ICAS, BCIT, MCC, PEBC, UofT
  - You need the ECA report number and issuing organization name
  - **Common mistake:** Entering the WES reference number instead of the ECA report number. They are different. The ECA report number is on the evaluation report itself.
  - **Common mistake:** Claiming a credential level that doesn't match the ECA result. IRCC uses the ECA's Canadian equivalency, not what the degree is called in your country.

### Language Tests
- Accepted English tests: IELTS General Training, CELPIP-General, PTE Core
- Accepted French tests: TEF Canada, TCF Canada
- **CRITICAL: IRCC asks for RAW test scores (e.g., IELTS 7.0, 6.5), NOT CLB levels.** The portal converts them automatically. If a user says "my CLB is 9", ask them for their actual test scores.
- First official language = the language where you score higher (more CRS points)
- Second official language = optional, but adds bonus CRS points if you have one
- **Common mistake:** Taking IELTS Academic instead of IELTS General Training. Only General Training is accepted for Express Entry.
- **Common mistake:** Language test results must be less than 2 years old at the time of application submission.

### Work Experience
- **Canadian work experience** = paid work in Canada while authorized (work permit or PR)
- **Foreign work experience** = paid work outside Canada
- Full-time = 30+ hours/week
- Part-time is accepted: total hours / 1,560 = years of full-time equivalent
- Must be in a **skilled occupation** (TEER 0, 1, 2, or 3)
- NOC code = 5-digit NOC 2021 code
- Employment periods: start date, end date (or "present" if still employed)
- **Self-employment does NOT count** for Express Entry
- **Volunteer work does NOT count**
- **Common mistake:** Counting work experience gained while a full-time student (generally doesn't count for CEC)
- **Common mistake:** Using a job title instead of actual duties to pick a NOC code. IRCC evaluates based on duties, not titles.

### Spouse / Common-Law Partner
- Only relevant if married/common-law AND the spouse is accompanying to Canada
- Spouse factors: education, language scores, Canadian work experience
- **Important nuance:** Having an accompanying spouse REDUCES your maximum CRS points as a principal applicant (from 600 to 460 for core human capital) BUT your spouse's own qualifications can add points back via spouse factors. The net effect depends on how strong the spouse's profile is.
- If spouse is NOT accompanying → select "No" and they are treated as if you are single for CRS purposes

### Job Offer / LMIA
- "Arranged employment" = you have a valid LMIA or LMIA-exempt work permit
- **A regular job offer or letter of employment does NOT count.** You need a Labour Market Impact Assessment (LMIA) number.
- If you don't have an LMIA → select **"No"**
- **Common mistake:** Selecting "Yes" because they have a job in Canada. Having a job is not the same as having arranged employment under IRCC's definition.

### Provincial Nomination
- Adds **600 CRS points** (virtually guarantees an ITA in the next draw)
- Must be a valid, unexpired nomination from a Provincial Nominee Program (PNP)
- This is separate from a provincial "Expression of Interest" or "invitation to apply" to the province
- **Common mistake:** Confusing a PNP Expression of Interest with an actual nomination certificate.

### Representative Information
- "No representative" is perfectly fine (most DIY applicants select this)
- RCIC = Regulated Canadian Immigration Consultant (licensed)
- Lawyer = must be a member of a Canadian law society
- Unpaid representative = friend or family helping (must still be declared)

### Declaration & Signature
- Review all information for accuracy before submitting
- E-signature
- **Once submitted, you cannot edit most fields.** Double-check everything."""
