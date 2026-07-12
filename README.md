# productivity_app

A personal app for planning, executing, and evaluating weekly tasks, organized as a
DAG of goals and sub-tasks rather than a flat to-do list. See
`interpreted_app_description.md` for the full spec this was built from.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: FastAPI (Python)
- Data store: Redis (sole persistent store, AOF-backed)

## Views

- **Plan** — a VS Code–style tree of tasks (a DAG: a task can have more than one
  parent). Create, edit, delete, and reparent tasks; assign colors from a fixed
  palette (inherited down the tree, overridable per task); reserve time for a leaf
  task on the calendar to add it to the sprint.
- **Execute** — a Toggl-style timer. Start/stop tracking against a leaf task; the
  calendar shows actual logged time for elapsed periods and the remaining plan for
  time still ahead.
- **Evaluate** — review a week (any week, past or future) with Planned / Real / Diff
  calendar modes and a stats table (hours executed vs. planned, percentage, and
  finished/not-finished counts, broken down by task and rolled up to parent goals).

Task lifecycle: `backlog` → `sprint_backlog` (time reserved) → `in_progress` (timer
running) → `sprint_done` (timer stopped and marked done) → `done` (rolled over at the
end of the week it was planned for). Weeks start Monday; end-of-week rollover is
applied lazily on the next request once a week boundary has passed, not via a cron
job.

## Running locally

Requires Docker Desktop.

```
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (health check at `/health`, interactive docs at `/docs`)
- Redis: localhost:6379 (persisted in the `redis-data` Docker volume)

Source is bind-mounted into both containers with hot reload enabled, so edits to
`backend/` or `frontend/` take effect without rebuilding the image.

## Development

Backend tests:

```
cd backend
python -m venv .venv
.venv/Scripts/activate  # or source .venv/bin/activate on Linux/Mac
pip install -r requirements-dev.txt
pytest
ruff check .
```

Frontend tests:

```
cd frontend
npm install
npm test
npm run build   # type-check + production build
npm run lint
```

## Not yet implemented

- **Google Calendar sync** — deferred to a later phase. Reserving time in the Plan
  view calendar is local-only for now; it does not push to or pull from Google
  Calendar.
- **Users/auth** — first stage is single-user by design, so there's no login.
