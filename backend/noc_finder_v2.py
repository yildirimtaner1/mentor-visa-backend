"""Knowledge-First Multi-Model NOC Finder (v2)
================================================

Replaces the RAG-first pipeline (noc_agents.run_multi_agent_noc_finder). The old
design embedded the letter, retrieved ~40 vocabulary-similar NOCs, and forced the
model to pick from that shortlist — so when retrieval surfaced the wrong neighbours
(e.g. a debt-collection letter clustering near bank-teller / financial-sales), the
correct code was unreachable. Every prompt patch was a band-aid on that.

v2 is knowledge-first, the way a human NOC consultant works:

  Stage 1  Extraction        gpt-4o-mini    parse letter -> structured profile
  Stage 2  Dual proposers    Claude Haiku + gpt-4o-mini (parallel) — name the top
                             occupation TITLES from each model's own NOC knowledge,
                             NO codes. Genuine model diversity maximises recall.
  Stage 3  Grounding         LOCAL index    resolve titles -> official 5-digit codes
                             (exact + fuzzy), unioned with a few embedding candidates
                             as a recall safety-net. Free, instant, no hallucination.
  Stage 4  Auditor           Claude Sonnet  read the OFFICIAL duty lists + lead
                             statements (employer type) + TEER for every grounded
                             candidate and pick the single best + confidence.

Output conforms to NOCFinderResponseSchema, so the frontend needs zero changes.
"""

import difflib
import json
import time
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel, Field
from typing import List

import ai_service
import noc_agents
from models import ExtractionAgentResponse


# ── Model configuration (the cost/accuracy strategy) ──────────────────────────
V2_MODELS = {
    "extractor":      "gpt-4o-mini",                # cheap, reliable structured parse
    "claude_proposer": "claude-haiku-4-5-20251001",  # diverse proposer A (Anthropic)
    "gpt_proposer":    "gpt-4o-mini",                # diverse proposer B (OpenAI)
    "auditor":        "claude-sonnet-4-6",          # primary decision (Anthropic)
    "cross_check":    "gpt-4o",                      # 2nd opinion on HARD cases only (OpenAI)
    "tiebreak":       "claude-sonnet-4-6",           # resolves auditor vs cross-check disagreement
}

# How many embedding-retrieval candidates to union in as a recall safety-net.
# These are OPTIONS for the auditor, never a constraint on the choice.
EMBED_RECALL_K = 6
# Cap on total candidates handed to the auditor (keeps the prompt focused).
MAX_AUDITOR_CANDIDATES = 12

# Confidence is derived from applicant-side semantic precision via the shared single-source-of-truth
# function ai_service.noc_match_confidence() (also used by the Letter Auditor — see _semantic_confidence).


# ── Schemas ───────────────────────────────────────────────────────────────────
class _TitleCandidate(BaseModel):
    title: str = Field(description="Exact NOC 2021 occupation title (no code numbers)")
    teer: int = Field(description="TEER level 0-5 you believe this occupation sits at")
    rationale: str = Field(description="1 sentence: why this occupation fits the duties")


class ProposerResponse(BaseModel):
    """Top occupation TITLES proposed from the model's own NOC 2021 knowledge."""
    candidates: List[_TitleCandidate] = Field(
        description="Top 3-5 best-matching NOC 2021 occupation titles, best first"
    )


class AuditorResponse(BaseModel):
    """Final pick, grounded in the official duty lists of the candidate codes."""
    winning_code: str = Field(description="The 5-digit code of the single best candidate")
    reasoning: str = Field(description="2-3 sentences: why this code, citing duties + employer type")
    duties_total: int = Field(description="Total official main duties for the winning NOC")
    duties_matched: int = Field(description="How many of those duties the applicant clearly performs")
    employer_type_match: str = Field(default="", description="How the employer type fits the NOC's lead statement")
    alternative_code: str = Field(default="", description="5-digit code of the runner-up, or empty")
    alternative_reason: str = Field(default="", description="Why the runner-up is second, or empty")


