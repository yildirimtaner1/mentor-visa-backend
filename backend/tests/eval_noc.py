"""NOC Finder accuracy eval.

Runs the multi-agent NOC Finder over a small labelled fixture set and reports
top-1 / top-3 accuracy. The point is regression safety: run it before and after
any change to prompts, retrieval, or scoring and confirm accuracy doesn't drop.

Usage (from backend/):
    python -m tests.eval_noc                 # full pipeline (needs OPENAI_API_KEY)
    python -m tests.eval_noc --retrieval     # retrieval-only (cheaper; embeddings only)

Requires OPENAI_API_KEY (embeddings + voters) and, for genuine model diversity,
ANTHROPIC_API_KEY. If keys are missing the eval skips with a clear message and
exit code 0 so it never hard-fails a pipeline that simply lacks secrets.

Expand noc_eval_fixtures.json with real, labelled examples — especially edge
cases you've hit in production — to make the accuracy number meaningful.
"""

import argparse
import json
import os
import sys

# Allow running both as a module (python -m tests.eval_noc) and as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai_service  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(__file__), "noc_eval_fixtures.json")


def _load_fixtures():
    with open(FIXTURES, "r", encoding="utf-8") as f:
        return json.load(f)


def _predict_retrieval(text):
    """Top codes by RAG ranking only (no LLM voting). Returns (codes, confidence=None)."""
    ranked = ai_service.semantic_search_nocs(text)
    return list(ranked.keys()), None


def _predict_pipeline(text):
    """Recommended code + alternatives from the (legacy) RAG-first multi-agent pipeline.
    Returns (codes, top1_confidence)."""
    import noc_agents
    result = noc_agents.run_multi_agent_noc_finder(text)
    rec = result.get("recommended_noc") or {}
    alts = [a.get("code", "") for a in result.get("alternatives", [])]
    codes = [c for c in [rec.get("code", ""), *alts] if c]
    return codes, rec.get("confidence")


def _predict_v2(text):
    """Recommended code + alternatives from the knowledge-first v2 pipeline.
    Returns (codes, top1_confidence)."""
    import noc_finder_v2
    result = noc_finder_v2.run_noc_finder_v2(text)
    rec = result.get("recommended_noc") or {}
    alts = [a.get("code", "") for a in result.get("alternatives", [])]
    codes = [c for c in [rec.get("code", ""), *alts] if c]
    return codes, rec.get("confidence")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--retrieval", action="store_true",
                        help="Evaluate retrieval ranking only (no LLM voting).")
    parser.add_argument("--v2", action="store_true",
                        help="Evaluate the knowledge-first v2 pipeline.")
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        print("SKIP: OPENAI_API_KEY not set — cannot embed/eval. Exiting 0.")
        return 0
    if not args.retrieval and not os.getenv("ANTHROPIC_API_KEY"):
        print("NOTE: ANTHROPIC_API_KEY not set — pipeline runs in GPT-only "
              "(degraded, no model diversity) mode.")

    fixtures = _load_fixtures()
    if args.retrieval:
        predict, mode = _predict_retrieval, "retrieval-only"
    elif args.v2:
        predict, mode = _predict_v2, "v2-knowledge-first"
    else:
        predict, mode = _predict_pipeline, "full-pipeline (legacy)"
    print(f"\nNOC eval ({mode}) over {len(fixtures)} fixtures\n" + "=" * 60)

    top1 = top3 = 0
    conf_checked = conf_passed = 0
    for fx in fixtures:
        expected = fx["expected_noc"]
        min_conf = fx.get("min_confidence")  # optional per-fixture floor
        try:
            codes, confidence = predict(fx["text"])
        except Exception as e:
            print(f"  [{fx['id']:<24}] ERROR: {e}")
            continue
        hit1 = bool(codes) and codes[0] == expected
        hit3 = expected in codes[:3]
        top1 += hit1
        top3 += hit3
        mark = "OK " if hit1 else ("~3 " if hit3 else "XX ")

        # Confidence floor check: only meaningful when the top code is correct AND the
        # mode reports a confidence AND the fixture declares a floor. This is what catches a
        # confidence regression (e.g. a multi-title NOC scoring low) that a code-only check misses.
        conf_note = ""
        if min_conf is not None and confidence is not None:
            if hit1:
                conf_checked += 1
                ok = confidence >= min_conf
                conf_passed += ok
                conf_note = f"  conf={confidence}% (floor {min_conf}%) {'PASS' if ok else 'FAIL <<<'}"
            else:
                conf_note = f"  conf={confidence}% (floor {min_conf}%, code wrong — skipped)"
        elif confidence is not None:
            conf_note = f"  conf={confidence}%"

        print(f"  {mark}[{fx['id']:<24}] expected={expected} "
              f"got={codes[:3]} (title: {ai_service.NOC_LOOKUP.get(codes[0], '?') if codes else '-'}){conf_note}")

    n = len(fixtures)
    print("=" * 60)
    print(f"top-1 accuracy: {top1}/{n} = {top1 / n:.0%}")
    print(f"top-3 accuracy: {top3}/{n} = {top3 / n:.0%}")
    if conf_checked:
        print(f"confidence floors: {conf_passed}/{conf_checked} passed"
              + ("" if conf_passed == conf_checked else "   <<< CONFIDENCE REGRESSION"))
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
