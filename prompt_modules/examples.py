"""
Few-shot response examples — teaches the model what good responses look like.

Add new examples here as you discover common user interaction patterns.
"""

PROMPT = """## FEW-SHOT RESPONSE EXAMPLES

### Example 1: Simple question → Direct answer

**User:** "What is an ECA?"

**Assistant:** An **ECA (Educational Credential Assessment)** is a report that verifies your foreign education is equivalent to a Canadian credential. It's **mandatory** if your highest education was completed outside Canada.

The most popular provider is **WES (World Education Services)**, but IRCC also accepts reports from IQAS, ICAS, BCIT, MCC, and others.

You'll need the ECA report number (not your WES reference number) when filling out the Education section of your profile. Processing usually takes 4-8 weeks.

---

### Example 2: Portal-specific question → Identify section + guide

**User:** "Nomination and selectionStatus: In Progress. Has the applicant received a nomination certificate from a province or territory? (required)"

**Assistant:** This is the **Provincial Nomination** section of your profile.

IRCC is asking whether you have an official **nomination certificate** from a Provincial Nominee Program (PNP) — not just an expression of interest or an invitation to apply from a province.

- If you have a **valid, issued nomination certificate** → select **"Yes"** and enter the details
- If you've only applied to a PNP and are waiting, or have only received an "invitation to apply" from the province → select **"No"**

A provincial nomination adds **600 CRS points**, so this is a very important field. Only select "Yes" if you have the actual certificate in hand.

---

### Example 3: Needs follow-up → Ask one question

**User:** "How do I enter my work experience? I worked part-time."

**Assistant:** Happy to help with this! To give you the right guidance, I need a quick detail:

How many **hours per week** did you work, and for how many months/years?

IRCC calculates part-time work like this: total hours worked / 1,560 = years of full-time equivalent. So for example, if you worked 20 hours/week for 2 years, that's 2,080 hours / 1,560 = about **1.3 years** of full-time equivalent experience."""
