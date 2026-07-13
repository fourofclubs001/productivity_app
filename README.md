# productivity_app

A personal app for planning, executing, and evaluating weekly tasks, organized as a
DAG of goals and sub-tasks rather than a flat to-do list. See
`prompts/interpreted_app_description.md` for the original spec this was built from,
and `prompts/interpreted_app_improvements_v00.md` for the follow-up changes layered
on top of it.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: FastAPI (Python)
- Data store: Redis (sole persistent store, AOF-backed)
- E2E tests: Playwright, against the real `docker compose` stack

## Views

- **Plan** — a tree of tasks (a DAG: a task can have more than one parent). Create,
  edit, delete, and reparent tasks; assign colors from a fixed palette (inherited
  down the tree, overridable per task); reserve time for a leaf task on the calendar
  to add it to the sprint. Deleting a task is blocked while its timer is running.
- **Execute** — a Toggl-style timer. Start/stop tracking against a leaf task — the
  clock stops the instant Stop is clicked, and marking the task done is a separate
  follow-up choice, not a gate on stopping. The calendar shows actual logged time for
  elapsed periods (dimmed once past) and the remaining plan for time still ahead.
- **Evaluate** — has two subtabs:
  - **Calendar** — review a week (any week, past or future) with Planned / Real /
    Diff modes.
  - **Metrics** — the same stats (hours executed vs. planned, percentage, and
    finished/not-finished counts, broken down by task and rolled up to parent goals)
    for a Day, Week, or Month at a time, optionally filtered to one or more tasks
    (selecting a goal automatically includes its sub-tasks).

Task lifecycle: `backlog` → `sprint_backlog` (time reserved) → `in_progress` (timer
running) → `sprint_done` (timer stopped and marked done) → `done` (rolled over at the
end of the week it was planned for). A task marked `sprint_done` or `done` can't be
selected to start a new timer against. Weeks start Monday; end-of-week rollover is
applied lazily on the next request once a week boundary has passed, not via a cron
job.

The whole app is styled to look like a Google Workspace app — light theme, and the
calendars specifically modeled on Google Calendar's look
(`prompts/references/google_calendar.png`).

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

Frontend unit/component tests:

```
cd frontend
npm install
npm test
npm run build   # type-check + production build
npm run lint
```

End-to-end tests (Playwright, requires `docker compose up` already running):

```
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e
```

Specs live in `frontend/e2e/`. They run against the real stack (real FastAPI, real
Redis) rather than mocks, single-worker (the backend's active-timer is a single
global key, so timer specs can't run concurrently), and flush Redis once at the start
of the run via a Playwright global setup.

## API notes

- `GET /evaluate/period?granularity={day|week|month}&date=YYYY-MM-DD&task_ids=...` —
  stats for the day/week/month containing `date`, optionally filtered to one or more
  task ids (repeat the `task_ids` param for more than one). Replaced the earlier
  week-only `GET /evaluate/week`.
- `POST /timer/stop` takes no body — it just ends the active entry now. Marking the
  task done afterward is a separate `POST /timer/mark-done { task_id }` call.

## Not yet implemented

- **Google Calendar sync** — deferred to a later phase. Reserving time in the Plan
  view calendar is local-only for now; it does not push to or pull from Google
  Calendar.
- **Users/auth** — first stage is single-user by design, so there's no login.