# ── Prompts ───────────────────────────────────────────────────────────────────
def _build_proposer_prompt() -> str:
    return """You are a Canadian NOC 2021 occupation classification expert.

Given a structured job profile, name the TOP 3-5 best-matching NOC 2021 occupation
TITLES from your own knowledge of the classification.

=== HOW TO CHOOSE (think like an IRCC officer) ===
- Classify by FUNCTION — what the person actually DOES day to day. The job title on the
  letter and the employer's name are often marketing labels; do not anchor on them.
- Employer/industry is a SUPPORTING clue, not the deciding factor. Use it only to break a
  tie when two occupations fit the duties equally well.
- OUTSOURCING / STAFFING / MARKETING / PROMOTIONS / CALL-CENTRE / BPO agencies: the agency's
  OWN industry does NOT define the occupation. Classify by the work actually performed, often
  for an end client. E.g. someone at a marketing agency who sells a bank's financial products
  is doing financial-product sales; someone placed by a staffing agency onto a factory line is
  doing that factory job.
- A frequent keyword (an industry, product, or material) is NOT necessarily the function.

=== RULES ===
- Give TITLES ONLY. Do NOT output any 5-digit NOC code numbers — codes are looked up
  officially afterward.
- Use the exact official NOC 2021 occupation wording you remember (e.g. "Collection clerks",
  "Software developers and programmers").
- Order best-match first.

TEER levels: 0=management, 1=university degree, 2=college/apprenticeship,
3=high school + training, 4=high school, 5=no formal education required."""


def _build_auditor_prompt() -> str:
    return """You are a senior Canadian NOC 2021 classification specialist making the final decision.

You are given an applicant's structured profile and a list of CANDIDATE NOC codes, each
with its OFFICIAL title, lead statement (which names the employer types where the
occupation is found) and official main duties.

Pick the SINGLE best NOC code for this applicant.

=== DECISION METHOD ===
1. PRIMARY: read the official main duties of each candidate and count how many the applicant
   clearly performs. The strongest duty match wins.
2. The lead statement / employer type is a SUPPORTING signal — use it only to break a tie when
   two candidates fit the duties equally well. It does NOT override a strong duty match.
   Caveat: when the employer is an outsourcing, staffing, marketing, promotions or call-centre
   agency, the agency's own industry does NOT define the occupation — classify by the work the
   person actually performs (often for an end client). Do NOT reject an otherwise strong
   duty-matched occupation just because its lead statement names a different employer setting
   than the agency.
3. Verify the TEER level fits the applicant's level of responsibility.
4. Ignore the job title on the letter if it conflicts with the duties — titles are often
   marketing labels.
5. SETTING-SPECIFIC vs GENERAL codes: some NOC pairs differ only by work setting — a specialized
   code (e.g. 13111 Legal administrative assistants, 13112 Medical administrative assistants) and a
   GENERAL code (e.g. 13110 Administrative assistants). Choose the specialized code ONLY when the
   applicant performs its DEFINING duties (the duties unique to that setting — e.g. preparing legal
   documents such as deeds, wills, affidavits and briefs for 13111). If the applicant only performs
   GENERIC duties of that occupation (filing, scheduling, correspondence, supplies) and the legal /
   medical / etc. setting is merely the backdrop, the GENERAL code is the correct primary and the
   specialized code is at most a close runner-up. Working near a setting is NOT performing its
   specialized function.

Choose the winner and a runner-up. For multi-title NOC groups (one code covering several distinct
occupations, e.g. 51114 Translators / terminologists / interpreters), pick the code if the applicant
clearly matches ANY one of its occupation types — do not reject it because the applicant doesn't
perform the OTHER types' duties.

Report duty coverage HONESTLY (duties_matched out of the winner's duties_total). Base duties_matched
on real evidence in the applicant's duties, not optimism.

=== REASONING — STATE ONLY WHAT IS IN THE PROFILE ===
In `reasoning`, justify the choice using ONLY facts present in the applicant's structured profile.
Do NOT assert an employer name, industry, or setting that is not actually stated — if the employer
type / industry is empty or "unknown", reason from the DUTIES alone and do not claim the employer is
"explicitly" in any sector. Never invent context to support the chosen NOC."""


