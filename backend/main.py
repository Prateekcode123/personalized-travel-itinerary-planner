from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from itinerary import generate_itinerary
from models import ItineraryResponse, TripPreferences

load_dotenv()

app = FastAPI(title="Personalized Travel Itinerary Planner")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Personalized Travel Itinerary Planner API"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/trips/generate", response_model=ItineraryResponse)
def generate_trip(preferences: TripPreferences):
    try:
        return generate_itinerary(preferences)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Could not generate an itinerary: {error}",
        ) from error
