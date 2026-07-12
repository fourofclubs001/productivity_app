# productivity_app

Personal task planning app (Plan / Execute / Evaluate) — see `interpreted_app_description.md` for the full spec.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: FastAPI (Python)
- Data store: Redis

## Running locally

```
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (health check at `/health`)
- Redis: localhost:6379

## Development

Backend tests:

```
cd backend
python -m venv .venv
.venv/Scripts/activate  # or source .venv/bin/activate on Linux/Mac
pip install -r requirements-dev.txt
pytest
```

Frontend tests:

```
cd frontend
npm install
npm test
```
