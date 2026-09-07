"""
AI symptom intake service.

If OPENAI_API_KEY is set in the environment, real calls are made to the
OpenAI GPT API to interpret the patient's natural-language symptom
description. If no key is configured, a rule-based mock analyzer is used
instead so the app remains fully functional for local development and
demos without any external dependency or cost.
"""
import os
import json
import re

from .schemas import SymptomIntakeResponse

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()

SPECIALTIES = [
    "General Practice",
    "Cardiology",
    "Dermatology",
    "Orthopedics",
    "Neurology",
    "Pediatrics",
    "Gastroenterology",
    "ENT (Ear, Nose & Throat)",
    "Psychiatry / Mental Health",
    "Obstetrics & Gynecology",
]

# Keyword -> specialty mapping used by the mock analyzer.
KEYWORD_MAP = {
    "chest pain": "Cardiology",
    "heart": "Cardiology",
    "palpitation": "Cardiology",
    "skin": "Dermatology",
    "rash": "Dermatology",
    "acne": "Dermatology",
    "joint": "Orthopedics",
    "bone": "Orthopedics",
    "fracture": "Orthopedics",
    "back pain": "Orthopedics",
    "headache": "Neurology",
    "migraine": "Neurology",
    "dizziness": "Neurology",
    "numbness": "Neurology",
    "child": "Pediatrics",
    "kid": "Pediatrics",
    "infant": "Pediatrics",
    "stomach": "Gastroenterology",
    "nausea": "Gastroenterology",
    "vomit": "Gastroenterology",
    "diarrhea": "Gastroenterology",
    "throat": "ENT (Ear, Nose & Throat)",
    "ear": "ENT (Ear, Nose & Throat)",
    "sinus": "ENT (Ear, Nose & Throat)",
    "anxious": "Psychiatry / Mental Health",
    "anxiety": "Psychiatry / Mental Health",
    "depress": "Psychiatry / Mental Health",
    "stress": "Psychiatry / Mental Health",
    "pregnan": "Obstetrics & Gynecology",
    "menstrual": "Obstetrics & Gynecology",
}

HIGH_URGENCY_KEYWORDS = [
    "severe",
    "can't breathe",
    "cannot breathe",
    "chest pain",
    "unconscious",
    "bleeding heavily",
    "suicidal",
    "stroke",
    "worst headache",
]
MEDIUM_URGENCY_KEYWORDS = ["fever", "persistent", "worsening", "days", "vomit"]


def _mock_analyze(symptom_text: str) -> SymptomIntakeResponse:
    text = symptom_text.lower()

    specialty = "General Practice"
    for keyword, mapped_specialty in KEYWORD_MAP.items():
        if keyword in text:
            specialty = mapped_specialty
            break

    if any(k in text for k in HIGH_URGENCY_KEYWORDS):
        urgency = "high"
    elif any(k in text for k in MEDIUM_URGENCY_KEYWORDS):
        urgency = "medium"
    else:
        urgency = "low"

    summary = (
        f"Patient reports: \"{symptom_text.strip()[:200]}\". "
        f"Based on keyword analysis, this appears best suited for "
        f"{specialty}, with {urgency} urgency."
    )

    return SymptomIntakeResponse(
        recommended_specialty=specialty,
        urgency=urgency,
        summary=summary,
        suggested_reason=symptom_text.strip()[:300],
        source="mock",
    )


def _openai_analyze(symptom_text: str) -> SymptomIntakeResponse:
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY)

    system_prompt = (
        "You are a clinical triage assistant for a hospital scheduling system. "
        "You do NOT diagnose. You classify the patient's free-text description "
        "into the single most appropriate specialty from this exact list: "
        f"{', '.join(SPECIALTIES)}. You also assign an urgency level of "
        "low, medium, or high, and write a one-sentence neutral summary for "
        "hospital staff. Respond ONLY with strict JSON in this shape: "
        '{"recommended_specialty": "...", "urgency": "low|medium|high", '
        '"summary": "..."}'
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": symptom_text},
        ],
        temperature=0.2,
        max_tokens=300,
    )

    content = response.choices[0].message.content.strip()
    content = re.sub(r"^```json|```$", "", content).strip()
    data = json.loads(content)

    specialty = data.get("recommended_specialty", "General Practice")
    if specialty not in SPECIALTIES:
        specialty = "General Practice"

    urgency = data.get("urgency", "low")
    if urgency not in ("low", "medium", "high"):
        urgency = "low"

    return SymptomIntakeResponse(
        recommended_specialty=specialty,
        urgency=urgency,
        summary=data.get("summary", "AI summary unavailable."),
        suggested_reason=symptom_text.strip()[:300],
        source="openai",
    )


def analyze_symptoms(symptom_text: str) -> SymptomIntakeResponse:
    if OPENAI_API_KEY:
        try:
            return _openai_analyze(symptom_text)
        except Exception:
            # Fall back gracefully if the API call fails for any reason
            # (network issue, invalid key, rate limit, etc.)
            return _mock_analyze(symptom_text)
    return _mock_analyze(symptom_text)