# ── Title -> code grounding (local, free) ─────────────────────────────────────
_TITLE_KEYS = None  # lazy: list of lowercased official titles


def _ground_title_to_code(title: str) -> str | None:
    """Resolve a model-proposed occupation title to an official 5-digit code using the
    LOCAL index: exact match -> fuzzy match -> embedding fallback. Returns code or None."""
    global _TITLE_KEYS
    if not title:
        return None
    key = title.lower().strip()

    # 1. Exact official-title match
    if key in ai_service.NOC_TITLE_TO_CODE:
        return ai_service.NOC_TITLE_TO_CODE[key]

    # 2. Fuzzy match against the 516 official titles (handles singular/plural, wording)
    if _TITLE_KEYS is None:
        _TITLE_KEYS = list(ai_service.NOC_TITLE_TO_CODE.keys())
    close = difflib.get_close_matches(key, _TITLE_KEYS, n=1, cutoff=0.6)
    if close:
        return ai_service.NOC_TITLE_TO_CODE[close[0]]

    # 3. Embedding fallback: search the index with the title text, take the top code
    try:
        ranked = ai_service.semantic_search_nocs(title)
        if ranked:
            return next(iter(ranked.keys()))
    except Exception:
        pass
    return None


def _collect_candidate_codes(proposals: list, embed_candidates: dict) -> list:
    """Union model-proposed (grounded) codes with embedding-recall codes, dedup, cap."""
    ordered = []
    seen = set()

    # Model proposals first (knowledge-first), in the order proposed
    for title in proposals:
        code = _ground_title_to_code(title)
        if code and code not in seen and code in ai_service.NOC_CODE_TO_ENTRY:
            seen.add(code)
            ordered.append(code)

    # Then embedding recall as a safety-net
    for code in embed_candidates:
        if code not in seen and code in ai_service.NOC_CODE_TO_ENTRY:
            seen.add(code)
            ordered.append(code)

    return ordered[:MAX_AUDITOR_CANDIDATES]


def _format_candidates_for_auditor(codes: list) -> str:
    out = []
    for code in codes:
        e = ai_service.get_noc_entry(code)
        if not e:
            continue
        out.append({
            "code": code,
            "title": e.get("title", ""),
            "teer_digit": code[1] if len(code) >= 2 else "?",
            "lead_statement": e.get("lead_statement", ""),
            "main_duties": e.get("duties", [])[:10],
        })
    return json.dumps(out, indent=2, ensure_ascii=False)


def _top_grounded(titles: list) -> str | None:
    """First model-proposed title that grounds to a real code (the proposer's top pick)."""
    for t in titles:
        code = _ground_title_to_code(t)
        if code and code in ai_service.NOC_CODE_TO_ENTRY:
            return code
    return None


def _call_auditor(model: str, extraction: dict, codes: list, extra_note: str = "") -> dict:
    """Run one auditor over `codes` with the given model. Returns the parsed dict.
    Routes Claude models to the Anthropic helper and everything else to OpenAI."""
    msg = (
        f"=== APPLICANT PROFILE ===\n{json.dumps(extraction, indent=2, ensure_ascii=False)}\n\n"
        f"=== CANDIDATE NOC CODES (official data) ===\n{_format_candidates_for_auditor(codes)}"
    )
    if extra_note:
        msg += f"\n\n=== NOTE ===\n{extra_note}"
    prompt = _build_auditor_prompt()
    if model.startswith("claude"):
        return noc_agents._call_claude_agent("auditor", prompt, msg, AuditorResponse, model_override=model)
    return noc_agents._call_openai_agent("auditor", prompt, msg, AuditorResponse, model_override=model)


def _pick_from_auditor(auditor: dict, codes: list) -> str:
    """The auditor must choose from the provided candidates; else fall back to the first."""
    cand = (auditor.get("winning_code", "") or "").strip()
    return cand if cand in codes else codes[0]


