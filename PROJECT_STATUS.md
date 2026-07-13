# Project Status / Continuity Notes

Working notes for picking this project back up in a future session. Not user-facing
docs (see `README.md` for that) — this is "what's true right now and how we work
here."

## Where things stand (as of commit `e9ef01d`)

The app is fully built and working: Plan / Execute / Evaluate views, FastAPI +
Redis backend, React + Tailwind frontend, Google Workspace/Calendar-styled light
theme. All 8 items in `prompts/app_improvements_v00.md` and all 30 items in
`prompts/interpreted_app_improvements_v01.md` are implemented (12 milestones,
M1–M12, each its own commit). Test suite is green: 84 backend pytest cases, 95
frontend Vitest cases, 27 Playwright E2E specs.

The v01 pass added: dev/prod Docker split, task ordering + drag-and-drop
reparent/reorder, a prerequisite/dependency graph with cycle detection,
drag-to-schedule + calendar move/resize/click-to-open, a client-side undo
stack (ctrl+z), two-color calendar chips, resizable panels, sprint-done/
parent-removal lifecycle visibility, estimated-hours rollup + coverage, a
definition-of-done confirmation modal, and Plan-panel-order tree shape
(with expand/collapse) applied consistently to the Execute task picker and
both Evaluate lists (Metrics table + task filter).

`docker compose up --build` from the repo root runs the whole stack. Backend
`/health` should return `{"status":"ok","redis":true}` once up.

## The workflow established for this project

This has repeated twice now (initial build, then the v00 improvements pass) and is
worth reusing rather than reinventing:

1. User drops a plain, unstructured bullet list into `prompts/app_improvements_vNN.md`.
2. Read it, ask clarifying questions for genuinely ambiguous items via
   `AskUserQuestion` (not everything — only real ambiguity, and note assumptions for
   the rest), then write `prompts/interpreted_app_improvements_vNN.md`: an ordered,
   clarified restatement incorporating the answers.
3. Commit + push the `prompts/` addition on its own (small, low-risk commit).
4. Enter plan mode, design an implementation approach — usually one milestone per
   improvement or tightly-related group — and get it approved.
5. Implement milestone by milestone. Each milestone: backend `pytest` + `ruff check
   .`, frontend `npm test` + `npm run build` + `npm run lint`, plus a Playwright spec
   exercising the change against the real running stack — all green before
   committing. One commit per milestone, pushed immediately after (this repo's
   established preference: commit at each milestone, push after each).
6. Use Playwright (`frontend/e2e/`), not claude-in-chrome, for all frontend/
   integration verification. It's seconds instead of minutes and leaves a reusable
   regression spec behind. For one-off visual checks, write a throwaway spec that
   calls `page.screenshot({ path: 'e2e/.screenshots/x.png' })` and `Read` the PNG
   directly, then delete the throwaway spec+screenshots before committing — don't
   commit assertion-less specs as if they were real tests.

## Known limitations (deliberately deferred, not bugs)

