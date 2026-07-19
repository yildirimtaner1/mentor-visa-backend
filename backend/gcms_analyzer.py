"""GCMS Notes AI Analyzer — pay-first product ($14.90 / 1 credit, free with every GCMS order).

Turns a raw ATIP release PDF (typically 30-80 dense pages of GCMS screens) into a
plain-English report: overall status, stage-by-stage progress, officer remarks explained,
flags with severity, likely next steps, and a glossary of the acronyms that appear.

Two-stage pipeline (cost-shaped for long documents):
  1) Chunked extraction — gpt-4o-mini digests each ~12k-char chunk into dated events,
     officer remarks, stage signals and flags (cheap, parallelizable-by-chunk shape).
  2) Synthesis — claude-haiku-4-5 (200k context; falls back to gpt-4o-mini) merges the
     chunk digests into the final structured report.

The endpoint gates on payment BEFORE calling anything here; this module never checks credits.
"""
import json
import os

import fitz  # PyMuPDF
from pydantic import BaseModel, Field

MAX_PAGES = 150          # hard ceiling; ATIP releases rarely exceed ~120 pages
MIN_TEXT_CHARS = 800     # below this the PDF is a scan/empty — we do not OCR 50+ pages
CHUNK_CHARS = 12_000
MAX_CHUNKS = 12          # cost ceiling: at most 12 extraction calls (~144k chars analyzed)

SYNTH_MODEL_CLAUDE = "claude-haiku-4-5-20251001"
EXTRACT_MODEL = "gpt-4o-mini"


# ── Structured shapes ──────────────────────────────────────────────────────────
class GcmsEvent(BaseModel):
    date: str = Field(default="", description="Date as written, YYYY-MM-DD when possible")
    actor: str = Field(default="", description="Officer id/initials or office, if shown")
    note: str = Field(description="What happened, briefly")


class ChunkDigest(BaseModel):
    events: list[GcmsEvent]
    officer_remarks: list[str] = Field(description="Verbatim officer notes/remarks found in this chunk")
    stage_signals: list[str] = Field(description="Status signals, e.g. 'MEDS passed 2026-03-02', 'SECURITY not started'")
    flags: list[str] = Field(description="Anything that reads as a concern, hold, review or info request")
    key_facts: list[str] = Field(description="Application facts: type, dates, offices, UCI/app number if shown")
    looks_like_gcms: bool = Field(description="True if this chunk plausibly comes from GCMS/ATIP notes")


class StageStatus(BaseModel):
    name: str = Field(description="e.g. Eligibility, Medical, Criminality, Security, Info Sharing, Final Decision")
    status: str = Field(description="one of: passed | in_progress | not_started | flagged | unknown")
    detail: str = Field(description="One plain-English sentence backing the status, with dates when known")


class OfficerRemark(BaseModel):
    date: str = ""
    plain_english: str = Field(description="What this remark means for a layperson")
    original_snippet: str = Field(description="Short verbatim quote from the notes")


class FlagConcern(BaseModel):
    severity: str = Field(description="low | medium | high")
    description: str
    suggestion: str = Field(description="What the applicant can realistically do about it")


class NextStep(BaseModel):
    step: str
    expected_window: str = Field(description="Honest, hedged timeframe, e.g. 'typically 2-8 weeks after security completes'")
    basis: str = Field(description="What in the notes supports this expectation")


class GlossaryItem(BaseModel):
    term: str
    meaning: str


class GCMSAnalysisResponse(BaseModel):
    document_valid: bool = Field(description="False if this is not a GCMS/ATIP notes document")
    rejection_reason: str = ""
    overall_summary: str = Field(description="3-6 sentences: where the application stands and what matters most")
    application_snapshot: list[str] = Field(description="Key facts: application type, AOR date, office, etc.")
    stages: list[StageStatus]
    officer_remarks: list[OfficerRemark]
    flags_concerns: list[FlagConcern]
    next_steps: list[NextStep]
    glossary: list[GlossaryItem] = Field(description="Only acronyms/terms that actually appear in these notes")


# GCMS/ATIP releases are almost always scanned IMAGES (no embedded text), so image OCR is the norm,
# not the exception. To cover every page cost-effectively we render at a modest DPI and extract the
# structured digest DIRECTLY from the page images (combined OCR+extraction in one vision pass, batched)
# — cheaper and more accurate than OCR-to-text-then-extract.
OCR_DPI = 150
PAGES_PER_VISION_BATCH = 4
CHUNKS_HARD_CAP = 40  # generous ceiling so long releases are fully covered (was 12)