def _adjudicate(extraction: dict, codes: list, claude_titles: list, gpt_titles: list) -> tuple[str, dict, str]:
    """Option-4 escalation: one Sonnet auditor normally; a GPT cross-check ONLY when the two
    proposers disagree on their top pick (a free 'hard case' signal); a Sonnet tie-break only
    when the cross-check then disagrees with the primary auditor.

    Returns (winning_code, auditor_dict_used, path_label).
    """
    primary = _call_auditor(V2_MODELS["auditor"], extraction, codes)
    code_primary = _pick_from_auditor(primary, codes)
    print(f"[Stage 4] Primary auditor ({V2_MODELS['auditor']}): {code_primary} "
          f"({ai_service.NOC_LOOKUP.get(code_primary,'?')})")

    # Hard-case trigger: the two proposers' top grounded picks differ. Cheap signal, no extra call.
    cc, gg = _top_grounded(claude_titles), _top_grounded(gpt_titles)
    hard = bool(cc and gg and cc != gg)
    if not hard:
        return code_primary, primary, "primary"

    # Cross-check with a different provider (genuine diversity) — only on hard cases.
    print(f"[Stage 4] HARD case (proposers split: {cc} vs {gg}) — cross-checking with {V2_MODELS['cross_check']}")
    try:
        cross = _call_auditor(V2_MODELS["cross_check"], extraction, codes)
        code_cross = _pick_from_auditor(cross, codes)
    except Exception as e:
        print(f"[Stage 4] Cross-check failed ({e}) — keeping primary")
        return code_primary, primary, "primary(cross-failed)"

    if code_cross == code_primary:
        print(f"[Stage 4] Cross-check agrees: {code_primary}")
        return code_primary, primary, "agreed"

    # Disagreement -> Sonnet tie-break, limited to the two contested codes, seeing both rationales.
    print(f"[Stage 4] Disagreement: primary={code_primary} vs cross={code_cross} — tie-breaking")
    contested = [c for c in [code_primary, code_cross] if c in ai_service.NOC_CODE_TO_ENTRY]
    note = (
        "Two expert auditors disagree. Decide between ONLY these codes, by duty alignment.\n"
        f"- Auditor A chose {code_primary}: {primary.get('reasoning','')[:300]}\n"
        f"- Auditor B chose {code_cross}: {cross.get('reasoning','')[:300]}"
    )
    try:
        tb = _call_auditor(V2_MODELS["tiebreak"], extraction, contested, extra_note=note)
        code_tb = _pick_from_auditor(tb, contested)
        print(f"[Stage 4] Tie-break ({V2_MODELS['tiebreak']}): {code_tb}")
        return code_tb, tb, "tiebreak"
    except Exception as e:
        print(f"[Stage 4] Tie-break failed ({e}) — keeping primary {code_primary}")
        return code_primary, primary, "primary(tiebreak-failed)"


# Content-addressed result cache. Guarantees the NOC Finder and the Letter Auditor return the
# IDENTICAL code + confidence for the same letter: the Auditor reaches v2 via auto_detect_noc(),
# so a cache hit on the same text reuses the Finder's exact computation instead of re-running the
# (mildly non-deterministic) extraction. Bounded; text-only inputs (no page images).
_RESULT_CACHE: "dict[str, dict]" = {}
_RESULT_CACHE_MAX = 256


def _cache_key(text: str) -> str:
    import hashlib
    return hashlib.sha1(" ".join((text or "").split()).encode("utf-8")).hexdigest()


