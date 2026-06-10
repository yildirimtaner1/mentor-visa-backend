"""Unit tests for NOC scoring helpers — no network/API calls.

These lock in the behaviour of the duty-coverage / confidence / key-match logic
that drives the user-facing verdict. Run with `python -m pytest tests/` or
directly with `python tests/test_noc_scoring.py` from the backend/ directory.

Importing noc_agents loads the NOC index/embeddings from disk (committed), but
makes no API calls, so these run offline.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import noc_agents  # noqa: E402


def test_duty_coverage_prefers_semantic_precomputed():
    """When the entry carries semantic coverage from reranking, use it verbatim."""
    entry = {
        "code": "21232",
        "duties": ["a", "b", "c", "d"],
        "_pre_computed_duties_matched": 3,
        "_pre_computed_duties_total": 4,
    }
    matched, total = noc_agents._duty_coverage({"main_duties": ["x"]}, entry)
    assert (matched, total) == (3, 4)


def test_duty_coverage_falls_back_to_lexical():
    """Without precomputed coverage, fall back to word-overlap counting."""
    entry = {
        "code": "21232",
        "duties": ["design and develop software applications"],
    }
    extraction = {"main_duties": ["design develop software applications daily"]}
    matched, total = noc_agents._duty_coverage(extraction, entry)
    assert total == 1
    assert matched == 1  # strong lexical overlap


def test_confidence_from_coverage():
    assert noc_agents._confidence_from_coverage(0, 0) == 0
    assert noc_agents._confidence_from_coverage(7, 10) == 70
    assert noc_agents._confidence_from_coverage(99, 10) == 100  # clamped


def test_key_matches_returns_aligned_duties():
    entry = {"duties": ["operate and maintain industrial boilers safely"]}
    extraction = {"main_duties": ["operate and maintain industrial boilers"]}
    matches = noc_agents._build_key_matches(extraction, entry)
    assert matches  # found an aligned duty
    assert "boilers" in matches[0]


def test_key_matches_falls_back_when_no_lexical_overlap():
    """A purely semantic match (no shared words) still surfaces the applicant's duties."""
    entry = {"duties": ["completely unrelated wording here xyz"]}
    extraction = {"main_duties": ["my actual responsibility statement"]}
    matches = noc_agents._build_key_matches(extraction, entry)
    assert matches == ["my actual responsibility statement"]


def test_key_matches_empty_when_no_data():
    assert noc_agents._build_key_matches({}, None) == []
    assert noc_agents._build_key_matches({"main_duties": []}, {"duties": ["a"]}) == []


if __name__ == "__main__":
    funcs = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in funcs:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(funcs) - failed}/{len(funcs)} passed")
    raise SystemExit(1 if failed else 0)