# ── Extraction ────────────────────────────────────────────────────────────────
def extract_notes_text(doc_bytes: bytes) -> tuple[str, int]:
    """Embedded text of the ATIP PDF with page markers (empty string if the PDF is scanned images).
    Returns (text, page_count). Never raises — a scanned PDF returns "" and the caller OCRs it."""
    doc = fitz.open(stream=doc_bytes, filetype="pdf")
    n_pages = min(len(doc), MAX_PAGES)
    parts = []
    for i in range(n_pages):
        t = doc[i].get_text().strip()
        if t:
            parts.append(f"[Page {i + 1}]\n{t}")
    doc.close()
    return "\n\n".join(parts), n_pages


def _render_page_pngs(doc_bytes: bytes) -> list:
    """Render each page to a PNG at OCR_DPI. Returns [(png_bytes, page_index)]."""
    doc = fitz.open(stream=doc_bytes, filetype="pdf")
    out = []
    for i in range(min(len(doc), MAX_PAGES)):
        pix = doc[i].get_pixmap(dpi=OCR_DPI)
        out.append((pix.tobytes("png"), i + 1))
    doc.close()
    return out


def _chunk(text: str) -> list[str]:
    """Split on page markers so chunks don't cut a GCMS screen mid-record."""
    pages = text.split("\n\n[Page ")
    chunks, cur = [], ""
    for i, p in enumerate(pages):
        piece = p if i == 0 else "\n\n[Page " + p
        if cur and len(cur) + len(piece) > CHUNK_CHARS:
            chunks.append(cur)
            cur = piece
        else:
            cur += piece
    if cur:
        chunks.append(cur)
    return chunks[:CHUNKS_HARD_CAP]  # cover the whole document, not just the first 12 chunks


_EXTRACT_SYSTEM = """You are digesting one chunk of a Canadian GCMS/ATIP notes release (IRCC's internal case system).
Extract ONLY what is actually in the text — never invent dates, statuses or remarks.
- events: dated actions (screens updated, letters sent, reviews done)
- officer_remarks: verbatim free-text officer notes (the "Notes"/"Remarks" fields)
- stage_signals: any status of Eligibility/R10/A11.2, Medical (MEDS/MEP), Criminality (CRIM),
  Security (SECU/SCREENING), Info Sharing, Final Decision — with dates when shown
- flags: holds, ADR/PFL, procedural fairness, misrepresentation review, anything that reads as a concern
- key_facts: application type, AOR/submission dates, responsible office, UCI/application number
- looks_like_gcms: false if this text is clearly NOT GCMS/ATIP notes (e.g. an employment letter)"""


def _digest_chunks(chunks: list[str], openai_client) -> list[dict]:
    digests = []
    for i, chunk in enumerate(chunks):
        try:
            completion = openai_client.beta.chat.completions.parse(
                model=EXTRACT_MODEL,
                messages=[{"role": "system", "content": _EXTRACT_SYSTEM},
                          {"role": "user", "content": chunk}],
                response_format=ChunkDigest,
                temperature=0.0,
                seed=42,
            )
            digests.append(json.loads(completion.choices[0].message.content))
            print(f"[GCMS-Analyzer] Chunk {i + 1}/{len(chunks)} digested")
        except Exception as e:
            print(f"[GCMS-Analyzer] Chunk {i + 1} extraction failed (skipping): {e}")
    return digests


def _digest_page_images(page_pngs: list, openai_client) -> list[dict]:
    """Combined OCR + extraction for scanned notes: read the structured digest DIRECTLY from batches
    of page images via gpt-4o-mini vision. Batching (PAGES_PER_VISION_BATCH) keeps every page covered
    at a low cost. Runs batches concurrently so an 80-page release finishes in a couple of minutes."""
    import base64
    from concurrent.futures import ThreadPoolExecutor

    batches = [page_pngs[i:i + PAGES_PER_VISION_BATCH]
               for i in range(0, len(page_pngs), PAGES_PER_VISION_BATCH)][:CHUNKS_HARD_CAP]

    def run(batch):
        first, last = batch[0][1], batch[-1][1]
        content = [{"type": "text", "text": _EXTRACT_SYSTEM +
                    f"\n\nThese are pages {first}-{last} of a scanned GCMS/ATIP release. "
                    "Read them and emit the digest."}]
        for png, _pg in batch:
            content.append({"type": "image_url", "image_url": {
                "url": f"data:image/png;base64,{base64.b64encode(png).decode()}", "detail": "auto"}})
        completion = openai_client.beta.chat.completions.parse(
            model=EXTRACT_MODEL,
            messages=[{"role": "user", "content": content}],
            response_format=ChunkDigest, temperature=0.0, seed=42,
        )
        return json.loads(completion.choices[0].message.content)

    digests = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(run, b) for b in batches]
        for i, f in enumerate(futures):
            try:
                digests.append(f.result())
                print(f"[GCMS-Analyzer] Vision batch {i + 1}/{len(batches)} digested")
            except Exception as e:
                print(f"[GCMS-Analyzer] Vision batch {i + 1} failed (skipping): {e}")
    return digests