# ── Pipeline ──────────────────────────────────────────────────────────────────
def run_noc_finder_v2(user_content: str, page_images=None, target_noc: str = None, from_document: bool = False) -> dict:
    """Run the knowledge-first multi-model NOC Finder. Returns NOCFinderResponseSchema dict.

    target_noc: when set, lock the result to that NOC (re-evaluation / alternative / manual code) and
    skip proposing+adjudication — it is still scored honestly via semantic precision + duty-by-duty.
    from_document: True when the input is an uploaded letter/document (drives input_reliability)."""
    t_start = time.time()
    # Serve repeat calls on the same letter from cache (text-only) for Finder/Auditor consistency.
    # Never cache targeted evals — the cache key is the letter only, not the requested code.
    cache_key = _cache_key(user_content) if (not page_images and not target_noc) else None
    if cache_key and cache_key in _RESULT_CACHE:
        import copy
        print("[v2] cache hit — returning identical result (Finder/Auditor consistency)")
        return copy.deepcopy(_RESULT_CACHE[cache_key])
    cleaned, stripped = ai_service.strip_employer_noc_references(user_content)
    if stripped:
        print("[v2] Stripped employer NOC references from input")

    print(f"\n{'='*60}\n[NOC Finder v2] knowledge-first pipeline\n{'='*60}")

    # ── Stage 1: Extraction ──────────────────────────────────────────────────
    t0 = time.time()
    extraction = noc_agents._call_openai_agent(
        "extraction", noc_agents._build_extraction_prompt(),
        f"=== DOCUMENT TEXT ===\n{cleaned}", ExtractionAgentResponse,
        model_override=V2_MODELS["extractor"],
    )
    print(f"[Stage 1] Extraction: title=\"{extraction.get('job_title','?')}\" "
          f"employer=\"{extraction.get('employer_type','?')}\" ({time.time()-t0:.1f}s)")
    # ── Targeted evaluation: lock to the requested NOC, skip proposing/adjudication ──────────
    # Scored the SAME way as a fresh result (Auditor / semantic), so a forced code shows its true
    # (possibly low) fit — never the old single-prompt "100/100". This runs BEFORE the strict
    # document-validity gate on purpose: the user already got a result for this document and is
    # deliberately re-checking it against a chosen code, so a borderline/non-deterministic extraction
    # rejection must not block the re-evaluation ("Could not validate input" bug).
    if target_noc and target_noc in ai_service.NOC_LOOKUP:
        result = _build_v2_response(target_noc, None, extraction, [target_noc], from_document=from_document, letter_text=cleaned)
        result = ai_service._sanitize_noc_response(result, recompute_confidence=False)
        rec = result.get("recommended_noc", {})
        print(f"[v2] TARGETED {target_noc}: {rec.get('confidence')}% coverage={result.get('duty_coverage')}% "
              f"({time.time()-t_start:.1f}s)")
        return result

    if not extraction.get("document_valid", True):
        print(f"[v2] REJECTED: {extraction.get('rejection_reason')}")
        return noc_agents._build_rejection_response(extraction)

    # ── Stage 2: Dual proposers (Claude + GPT, in parallel) ──────────────────
    t0 = time.time()
    duties_text = "; ".join(extraction.get("main_duties", [])[:12])
    proposer_msg = (
        f"=== JOB PROFILE ===\n"
        f"Job title (as written): {extraction.get('job_title','')}\n"
        f"Employer type / industry: {extraction.get('employer_type','')} / {extraction.get('industry','')}\n"
        f"Management level: {extraction.get('management_level','none')}\n"
        f"Primary function: {extraction.get('primary_function','')}\n"
        f"Duties: {duties_text}"
    )
    prompt = _build_proposer_prompt()

    def run_claude():
        return noc_agents._call_claude_agent(
            "claude_proposer", prompt, proposer_msg, ProposerResponse,
            model_override=V2_MODELS["claude_proposer"])

    def run_gpt():
        return noc_agents._call_openai_agent(
            "gpt_proposer", prompt, proposer_msg, ProposerResponse,
            model_override=V2_MODELS["gpt_proposer"])

    claude_titles, gpt_titles = [], []
    claude_available = noc_agents._get_anthropic_client() is not None
    if claude_available:
        with ThreadPoolExecutor(max_workers=2) as ex:
            f_claude, f_gpt = ex.submit(run_claude), ex.submit(run_gpt)
            try:
                claude_titles = [c.get("title", "") for c in f_claude.result(timeout=40).get("candidates", [])]
            except Exception as e:
                print(f"[Stage 2] Claude proposer failed: {e}")
            try:
                gpt_titles = [c.get("title", "") for c in f_gpt.result(timeout=40).get("candidates", [])]
            except Exception as e:
                print(f"[Stage 2] GPT proposer failed: {e}")
    else:
        try:
            gpt_titles = [c.get("title", "") for c in run_gpt().get("candidates", [])]
        except Exception as e:
            print(f"[Stage 2] GPT proposer failed: {e}")

    # Interleave so both models' top picks are near the front
    proposals = []
    for pair in zip(claude_titles, gpt_titles):
        proposals.extend(pair)
    proposals.extend(claude_titles[len(gpt_titles):])
    proposals.extend(gpt_titles[len(claude_titles):])
    print(f"[Stage 2] Proposed titles: Claude={claude_titles} GPT={gpt_titles} ({time.time()-t0:.1f}s)")

    # ── Stage 3: Ground titles -> codes + embedding recall net ────────────────
    t0 = time.time()
    try:
        embed_candidates = ai_service.semantic_search_nocs(cleaned)
    except Exception as e:
        print(f"[Stage 3] Embedding recall failed (non-fatal): {e}")
        embed_candidates = {}
    embed_top = dict(list(embed_candidates.items())[:EMBED_RECALL_K])
    codes = _collect_candidate_codes(proposals, embed_top)
    print(f"[Stage 3] Grounded candidates ({len(codes)}): "
          f"{[(c, ai_service.NOC_LOOKUP.get(c,'?')) for c in codes[:8]]} ({time.time()-t0:.1f}s)")

    if not codes:
        # Nothing grounded — fall back to the embedding top pick
        if embed_candidates:
            top_code = next(iter(embed_candidates))
            codes = [top_code]
        else:
            print("[v2] No candidates at all — rejecting")
            return noc_agents._build_rejection_response(extraction)

    # ── Stage 4: Adjudication (Option 4: escalate-on-hard) ───────────────────
    t0 = time.time()
    winning_code, auditor = codes[0], None
    try:
        winning_code, auditor, path = _adjudicate(extraction, codes, claude_titles, gpt_titles)
        print(f"[Stage 4] Decision: {winning_code} ({ai_service.NOC_LOOKUP.get(winning_code,'?')}) "
              f"via {path} ({time.time()-t0:.1f}s)")
    except Exception as e:
        print(f"[Stage 4] Adjudication failed ({e}) — using top grounded candidate {winning_code}")

    # ── Build response (frontend-compatible) ──────────────────────────────────
    result = _build_v2_response(winning_code, auditor, extraction, codes, from_document=from_document, letter_text=cleaned)
    # recompute_confidence=False: v2 already set a calibrated semantic-precision confidence;
    # the sanitizer's recall-style matched/total recompute would clobber it (and break 51114).
    result = ai_service._sanitize_noc_response(result, recompute_confidence=False)

    rec = result.get("recommended_noc", {})
    print(f"\n{'='*60}\n[v2] RESULT: {rec.get('code')} - {rec.get('title')} "
          f"({rec.get('confidence')}% {result.get('result_type')}) in {time.time()-t_start:.1f}s\n{'='*60}\n")

    if cache_key is not None:
        if len(_RESULT_CACHE) >= _RESULT_CACHE_MAX:
            _RESULT_CACHE.pop(next(iter(_RESULT_CACHE)), None)  # evict oldest
        import copy
        _RESULT_CACHE[cache_key] = copy.deepcopy(result)
    return result


