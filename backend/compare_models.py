"""
Compare Gemini 2.5 Flash vs Pro on the same employment letter.
Usage: python compare_models.py <path_to_document>
"""
import sys
import os
import json
import time
import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

# Reuse the same infrastructure from ai_service
from ai_service import (
    _build_prompt_text,
    extract_text_from_pdf,
    pdf_pages_to_images,
    extract_text_from_docx,
    NOC_INDEX,
    IMAGE_MIME_TYPES,
)
from models import AnalysisResponse

MODELS = ["gemini-2.5-flash", "gemini-2.5-pro"]


def run_analysis(model_name: str, file_path: str) -> tuple[dict, float]:
    """Run the auditor prompt on a file using the specified model. Returns (result_json, elapsed_seconds)."""
    ext = os.path.splitext(file_path)[1].lower()
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    noc_reference = json.dumps(NOC_INDEX, ensure_ascii=False)
    system_prompt = _build_prompt_text(noc_reference)

    # Build contents based on file type
    if ext in IMAGE_MIME_TYPES:
        mime_type = IMAGE_MIME_TYPES[ext]
        contents = [
            system_prompt,
            "\n=== USER'S EMPLOYMENT LETTER (Image) ===\n",
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
        ]
    elif ext == '.pdf':
        page_images = pdf_pages_to_images(file_bytes)
        user_text = extract_text_from_pdf(file_bytes)
        has_text = len(user_text.strip()) >= 50

        contents = [
            system_prompt,
            "\n=== USER'S EMPLOYMENT LETTER (Page images) ===\n",
        ]
        for img_bytes, mime in page_images:
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
        if has_text:
            contents.append(f"\n=== EXTRACTED TEXT ===\n{user_text}")
    elif ext in ('.docx', '.doc'):
        user_text = extract_text_from_docx(file_bytes)
        contents = system_prompt + f"\n\n=== USER'S EMPLOYMENT LETTER ===\n{user_text}"
    else:
        user_text = file_bytes.decode('utf-8', errors='replace')
        contents = system_prompt + f"\n\n=== USER'S EMPLOYMENT LETTER ===\n{user_text}"

    print(f"\n{'='*60}")
    print(f"  Running: {model_name}")
    print(f"{'='*60}")

    start = time.time()
    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AnalysisResponse,
            temperature=0.0,
        ),
    )
    elapsed = time.time() - start

    result = json.loads(response.text)
    
    # Print token usage if available
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        um = response.usage_metadata
        print(f"  Tokens — Input: {um.prompt_token_count:,}  Output: {um.candidates_token_count:,}  Total: {um.total_token_count:,}")
    
    print(f"  Time: {elapsed:.1f}s")
    return result, elapsed


