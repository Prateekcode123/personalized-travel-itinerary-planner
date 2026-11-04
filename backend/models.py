from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ALLOWED_PACES = ("Relaxed", "Balanced", "Packed")
ALLOWED_INTERESTS = ("Food", "Culture", "Nature", "Sightseeing")
ALLOWED_CURRENCIES = ("USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD")
MAX_TRIP_DAYS = 14


class TripPreferences(BaseModel):
    destination: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    budget: float = Field(gt=0)
    currency: str = "USD"
    travelers: int = Field(ge=1, le=20)
    pace: str
    interests: list[str] = Field(default_factory=list)

    @field_validator("destination")
    @classmethod
    def normalize_destination(cls, value: str) -> str:
        destination = value.strip()
        if not destination:
            raise ValueError("Destination is required.")
        return destination

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        currency = value.strip().upper()
        if currency not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of: {', '.join(ALLOWED_CURRENCIES)}.")
        return currency

    @field_validator("pace")
    @classmethod
    def normalize_pace(cls, value: str) -> str:
        pace = value.strip().title()
        if pace not in ALLOWED_PACES:
            raise ValueError(f"Pace must be one of: {', '.join(ALLOWED_PACES)}.")
        return pace

    @field_validator("interests")
    @classmethod
    def normalize_interests(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in values:
            interest = item.strip().title()
            if interest not in ALLOWED_INTERESTS:
                raise ValueError(
                    f"Interests must be from: {', '.join(ALLOWED_INTERESTS)}."
                )
            if interest not in normalized:
                normalized.append(interest)
        return normalized

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before the start date.")
        trip_days = (self.end_date - self.start_date).days + 1
        if trip_days > MAX_TRIP_DAYS:
            raise ValueError(f"Trips can be at most {MAX_TRIP_DAYS} days long.")
        return self


class Activity(BaseModel):
    time: str
    title: str
    description: str
    estimated_cost: float = Field(ge=0)


class DayPlan(BaseModel):
    date: date
    day: int = Field(ge=1)
    title: str
    activities: list[Activity]


class ItineraryResponse(BaseModel):
    destination: str
    currency: str
    source: Literal["openai", "groq", "demo"]
    days: list[DayPlan]
