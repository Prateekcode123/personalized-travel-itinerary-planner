from __future__ import annotations

import json
import os
import re
from datetime import date, timedelta
from typing import Any

from models import Activity, DayPlan, ItineraryResponse, TripPreferences

PACE_SLOTS = {
    "Relaxed": ["09:30", "13:00", "17:00"],
    "Balanced": ["09:00", "12:30", "15:30", "19:00"],
    "Packed": ["08:30", "11:00", "13:30", "16:00", "19:30"],
}

INTEREST_IDEAS = {
    "Food": [
        ("Local breakfast tasting", "Start with a neighborhood cafe and regional specialties."),
        ("Market lunch", "Sample street food and produce at a busy local market."),
        ("Signature dinner", "Book a well-known restaurant that matches the trip budget."),
    ],
    "Culture": [
        ("Museum morning", "Visit a landmark museum or historic house."),
        ("Heritage walk", "Join a guided walk through an old district."),
        ("Evening performance", "Look for a concert, theater, or traditional show."),
    ],
    "Nature": [
        ("Park stroll", "Spend unhurried time in a garden, waterfront, or city park."),
        ("Scenic lookout", "Travel to a viewpoint or nearby natural area."),
        ("Golden-hour outdoors", "Catch sunset from an open, scenic spot."),
    ],
    "Sightseeing": [
        ("Iconic landmark", "See the destination's best-known sight before crowds build."),
        ("Neighborhood circuit", "Walk a photogenic district and notable side streets."),
        ("Night lights", "End the day at an illuminated plaza or viewpoint."),
    ],
}

DEFAULT_IDEAS = INTEREST_IDEAS["Sightseeing"]


def _trip_dates(preferences: TripPreferences) -> list[date]:
    days = (preferences.end_date - preferences.start_date).days + 1
    return [preferences.start_date + timedelta(days=offset) for offset in range(days)]


def _ideas_for(preferences: TripPreferences) -> list[tuple[str, str]]:
    selected = preferences.interests or ["Sightseeing"]
    ideas: list[tuple[str, str]] = []
    for interest in selected:
        ideas.extend(INTEREST_IDEAS.get(interest, DEFAULT_IDEAS))
    return ideas or DEFAULT_IDEAS


def build_demo_itinerary(preferences: TripPreferences) -> ItineraryResponse:
    dates = _trip_dates(preferences)
    slots = PACE_SLOTS[preferences.pace]
    ideas = _ideas_for(preferences)
    activity_count = max(1, len(dates) * len(slots))
    per_activity = round(preferences.budget / activity_count, 2)
    days: list[DayPlan] = []

    for index, day_date in enumerate(dates):
        activities: list[Activity] = []
        for slot_index, time in enumerate(slots):
            title, description = ideas[(index + slot_index) % len(ideas)]
            activities.append(
                Activity(
                    time=time,
                    title=f"{title} in {preferences.destination}",
                    description=(
                        f"{description} Planned for {preferences.travelers} traveler"
                        f"{'' if preferences.travelers == 1 else 's'} at a {preferences.pace.lower()} pace."
                    ),
                    estimated_cost=per_activity,
                )
            )
        days.append(
            DayPlan(
                date=day_date,
                day=index + 1,
                title=f"Day {index + 1} in {preferences.destination}",
                activities=activities,
            )
        )

    return ItineraryResponse(
        destination=preferences.destination,
        currency=preferences.currency,
        source="demo",
        days=days,
    )


def _extract_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        raise ValueError("The model did not return JSON.")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("The model JSON was not an object.")
    return parsed


def _as_cost(value: Any) -> float:
    try:
        cost = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, round(cost, 2))


