# Personalized Travel Itinerary Planner

Starter project for a travel itinerary planner. The frontend is a React app built with Vite. The backend is a FastAPI API. Database setup will live in `supabase/` later.

## Local run

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app runs at http://localhost:5173.

### Backend

```bash
cd backend
cp .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at http://localhost:8000. Health check: http://localhost:8000/health.

Copy `.env.example` to `.env` and fill in local values as needed. Do not commit `.env` files or real API keys.
