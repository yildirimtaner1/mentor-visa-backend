"""
Profile Builder Agent — AI Service Layer

Provides a streaming conversational AI assistant that helps users navigate
the IRCC Express Entry portal while creating their profile.

Model-agnostic design: swap PROFILE_BUILDER_MODEL to change providers.
Currently uses Google Gemini 2.5 Pro via the google-genai SDK.
"""

import os
import json
import datetime
from typing import AsyncGenerator, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ── Model Configuration (swap this to change providers) ──
PROFILE_BUILDER_MODEL = "gemini-2.5-pro"

# Reuse the global genai client from ai_service
client = genai.Client()

# ── Context Window Management ──
MAX_HISTORY_TURNS = 20  # Max messages sent to the LLM
IMAGE_KEEP_LAST_N = 2   # Only keep images in the last N user messages


def _get_system_prompt() -> str:
    """Build the system instruction for the Profile Builder agent.

    Assembles the prompt from modular files in prompt_modules/.
    Each module contains a focused section of the system instruction.
    To update reference data (e.g., proof of funds), edit the relevant
    module — no need to touch this file.
    """
    from prompt_modules import core, ircc_sections, clb_tables, proof_of_funds, examples, guardrails

    today = datetime.date.today().strftime("%B %d, %Y")

    return "\n\n---\n\n".join([
        core.build(today),
        ircc_sections.PROMPT,
        clb_tables.PROMPT,
        proof_of_funds.PROMPT,
        examples.PROMPT,
        guardrails.PROMPT,
    ])


def build_user_context(journey_data: dict, profile_data: dict) -> str:
    """Convert the user's journey store data into a context block for the agent.
    
    This is prepended to the conversation so the agent can reference the user's
    existing data without re-asking.
    """
    lines = ["=== USER'S MENTOR VISA PROFILE (use this to personalize your answers) ==="]

    # NOC
    noc_code = journey_data.get("noc_code")
    noc_title = journey_data.get("noc_title")
    if noc_code:
        lines.append(f"- NOC Code: {noc_code}" + (f" ({noc_title})" if noc_title else ""))
        teer = journey_data.get("teer_category")
        if teer:
            lines.append(f"- TEER Category: {teer}")

    # CRS
    crs_score = journey_data.get("crs_score")
    if crs_score:
        calc_at = journey_data.get("crs_calculated_at", "")
        lines.append(f"- CRS Score: {crs_score}" + (f" (calculated {calc_at})" if calc_at else ""))

    # Eligibility
    programs = journey_data.get("eligible_programs") or {}
    eligible = [p.upper() for p, v in programs.items() if v]
    if eligible:
        lines.append(f"- Eligible Programs: {', '.join(eligible)}")

    # Profile data
    if profile_data:
        age = profile_data.get("age")
        if age:
            lines.append(f"- Age: {age}")

        edu = profile_data.get("education_level")
        if edu:
            lines.append(f"- Education: {edu}")

        # Primary language
        lang_test = profile_data.get("primary_language_test")
        if lang_test and lang_test != "none":
            l = profile_data.get("primary_listening", "?")
            s = profile_data.get("primary_speaking", "?")
            r = profile_data.get("primary_reading", "?")
            w = profile_data.get("primary_writing", "?")
            lines.append(f"- Primary Language: {lang_test.upper()} — L:{l} S:{s} R:{r} W:{w}")

        # Secondary language
        lang2 = profile_data.get("secondary_language_test")
        if lang2 and lang2 != "none":
            l2 = profile_data.get("secondary_listening", "?")
            s2 = profile_data.get("secondary_speaking", "?")
            r2 = profile_data.get("secondary_reading", "?")
            w2 = profile_data.get("secondary_writing", "?")
            lines.append(f"- Secondary Language: {lang2.upper()} — L:{l2} S:{s2} R:{r2} W:{w2}")

        # Work experience
        total_exp = profile_data.get("total_skilled_experience_years")
        can_exp = profile_data.get("canadian_experience_years")
        if total_exp is not None:
            lines.append(f"- Total Skilled Experience: {total_exp} year(s)")
        if can_exp is not None:
            lines.append(f"- Canadian Work Experience: {can_exp} year(s)")

        # Marital status
        marital = profile_data.get("marital_status")
        if marital:
            lines.append(f"- Marital Status: {marital}")
            if marital in ("married", "common_law"):
                spouse_acc = profile_data.get("spouse_accompanying")
                if spouse_acc is not None:
                    lines.append(f"- Spouse Accompanying: {'Yes' if spouse_acc else 'No'}")

        # Additional
        if profile_data.get("has_job_offer"):
            lines.append("- Has Job Offer: Yes")
        if profile_data.get("has_provincial_nomination"):
            lines.append("- Has Provincial Nomination: Yes (600 pts)")
        
        country = profile_data.get("country_of_citizenship")
        if country:
            lines.append(f"- Country of Citizenship: {country}")
        residence = profile_data.get("country_of_residence")
        if residence:
            lines.append(f"- Country of Residence: {residence}")

    if len(lines) == 1:
        lines.append("- No profile data available yet. The user has not completed any tools.")

    lines.append("=== END PROFILE ===")
    return "\n".join(lines)