- **Google Calendar sync** — not implemented. Reserving time in Plan is local-only.
- **No auth/users** — single-user by design for this stage.
- **Timezone boundaries are UTC, not the user's local time.** The backend stores and
  buckets everything in UTC (`datetime.now(UTC)`, week/day/month math all UTC-based).
  The frontend was fixed this session (`frontend/src/lib/time.ts`'s `utcNow()`) to
  agree with the backend on what "the current week/day/month" is — before that fix,
  frontend and backend could disagree near a UTC day boundary, which is a real bug
  and is now closed. But the underlying boundary is still UTC, not the user's actual
  local midnight/Monday. For a non-UTC user this means calendar periods can be a few
  hours "off" from their real local week. A proper fix means threading a timezone
  offset from client to backend and using it in every boundary calculation
  (`interval_repository.monday_of`, `evaluate_service._period_bounds`,
  `rollover_service`, etc.) — not attempted, flagged as a possible future item.
- **Minor tree UX rough edge, not fixed:** adding a sub-task via a node's "+" button
  in the Plan tree doesn't auto-expand that node, so the new child is invisible until
  you manually click the parent's chevron. Noticed while writing a Playwright spec;
  out of scope of the v00 improvements list, so left alone.

## Environment notes

- **Dev/prod Docker split (added in the v01 pass, milestone M1):** there are now two
  fully isolated compose stacks, never sharing ports or Redis volumes.
  - **Prod** — `docker-compose.yml`, ports 8000/5173/6379, volume `redis-data`. Real
    data. No bind mounts — code is baked into the image at build time, so "shipping" a
    feature is just `docker compose up --build` again.
  - **Dev** — `docker-compose.dev.yml`, ports 8001/5174/6380, volume `redis-data-dev`.
    Isolated data, bind-mounted source + hot reload, safe to flush/break. Started with
    `docker compose -f docker-compose.dev.yml up --build`.
  - **All Playwright E2E specs and all day-to-day development from here on must target
    the dev stack, never prod** — Playwright's global setup (`frontend/e2e/global-setup.ts`)
    runs `redis-cli FLUSHALL` at the start of every run, and it's now hardwired to
    `docker-compose.dev.yml` specifically so this can't accidentally hit prod data.
  - Both Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`) are multi-stage with
    `dev`/`prod` build targets rather than being separate files, so they can't drift
    apart. The frontend's prod target runs `vite build` + `vite preview`; note Vite
    inlines `VITE_*` env vars at **build time**, so `VITE_API_BASE_URL` is passed as a
    Docker build `arg` in `docker-compose.yml`, not as a runtime `environment:` entry
    (that would be too late for a build that already happened).
  - **Gotcha hit during M5:** the dev compose file bind-mounts `./frontend:/app` plus an
    anonymous volume for `/app/node_modules`, so that node_modules survives host bind
    mounts. That anonymous volume also **survives `docker compose -f
    docker-compose.dev.yml up --build`** across container recreations — Compose reuses
    it rather than replacing it with the freshly-`npm install`ed layer from the new
    image. Net effect: adding a new frontend dependency (e.g. `@dnd-kit/core`) and
    running `up --build` silently keeps serving the *old* `node_modules`, missing the
    new package, with no error until something tries to import it. Fix when this
    happens: `docker compose -f docker-compose.dev.yml stop frontend && docker compose
    -f docker-compose.dev.yml rm -f -v frontend && docker compose -f
    docker-compose.dev.yml up -d --build frontend` (the `-v` on `rm` is what actually
    drops the stale anonymous volume). Same applies to the backend if a Python
    dependency is ever added, though it has no anonymous volume today since
    `backend/requirements.txt` installs happen in a layer that isn't bind-mount-shadowed.
- **Gotcha hit during M8:** `react-big-calendar/lib/addons/dragAndDrop`'s default export
  comes through **double-wrapped** (`mod.default.default`, an object rather than the
  `withDragAndDrop` function itself) specifically under Vite's **dev-server** esbuild
  dependency pre-bundling — a CJS/ESM interop quirk of that package's export shape. It
  resolves correctly as a plain function under both vitest and the production `vite
  build` (Rollup), so this only surfaces as a runtime `TypeError: withDragAndDrop is not
  a function` in the browser against the dev stack, with **no build-time or type error
  anywhere** (`tsc`, `vitest`, and `vite build` all pass clean) — the first sign is a
  blank white page with all network requests returning 200 and nothing in the console.
  Diagnosed by executing `import('/src/main.tsx')` directly in the browser console via
  claude-in-chrome to surface the swallowed exception. Fixed in
  `frontend/src/components/calendar/PlanCalendar.tsx` with a defensive unwrap
  (`typeof x === 'function' ? x : x.default`) rather than assuming either shape. Worth
  remembering if another dual CJS/ESM package added later exhibits the same "works in
  tests/build, blank page in dev" symptom.
- **Gotcha hit during M12:** don't nest an interactive `<button>` inside a `<label>`
  that also wraps a `<checkbox>` (e.g. an expand/collapse chevron next to a
  checkbox row) — browsers' accessible-name computation gets confused by two
  interactive elements sharing one label, and the checkbox's accessible name
  comes back empty (Testing Library's `getByRole('checkbox', { name })` then
  fails to find it, even though the row renders and looks correct). Fix: keep
  the chevron button as a sibling *outside* the `<label>`, with the `<label>`
  wrapping only the checkbox + its text (see `TaskFilter.tsx`).
- Backend venv: `backend/.venv`. Frontend deps: `frontend/node_modules`. Both already
  installed — no fresh `pip install`/`npm install` needed unless dependencies change.
- Playwright's Chromium binary is installed (`npx playwright install chromium` was
  already run). E2E specs require the **dev** compose stack running first (global
  setup health-checks `/health` on port 8001 and flushes the dev Redis) and run
  single-worker — the backend's active-timer is one global Redis key, so parallel
  timer specs would interfere.

## Quick command reference

```
# Backend
cd backend && .venv/Scripts/python.exe -m pytest -q
cd backend && .venv/Scripts/python.exe -m ruff check .

# Frontend
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npx playwright test        # requires docker-compose.dev.yml stack already running

# Docker
docker compose up --build                              # prod: real data, ports 8000/5173/6379
docker compose -f docker-compose.dev.yml up --build     # dev: isolated data, ports 8001/5174/6380
```

## Next possible steps

- A raw `prompts/app_improvements_v02.md` has already been dropped in the repo
  (untracked as of this note) — next session should read it and repeat the
  workflow above: interpret, clarify, commit the interpreted doc, plan, then
  implement milestone by milestone.
- Revisit the UTC-vs-local-timezone limitation if week/day boundaries ever look
  wrong to the user in practice.
- Revisit the tree auto-expand-on-add-child gap if it becomes annoying.
