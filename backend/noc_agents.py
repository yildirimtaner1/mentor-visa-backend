"""Shared NOC helper functions
==============================

Originally this module hosted the RAG-first "multi-agent voting" pipeline
(run_multi_agent_noc_finder). That pipeline has been replaced by the knowledge-first
pipeline in noc_finder_v2.py. What remains here are the stateless helpers that
noc_finder_v2 reuses:

- Anthropic/OpenAI structured-call wrappers (_call_openai_agent, _call_claude_agent)
- The extraction-agent prompt (_build_extraction_prompt)
- Duty-coverage / confidence / key-match helpers used to build the response
- The rejection-response builder

All NOC codes are validated against the local NOC index in ai_service.
"""

import json
import os
import re

import ai_service


# ── Anthropic Client ─────────────────────────────────────────────────────────

_anthropic_client = None

def _get_anthropic_client():
    """Lazy-initialize the Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("[WARNING] ANTHROPIC_API_KEY not set - Claude calls disabled, falling back to GPT-only")
            return None
        import anthropic
        _anthropic_client = anthropic.Anthropic(api_key=api_key)
        print("[Init] Anthropic client initialized")
    return _anthropic_client


# Newer Claude "5" reasoning models reject the `temperature` parameter ("deprecated for this model").
# We learn which models those are at runtime and drop temperature for them, so callers can keep asking
# for temperature=0 without every call site needing to know the model's quirks.
_ANTHROPIC_NO_TEMPERATURE = set()

def _anthropic_create(client, **kwargs):
    """client.messages.create with automatic handling of models that deprecate `temperature`."""
    model = kwargs.get("model", "")
    if model in _ANTHROPIC_NO_TEMPERATURE:
        kwargs.pop("temperature", None)
    try:
        return client.messages.create(**kwargs)
    except Exception as e:
        msg = str(e).lower()
        if "temperature" in kwargs and "temperature" in msg and ("deprecat" in msg or "not support" in msg):
            _ANTHROPIC_NO_TEMPERATURE.add(model)
            kwargs.pop("temperature", None)
            return client.messages.create(**kwargs)
        raise


def _call_gemini_agent(agent_name: str, system_prompt: str, user_message: str,
                       response_format_class, model_override: str = None) -> dict:
    """Call a Gemini agent with native structured output (response_schema). Returns parsed dict.
    Used as the independent, different-lab cross-check in the NOC adjudication step."""
    from google.genai import types
    model = model_override or "gemini-2.5-pro"
    if ai_service.gemini_client is None:
        raise ValueError("Gemini client not initialized")
    print(f"  [{agent_name}] Calling {model}...")
    resp = ai_service.gemini_client.models.generate_content(
        model=model,
        contents=f"{system_prompt}\n\n{user_message}",
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_format_class,
            temperature=0.0,
        ),
    )
    data = json.loads(resp.text)
    try:
        return response_format_class.model_validate(data).model_dump()
    except Exception as e:
        print(f"  [{agent_name}] Schema validation warning: {e}")
        return data


# ── Model Configuration (fallback defaults; callers usually pass model_override) ──

AGENT_MODELS = {
    "extraction": "gpt-4o-mini",
}


# ── OpenAI Agent Call Helper ─────────────────────────────────────────────────

def _call_openai_agent(agent_name: str, system_prompt: str, user_message: str,
                       response_format, model_override: str = None) -> dict:
    """Call an OpenAI agent with structured output. Returns parsed JSON dict."""
    model = model_override or AGENT_MODELS.get(agent_name, "gpt-4o-mini")

    if not ai_service.openai_client:
        raise ValueError("OpenAI client not initialized")

    print(f"  [{agent_name}] Calling {model}...")
    completion = ai_service.openai_client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format=response_format,
        temperature=0.0,
        seed=42,
    )

    return json.loads(completion.choices[0].message.content)


# ── Claude Agent Call Helper ─────────────────────────────────────────────────

def _call_claude_agent(agent_name: str, system_prompt: str, user_message: str,
                       response_format_class, model_override: str = None) -> dict:
    """Call a Claude agent with JSON schema instructions. Returns parsed JSON dict.

    Claude doesn't support OpenAI-style response_format, so we serialize the
    Pydantic schema into the system prompt and parse the JSON response.
    """
    client = _get_anthropic_client()
    if not client:
        raise ValueError("Anthropic client not available")

    model = model_override or AGENT_MODELS.get(agent_name, "claude-haiku-4-20250514")

    # Serialize Pydantic schema for Claude
    schema_json = json.dumps(response_format_class.model_json_schema(), indent=2)
    full_system = (
        f"{system_prompt}\n\n"
        f"=== OUTPUT FORMAT ===\n"
        f"You MUST respond with ONLY a valid JSON object matching this schema:\n"
        f"```json\n{schema_json}\n```\n"
        f"Do NOT include any text before or after the JSON. No markdown fences."
    )

    print(f"  [{agent_name}] Calling {model}...")
    message = _anthropic_create(
        client,
        model=model,
        max_tokens=2000,
        temperature=0.0,
        system=full_system,
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = message.content[0].text.strip()

    # Strip markdown fences if Claude wraps in ```json ... ```
    if raw_text.startswith("```"):
        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text)

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as e:
        print(f"  [{agent_name}] JSON parse error: {e}")
        print(f"  [{agent_name}] Raw response: {raw_text[:500]}")
        raise ValueError(f"Claude returned invalid JSON: {e}")

    # Validate against Pydantic model (catches missing/wrong fields)
    try:
        validated = response_format_class.model_validate(result)
        return validated.model_dump()
    except Exception as e:
        print(f"  [{agent_name}] Schema validation warning: {e}")
        return result  # Return raw dict, pipeline will handle gracefully


# ── Extraction Agent Prompt ─────────────────────────────────────────────────

def _build_extraction_prompt() -> str:
    return """You are a Canadian immigration employment document analyst.