def print_comparison(flash_result: dict, pro_result: dict, flash_time: float, pro_time: float):
    """Print a formatted side-by-side comparison."""

    def get(d, *keys, default="N/A"):
        val = d
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k, default)
            else:
                return default
        return val

    print(f"\n{'='*80}")
    print(f"  COMPARISON: Gemini 2.5 Flash vs Gemini 2.5 Pro")
    print(f"{'='*80}\n")

    rows = [
        ("Decision", get(flash_result, "decision"), get(pro_result, "decision")),
        ("Confidence Score", get(flash_result, "confidence_score"), get(pro_result, "confidence_score")),
        ("", "", ""),
        ("NOC Code", get(flash_result, "noc_analysis", "detected_code"), get(pro_result, "noc_analysis", "detected_code")),
        ("NOC Title", get(flash_result, "noc_analysis", "detected_title"), get(pro_result, "noc_analysis", "detected_title")),
        ("NOC Match Score", get(flash_result, "noc_analysis", "match_score"), get(pro_result, "noc_analysis", "match_score")),
        ("NOC Confidence", get(flash_result, "noc_analysis", "confidence"), get(pro_result, "noc_analysis", "confidence")),
        ("Duty Coverage %", get(flash_result, "noc_analysis", "duty_coverage_percentage"), get(pro_result, "noc_analysis", "duty_coverage_percentage")),
        ("", "", ""),
        ("Compliance Score", get(flash_result, "compliance", "score"), get(pro_result, "compliance", "score")),
        ("Overall Risk", get(flash_result, "risk_assessment", "overall_risk"), get(pro_result, "risk_assessment", "overall_risk")),
        ("PFL Likelihood", get(flash_result, "risk_assessment", "pfl_likelihood"), get(pro_result, "risk_assessment", "pfl_likelihood")),
        ("", "", ""),
        ("# Risks Found", len(get(flash_result, "risk_assessment", "key_risks", default=[])), len(get(pro_result, "risk_assessment", "key_risks", default=[]))),
        ("# Missing Duties", len(get(flash_result, "noc_analysis", "missing_critical_duties", default=[])), len(get(pro_result, "noc_analysis", "missing_critical_duties", default=[]))),
        ("# Refusal Reasons", len(get(flash_result, "refusal_reasons", default=[])), len(get(pro_result, "refusal_reasons", default=[]))),
        ("# Action Items", len(get(flash_result, "action_plan", default=[])), len(get(pro_result, "action_plan", default=[]))),
        ("# Suggested Wordings", len(get(flash_result, "suggested_wording", default=[])), len(get(pro_result, "suggested_wording", default=[]))),
        ("", "", ""),
        ("Location", get(flash_result, "noc_analysis", "location_of_experience"), get(pro_result, "noc_analysis", "location_of_experience")),
        ("Response Time", f"{flash_time:.1f}s", f"{pro_time:.1f}s"),
    ]

    print(f"  {'Metric':<25} {'Flash':<25} {'Pro':<25}")
    print(f"  {'-'*25} {'-'*25} {'-'*25}")
    for label, flash_val, pro_val in rows:
        if label == "":
            print()
            continue
        f_str = str(flash_val)[:24]
        p_str = str(pro_val)[:24]
        # Highlight differences
        marker = " <<DIFF>>" if f_str != p_str else ""
        print(f"  {label:<25} {f_str:<25} {p_str:<25}{marker}")

    # Duty-by-duty comparison
    flash_duties = get(flash_result, "noc_analysis", "duties_match", default=[])
    pro_duties = get(pro_result, "noc_analysis", "duties_match", default=[])
    
    if flash_duties or pro_duties:
        print(f"\n  {'-'*80}")
        print(f"  DUTY MATCH STRENGTH COMPARISON")
        print(f"  {'-'*80}")
        max_duties = max(len(flash_duties), len(pro_duties))
        for i in range(max_duties):
            f_duty = flash_duties[i] if i < len(flash_duties) else {}
            p_duty = pro_duties[i] if i < len(pro_duties) else {}
            f_noc = (f_duty.get("noc_duty", "--"))[:50]
            f_strength = f_duty.get("match_strength", "--")
            p_strength = p_duty.get("match_strength", "--")
            marker = " <<DIFF>>" if f_strength != p_strength else ""
            print(f"  {i+1}. {f_noc:<50} {f_strength:<12} {p_strength:<12}{marker}")

    # Officer narratives
    print(f"\n  {'-'*80}")
    print(f"  OFFICER NARRATIVE -- Flash:")
    print(f"  {'-'*80}")
    print(f"  {get(flash_result, 'officer_narrative', default='N/A')}")
    
    print(f"\n  {'-'*80}")
    print(f"  OFFICER NARRATIVE -- Pro:")
    print(f"  {'-'*80}")
    print(f"  {get(pro_result, 'officer_narrative', default='N/A')}")

    # Save full results 
    output_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(output_dir, "comparison_flash.json"), "w", encoding="utf-8") as f:
        json.dump(flash_result, f, indent=2, ensure_ascii=False)
    with open(os.path.join(output_dir, "comparison_pro.json"), "w", encoding="utf-8") as f:
        json.dump(pro_result, f, indent=2, ensure_ascii=False)
    
    print(f"\n  Full JSON results saved to comparison_flash.json and comparison_pro.json")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python compare_models.py <path_to_employment_letter>")
        print("Supported: PDF, DOCX, JPG, PNG")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)

    print(f"Document: {os.path.basename(file_path)}")
    print(f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    flash_result, flash_time = run_analysis("gemini-2.5-flash", file_path)
    pro_result, pro_time = run_analysis("gemini-2.5-pro", file_path)

    print_comparison(flash_result, pro_result, flash_time, pro_time)