def _normalize_model_payload(
    payload: dict[str, Any], preferences: TripPreferences, provider: str
) -> ItineraryResponse:
    dates = _trip_dates(preferences)
    raw_days = payload.get("days")
    if not isinstance(raw_days, list) or not raw_days:
        raise ValueError("The model response did not include days.")

    days: list[DayPlan] = []
    for index, day_date in enumerate(dates):
        raw_day = raw_days[index] if index < len(raw_days) else {}
        if not isinstance(raw_day, dict):
            raw_day = {}
        raw_activities = raw_day.get("activities")
        if not isinstance(raw_activities, list) or not raw_activities:
            raise ValueError("Each day must include activities.")

        activities = []
        for activity in raw_activities:
            if not isinstance(activity, dict):
                continue
            title = str(activity.get("title") or "").strip()
            description = str(activity.get("description") or "").strip()
            time = str(activity.get("time") or "").strip() or "09:00"
            if not title or not description:
                continue
            activities.append(
                Activity(
                    time=time,
                    title=title,
                    description=description,
                    estimated_cost=_as_cost(activity.get("estimated_cost")),
                )
            )
        if not activities:
            raise ValueError("A day was missing usable activities.")

        title = str(raw_day.get("title") or "").strip() or f"Day {index + 1}"
        days.append(
            DayPlan(date=day_date, day=index + 1, title=title, activities=activities)
        )

    return ItineraryResponse(
        destination=preferences.destination,
        currency=preferences.currency,
        source=provider,
        days=days,
    )


def generate_with_provider(
    preferences: TripPreferences, provider: str, api_key: str
) -> ItineraryResponse:
    from openai import OpenAI

    dates = _trip_dates(preferences)
    interests = ", ".join(preferences.interests) or "general sightseeing"
    if provider == "groq":
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
            timeout=60.0,
        )
        model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    else:
        client = OpenAI(api_key=api_key, timeout=60.0)
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    prompt = (
        "Create a practical day-by-day travel itinerary. "
        "Return JSON only with this shape: "
        '{"days":[{"date":"YYYY-MM-DD","title":"string","activities":'
        '[{"time":"HH:MM","title":"string","description":"string","estimated_cost":number}]}]}. '
        f"Destination: {preferences.destination}. "
        f"Dates in order: {', '.join(day.isoformat() for day in dates)}. The days array must contain exactly {len(dates)} objects, one for each listed date, in that order. "
        f"Budget: {preferences.budget} {preferences.currency} total for {preferences.travelers} travelers. "
        f"Pace: {preferences.pace}. Interests: {interests}. "
        "Every days entry must be a JSON object with date, title, and activities. Never put a plain string, label, note, or summary in the days array. Do not add extra entries. "
        "Keep estimated costs numeric and roughly within the overall budget."
    )
    response = client.chat.completions.create(
        model=model,
        max_completion_tokens=8192,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "travel_itinerary",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "date": {"type": "string"},
                                    "title": {"type": "string"},
                                    "activities": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "time": {"type": "string"},
                                                "title": {"type": "string"},
                                                "description": {"type": "string"},
                                                "estimated_cost": {"type": "number"},
                                            },
                                            "required": ["time", "title", "description", "estimated_cost"],
                                            "additionalProperties": False,
                                        },
                                    },
                                },
                                "required": ["date", "title", "activities"],
                                "additionalProperties": False,
                            },
                        }
                    },
                    "required": ["days"],
                    "additionalProperties": False,
                },
            },
        },
        messages=[
            {
                "role": "system",
                "content": "You are a travel planner that only returns valid JSON itineraries.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content or ""
    payload = _extract_json(content)
    return _normalize_model_payload(payload, preferences, provider)


def generate_itinerary(preferences: TripPreferences) -> ItineraryResponse:
    provider = os.getenv("AI_PROVIDER", "groq").strip().lower()
    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY", "").strip()
    elif provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
    else:
        raise ValueError("AI_PROVIDER must be set to 'groq' or 'openai'.")

    if not api_key:
        return build_demo_itinerary(preferences)
    return generate_with_provider(preferences, provider, api_key)