# ── Synthesis ─────────────────────────────────────────────────────────────────
_SYNTH_SYSTEM = """You are Mentor Visa's GCMS notes analyst. You receive structured digests extracted from a
Canadian permanent-residence GCMS/ATIP notes release and produce the report a worried applicant actually needs.

Rules:
- Base EVERYTHING on the digests. Never invent dates, statuses, or remarks. Unknown = "unknown".
- Write for a layperson: no unexplained acronyms in summaries; put acronym meanings in the glossary.
- Standard PR processing stages to report on (include each, status 'unknown'/'not_started' if unseen):
  Eligibility (R10 completeness, A11.2 review), Medical, Criminality, Security, Info Sharing, Final Decision.
- Officer remarks: quote a short original snippet and explain what it MEANS in practice.
- Flags: be honest but not alarmist; classic examples — ADR (additional document request), PFL
  (procedural fairness letter), security screening restarts, misrepresentation reviews, long idle gaps.
- Next steps: hedge honestly ("typically", "often"); tie each expectation to what the notes show.
- If the digests indicate the document is NOT GCMS notes, set document_valid=false with a clear
  rejection_reason telling the user what to upload instead — and leave the other sections empty."""


def _synthesize(digests: list[dict], n_pages: int, openai_client) -> tuple[dict, str]:
    """Merge chunk digests into the final report. Returns (report_dict, model_used)."""
    user_content = (
        f"ATIP release: {n_pages} pages, {len(digests)} digest chunk(s) in document order.\n\n"
        + json.dumps(digests, ensure_ascii=False)
    )

    # Preferred: Claude Haiku 4.5 (stronger synthesis, big context)
    try:
        import noc_agents
        client = noc_agents._get_anthropic_client()
        if client is not None:
            resp = client.messages.create(
                model=SYNTH_MODEL_CLAUDE,
                max_tokens=8000,
                temperature=0.0,
                system=_SYNTH_SYSTEM,
                messages=[{"role": "user", "content": user_content}],
                tools=[{
                    "name": "emit_report",
                    "description": "Emit the GCMS analysis strictly conforming to the schema.",
                    "input_schema": GCMSAnalysisResponse.model_json_schema(),
                }],
                tool_choice={"type": "tool", "name": "emit_report"},
            )
            tool_input = next((b.input for b in resp.content if getattr(b, "type", "") == "tool_use"), None)
            if tool_input is not None:
                report = GCMSAnalysisResponse.model_validate(tool_input).model_dump()
                return report, SYNTH_MODEL_CLAUDE
    except Exception as e:
        print(f"[GCMS-Analyzer] Claude synthesis failed, falling back to gpt-4o-mini: {e}")

    completion = openai_client.beta.chat.completions.parse(
        model=EXTRACT_MODEL,
        messages=[{"role": "system", "content": _SYNTH_SYSTEM},
                  {"role": "user", "content": user_content}],
        response_format=GCMSAnalysisResponse,
        temperature=0.0,
        seed=42,
    )
    return json.loads(completion.choices[0].message.content), EXTRACT_MODEL


def run_gcms_analysis(doc_bytes: bytes, openai_client) -> dict:
    """Full pipeline. Handles BOTH text-based and scanned (image) GCMS PDFs — the latter via page-image
    OCR+extraction. Raises ValueError only when the file can't be read at all. The returned dict
    includes document_valid — callers only consume a credit when True."""
    text, n_pages = extract_notes_text(doc_bytes)
    if len(text) >= MIN_TEXT_CHARS:
        # Text-based PDF — cheapest path.
        chunks = _chunk(text)
        print(f"[GCMS-Analyzer] {n_pages} pages -> {len(chunks)} text chunk(s), {len(text)} chars")
        digests = _digest_chunks(chunks, openai_client)
    else:
        # Scanned/image PDF (the common case) — OCR + extract every page directly from the images.
        page_pngs = _render_page_pngs(doc_bytes)
        print(f"[GCMS-Analyzer] {n_pages} pages (scanned) -> {len(page_pngs)} page images, vision OCR")
        digests = _digest_page_images(page_pngs, openai_client)
    if not digests:
        raise ValueError("We could not read this document. Please try again or contact support.")
    # If every chunk says this isn't GCMS notes, reject without burning the synthesis call.
    if all(d.get("looks_like_gcms") is False for d in digests):
        return {
            "document_valid": False,
            "rejection_reason": ("This does not look like a GCMS/ATIP notes release. Please upload the "
                                 "PDF you received from IRCC or CBSA in response to your notes request."),
            "overall_summary": "", "application_snapshot": [], "stages": [],
            "officer_remarks": [], "flags_concerns": [], "next_steps": [], "glossary": [],
            "pages_analyzed": n_pages, "model_used": EXTRACT_MODEL,
        }
    report, model_used = _synthesize(digests, n_pages, openai_client)
    report["pages_analyzed"] = n_pages
    report["model_used"] = model_used
    return report