def _semantic_confidence(applicant_duties: list, code: str):
    """Delegates to ai_service.noc_match_confidence — the SINGLE source of truth shared with the
    Letter Auditor, so both tools report the same NOC-match confidence for the same letter+code."""
    return ai_service.noc_match_confidence(applicant_duties, code)


def _build_v2_response(winning_code: str, auditor: dict | None,
                       extraction: dict, candidate_codes: list, from_document: bool = False,
                       letter_text: str = "") -> dict:
    """Assemble a NOCFinderResponseSchema dict from the auditor's grounded decision."""
    auditor = auditor or {}
    noc_entry = ai_service.get_noc_entry(winning_code)
    official_title = ai_service.NOC_LOOKUP.get(winning_code, "Unknown")

    # Confidence: applicant-side SEMANTIC PRECISION — "does each duty the applicant performs map
    # into this NOC?" This is robust to multi-title NOC groups (e.g. 51114), where recall against
    # the full duty list catastrophically under-scores someone who matches just one sub-title.
    # The lexical word-overlap coverage is kept only as a floor (it can lift, never deflate).
    applicant_duties = extraction.get("main_duties", []) or []
    lex_matched, lex_total = noc_agents._duty_coverage(extraction, noc_entry)
    lex_conf = noc_agents._confidence_from_coverage(lex_matched, lex_total)

    sem = _semantic_confidence(applicant_duties, winning_code)
    if sem is not None:
        sem_conf, _sem_matched, _sem_total = sem   # applicant-side precision — drives confidence only
        confidence = max(sem_conf, lex_conf)        # semantic primary; lexical is a floor only
    else:
        # Embeddings unavailable — fall back to the auditor count / lexical heuristic.
        a_total = auditor.get("duties_total", 0) or 0
        a_matched = auditor.get("duties_matched", 0) or 0
        auditor_pct = (a_matched / a_total) if a_total > 0 else 0
        lex_pct = (lex_matched / lex_total) if lex_total > 0 else 0
        confidence = min(100, max(0, round(max(auditor_pct, lex_pct) * 100)))

    # The DISPLAYED "X / Y duties" must be NOC-side COVERAGE computed on the same basis as
    # key_gaps/key_matches (word-overlap over the NOC's official duties), so the headline fraction
    # can never contradict the listed gaps. (Confidence above is a separate, semantic "is this the
    # right NOC?" signal — the precision count is intentionally NOT shown as the duty fraction.)
    disp_matched, disp_total = noc_agents._count_duty_coverage(extraction, noc_entry)
    if disp_total <= 0:  # no NOC duties to score against — fall back so we never show "0/0"
        disp_matched, disp_total = lex_matched, lex_total

    # Alternative confidence: use the recall-style score (matched / alt-NOC duties), which reads
    # as appropriately SECONDARY. We deliberately do NOT use applicant-side precision here —
    # precision can't separate sibling NOCs (e.g. collection vs. financial-sales), so it would
    # inflate a runner-up to ~100%. The auditor already ranked this code below the winner, so we
    # also cap it below the primary's confidence to keep the ranking visually honest.
    alternatives = []
    alt_code = (auditor.get("alternative_code", "") or "").strip()
    if (not alt_code or alt_code == winning_code) and len(candidate_codes) > 1:
        alt_code = next((c for c in candidate_codes if c != winning_code), "")
    if alt_code and alt_code in ai_service.NOC_LOOKUP:
        alt_conf = min(noc_agents._alt_confidence(extraction, alt_code, {}), max(confidence - 1, 0))
        alternatives.append({
            "code": alt_code,
            "title": ai_service.NOC_LOOKUP.get(alt_code, ""),
            "confidence": alt_conf,
        })

    if confidence >= 70:
        result_type, level = "STRONG_MATCH", "high"
    elif confidence >= 45:
        result_type, level = "MODERATE_MATCH", "medium"
    else:
        result_type, level = "NO_MATCH", "low"

    # NOC-side duty analysis (same basis as the Employment Letter Auditor): coverage = official NOC
    # duties demonstrated / total official duties, scoped to the applicant's sub-occupation. The
    # gauge, gaps, and duty-by-duty breakdown all come from this ONE scoped duty set, so they agree.
    # PRIMARY: reuse the Employment Letter Auditor's EXACT grading against the winning code, so the
    # Finder's coverage + duty-by-duty breakdown are identical to the Auditor's (option c). Falls back
    # to the deterministic semantic analysis when there's no letter text or the Auditor rejects the input
    # (e.g. typed job-title/duties rather than a real letter).
    full_audit_result = None  # the complete Auditor result, surfaced for the "Audit my letter" reuse cache
    # Document uploads run the FULL Auditor (exact convergence with the paid Auditor). Typed text uses
    # the gpt-4o grader below instead — the full Auditor rejects non-letters, and text is lower-signal.
    audit_cov = ai_service.audit_duty_coverage(letter_text, winning_code) if (from_document and letter_text) else None
    if audit_cov:
        duty_cov = audit_cov["coverage"]
        coverage_subtitle = audit_cov["sub_title"]
        breakdown = audit_cov["duties_breakdown"]
        scoped_gaps = audit_cov["key_gaps"]
        full_audit_result = audit_cov.get("_full_audit")
        _cov = sum(1 for b in breakdown if b["match"] in ("strong", "partial"))
        disp_matched, disp_total = _cov, len(breakdown)
    else:
        analysis = ai_service.finder_noc_analysis(applicant_duties, winning_code, role_hint=extraction.get("job_title", ""))
        if analysis:
            coverage_subtitle = analysis["sub_title"]
            set_duties = analysis.get("set_duties") or []
            # Text input (the full Auditor rejects non-letters): grade the scoped duties with gpt-4o using
            # the Auditor's rubric, so coverage converges with what the Auditor would produce. Semantic is
            # the last-resort fallback if the grader fails.
            graded = ai_service.grade_scoped_duties_llm(letter_text or "; ".join(applicant_duties), set_duties)
            if graded and set_duties and len(graded) == len(set_duties):
                covered = sum(1 for g in graded if g["match"] in ("strong", "partial"))
                duty_cov = int(round(100 * covered / len(set_duties)))
                breakdown = graded
                scoped_gaps = [g["noc_duty"] for g in graded if g["match"] in ("weak", "missing")]
                disp_matched, disp_total = covered, len(set_duties)
            else:
                duty_cov = analysis["coverage"]
                breakdown = analysis["duties_breakdown"]
                scoped_gaps = analysis["key_gaps"]
                disp_matched, disp_total = analysis["covered"], analysis["total"]
        else:
            duty_cov = int(round(100 * disp_matched / disp_total)) if disp_total else 0
            coverage_subtitle = ""
            breakdown = []
            scoped_gaps = noc_agents._build_key_gaps(extraction, noc_entry)

    # The duty-by-duty breakdown shows the applicant's OWN duties (letter-centric): keep only entries
    # with evidence in the letter (strong/partial/weak). Official duties with NO evidence ("missing")
    # are surfaced separately as gaps, not as breakdown rows.
    breakdown = [b for b in (breakdown or []) if b.get("match") != "missing"]

    # Summary. Auto-detect uses the adjudicator's reasoning; a targeted re-evaluation has no reasoning,
    # so build an informative coverage summary instead of the old one-line generic fallback.
    why_this_noc = (auditor.get("reasoning") if auditor else "") or (
        f"Evaluated against NOC {winning_code} — {official_title}. Your experience demonstrates "
        f"{disp_matched} of {disp_total} of this NOC's official main duties ({duty_cov}% coverage)."
        if disp_total else f"Evaluated against NOC {winning_code} — {official_title}."
    )

    return {
        "document_valid": True,
        "rejection_reason": "",
        "role_name": extraction.get("job_title", "Unknown"),
        "company_name": extraction.get("employer_name", "Unknown"),
        "result_type": result_type,
        "recommended_noc": {
            "code": winning_code,
            "title": official_title,
            "confidence": confidence,
            "duties_total": disp_total,
            "duties_matched": disp_matched,
        },
        "duty_coverage": duty_cov,
        "coverage_subtitle": coverage_subtitle,  # sub-occupation the coverage is scoped to (multi-title NOCs)
        # Transient: full Auditor result for the "Audit my letter" reuse cache. The endpoint pops this
        # before saving/returning, so it is never persisted or sent to the client.
        "_audit_full": full_audit_result,
        "confidence_level": level,
        "why_this_noc": why_this_noc,
        "key_matches": noc_agents._build_key_matches(extraction, noc_entry),
        # Official NOC duties NOT yet demonstrated (same scoped set as the coverage gauge).
        "key_gaps": scoped_gaps,
        # Letter-duty -> official-NOC-duty pairing with a match verdict (deterministic, embedding-based).
        "duties_breakdown": breakdown,
        "alternatives": alternatives,
        # Reliability reflects the INPUT TYPE: an uploaded employment letter is high-signal; typed
        # job-title/duties (or a resume) is medium. (Not tied to country of experience.)
        "input_reliability": "high" if from_document else "medium",
        "location_of_experience": extraction.get("location", "unknown"),
        "next_step": "Use the Premium Auditor for a detailed IRCC-style compliance assessment.",
    }