Extract structured information from the input text. The text may be from an employment letter (OCR'd), a job description, or manually typed job details.

=== EXTRACTION RULES ===
- Normalize the job title (e.g., "Sr. QC Eng." → "Senior Quality Control Engineer")
- List each distinct duty as a separate item in main_duties
- Identify the employer's industry from context (company name, products, services)
- Classify the employer type (e.g., "Manufacturing plant", "Software company", "Hospital")

=== PRIMARY FUNCTION CLASSIFICATION ===
Classify based on WHAT THE PERSON ACTUALLY DOES (verbs), not the industry:

- TRADES_PRODUCTION: Physically BUILDS, FABRICATES, WELDS, ASSEMBLES, INSTALLS, REPAIRS
- INSPECTION_QC: INSPECTS, AUDITS, TESTS, REVIEWS certificates, MONITORS quality, WITNESSES processes
- SUPERVISION_MANAGEMENT: MANAGES schedules, HIRES staff, ASSIGNS work, COORDINATES teams
- ENGINEERING_DESIGN: DESIGNS systems, CALCULATES specs, DEVELOPS programs, OPTIMIZES processes
- ADMINISTRATIVE_CLERICAL: DATA ENTRY, FILING, SCHEDULING, CORRESPONDENCE
- SALES_SERVICE: SELLS products/services to customers, manages commercial ACCOUNTS, handles COMPLAINTS
- HEALTHCARE: PATIENT CARE, CLINICAL procedures, THERAPY
- EDUCATION_TRAINING: TEACHES, TRAINS, develops CURRICULUM
- IT_TECHNICAL: DEVELOPS software, ADMINISTERS systems, TECHNICAL support
- TRANSPORT_LOGISTICS: DRIVES, SHIPPING, WAREHOUSING, SUPPLY CHAIN
- OTHER: Genuinely doesn't fit any of the above categories

CRITICAL: Verbs reveal function, nouns reveal domain. Always classify by verbs.

=== DOCUMENT VALIDATION ===
Set document_valid=false ONLY if:
- Blank, corrupted, or unreadable text
- Document is a payslip, T4, ID, or contract WITHOUT any duties
- Fewer than 2 meaningful duties
Otherwise set document_valid=true.

=== LOCATION ===
- Canadian address/province → "canada"
- Non-Canadian location → "outside_canada"
- Unclear → "unknown"

Output your extraction in the requested JSON schema."""


# ── Duty-coverage / key-match helpers ─────────────────────────────────────────

# Shared stop-word set for the lightweight word-overlap heuristics below.
STOP_WORDS = {"and", "the", "to", "of", "in", "for", "a", "with", "on", "as",
              "is", "by", "or", "an", "at", "from"}


def _build_key_matches(extraction: dict, noc_entry: dict | None) -> list:
    """Build key_matches: the applicant responsibilities that align with an
    official NOC duty (word-overlap heuristic).

    Returns up to 5 applicant-duty strings that overlap a NOC duty. If none
    overlap lexically (a strong match can still be purely semantic), falls back
    to the applicant's primary duties so the section isn't empty on a real match.
    """
    if not noc_entry or not extraction:
        return []

    applicant_duties = extraction.get("main_duties", [])
    noc_duties = noc_entry.get("duties", [])

    if not applicant_duties or not noc_duties:
        return []

    matches = []
    for a_duty in applicant_duties[:8]:
        a_words = set(a_duty.lower().split()) - STOP_WORDS
        for n_duty in noc_duties:
            n_words = set(n_duty.lower().split()) - STOP_WORDS
            # Note the parentheses: intersect first, then drop stop words.
            # The previous version relied on `-` binding tighter than `&`.
            if len((a_words & n_words)) >= 3:
                matches.append(a_duty.strip())
                break
        if len(matches) >= 5:
            break

    # Lexical overlap found nothing — surface the applicant's stated duties rather
    # than an empty list, since the match may be semantic (see _duty_coverage).
    if not matches:
        matches = [d.strip() for d in applicant_duties[:3]]

    return matches[:5]


def _build_key_gaps(extraction: dict, noc_entry: dict | None) -> list:
    """Build key_gaps — NOC duties not covered by the applicant's work.

    Returns up to 3 strings describing missing areas.
    """
    if not noc_entry:
        return []

    applicant_duties = " ".join(extraction.get("main_duties", [])).lower()
    noc_duties = noc_entry.get("duties", [])
    gaps = []

    for n_duty in noc_duties:
        n_words = set(n_duty.lower().split()) - STOP_WORDS
        overlap_count = sum(1 for w in n_words if w in applicant_duties)
        if len(n_words) > 0 and (overlap_count / len(n_words)) < 0.25:
            gaps.append(f"NOC duty not covered: {n_duty.strip()}")
        if len(gaps) >= 3:
            break

    return gaps


def _count_duty_coverage(extraction: dict, noc_entry: dict | None) -> tuple[int, int]:
    """Count how many NOC duties the applicant covers using word-overlap analysis.

    Returns (covered_count, total_count). This replaces the LLM's self-reported
    duties_matched/duties_total which are always optimistic (often 100%).

    Uses the same word-overlap threshold as _build_key_gaps (25%) to ensure
    consistency between the confidence score and the displayed gaps.
    """
    if not noc_entry:
        return (0, 0)

    applicant_duties = " ".join(extraction.get("main_duties", [])).lower()
    noc_duties = noc_entry.get("duties", [])

    if not noc_duties or not applicant_duties.strip():
        return (0, 0)

    covered = 0

    for n_duty in noc_duties:
        n_words = set(n_duty.lower().split()) - STOP_WORDS
        if len(n_words) == 0:
            continue
        overlap_count = sum(1 for w in n_words if w in applicant_duties)
        if (overlap_count / len(n_words)) >= 0.25:
            covered += 1

    return (covered, len(noc_duties))


def _duty_coverage(extraction: dict, noc_entry: dict | None) -> tuple[int, int]:
    """Return (matched, total) duty coverage for a NOC, semantic-first.

    Prefers the SEMANTIC per-duty coverage computed during RAG reranking — carried
    on the entry as `_pre_computed_duties_matched` / `_pre_computed_duties_total`
    (embedding-similarity based, so it credits synonyms like "operate" ≈ "run").
    This is the signal the multi-model pipeline already paid to compute; using it
    here means the headline confidence reflects semantic duty alignment instead of
    raw lexical overlap, which systematically deflated scores.

    Falls back to lexical word-overlap (`_count_duty_coverage`) for entries that
    never went through reranking — e.g. a voter-suggested out-of-database code.
    """
    if noc_entry:
        total = noc_entry.get("_pre_computed_duties_total")
        matched = noc_entry.get("_pre_computed_duties_matched")
        if total and matched is not None:
            return (int(matched), int(total))
    return _count_duty_coverage(extraction, noc_entry)


def _confidence_from_coverage(matched: int, total: int) -> int:
    """Confidence (0-100) from duty coverage, matching the schema contract."""
    if total <= 0:
        return 0
    return min(100, max(0, round((matched / total) * 100)))


def _alt_confidence(extraction: dict, code: str, top_nocs: dict) -> int:
    """Honest confidence for an alternative NOC, scored the same way as the primary."""
    if not code:
        return 0
    entry = top_nocs.get(code) or ai_service.get_noc_entry(code)
    matched, total = _duty_coverage(extraction, entry)
    return _confidence_from_coverage(matched, total)


# ── Response Builders ─────────────────────────────────────────────────────

def _build_rejection_response(extraction: dict) -> dict:
    """Build a NOCFinderResponseSchema-compatible rejection for invalid documents."""
    return {
        "document_valid": False,
        "rejection_reason": extraction.get("rejection_reason", "Document is invalid."),
        "role_name": extraction.get("job_title", "Unknown"),
        "company_name": extraction.get("employer_name", "Unknown"),
        "result_type": "NO_MATCH",
        "recommended_noc": {
            "code": "00000", "title": "N/A",
            "confidence": 0, "duties_total": 0, "duties_matched": 0,
        },
        "confidence_level": "low",
        "why_this_noc": extraction.get("rejection_reason", ""),
        "key_matches": [],
        "key_gaps": [],
        "alternatives": [],
        "input_reliability": "low",
        "location_of_experience": extraction.get("location", "unknown"),
        "important_note": "This document could not be evaluated.",
        "next_step": "Please upload a valid employment letter with job duties.",
    }