def prepare_messages_for_llm(messages: list[dict], max_turns: int = MAX_HISTORY_TURNS) -> list[dict]:
    """Prune conversation history before sending to the LLM.
    
    1. Keep only the last `max_turns` messages.
    2. Drop image_url from messages older than IMAGE_KEEP_LAST_N user messages.
    3. Replace dropped images with a placeholder note.
    """
    # Trim to max turns
    if len(messages) > max_turns:
        messages = messages[-max_turns:]

    # Find user messages with images (counting from the end)
    user_image_indices = []
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user" and messages[i].get("image_url"):
            user_image_indices.append(i)

    # Drop images from older messages
    images_to_keep = set(user_image_indices[:IMAGE_KEEP_LAST_N])
    pruned = []
    for i, msg in enumerate(messages):
        if msg.get("image_url") and i not in images_to_keep:
            pruned.append({
                "role": msg["role"],
                "content": msg["content"] + "\n[User previously shared a screenshot here]",
            })
        else:
            pruned.append(msg)

    return pruned


async def stream_chat_response(
    messages: list[dict],
    user_context: str,
    image_data: Optional[bytes] = None,
    image_mime: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream the agent's response token-by-token.
    
    Args:
        messages: Pruned conversation history [{role, content}]
        user_context: User profile context string
        image_data: Raw bytes of the latest screenshot (if any)
        image_mime: MIME type of the image (e.g., "image/png")
    
    Yields:
        Text chunks as they arrive from the model.
    """
    system_prompt = _get_system_prompt()
    full_system = f"{system_prompt}\n\n{user_context}"

    # Build the Gemini contents array
    contents = []

    # Add conversation history
    for msg in messages[:-1]:  # All messages except the latest
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(
            role=role,
            parts=[types.Part.from_text(text=msg["content"])]
        ))

    # Build the latest user message (may include an image)
    latest = messages[-1]
    latest_parts = []

    if image_data and image_mime:
        latest_parts.append(types.Part.from_bytes(data=image_data, mime_type=image_mime))
        latest_parts.append(types.Part.from_text(
            text=latest["content"] if latest["content"].strip() else "What should I do here? Please look at this screenshot from the IRCC portal."
        ))
    else:
        latest_parts.append(types.Part.from_text(text=latest["content"]))

    contents.append(types.Content(role="user", parts=latest_parts))

    # Stream from Gemini
    response = client.models.generate_content_stream(
        model=PROFILE_BUILDER_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=full_system,
            temperature=0.7,
            max_output_tokens=2048,
        ),
    )

    for chunk in response:
        if chunk.text:
            yield chunk.text
