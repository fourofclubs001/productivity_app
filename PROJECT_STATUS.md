# Project Status / Continuity Notes

Working notes for picking this project back up in a future session. Not user-facing
docs (see `README.md` for that) — this is "what's true right now and how we work
here."

## Where things stand (as of commit `2eda462`)

The app is fully built and working: Plan / Execute / Evaluate views, FastAPI +
Redis backend, React + Tailwind frontend, Google Workspace/Calendar-styled light
theme. All 8 items in `prompts/app_improvements_v00.md` are implemented. Test suite
is green: 53 backend pytest cases, 22 frontend Vitest cases, 5 Playwright E2E specs.

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

- `docker compose` stack was left running at the end of this session (ports
  8000/5173/6379); Redis was flushed clean (no leftover test data).
- Backend venv: `backend/.venv`. Frontend deps: `frontend/node_modules`. Both already
  installed — no fresh `pip install`/`npm install` needed unless dependencies change.
- Playwright's Chromium binary is installed (`npx playwright install chromium` was
  already run). E2E specs require `docker compose up` running first (global setup
  health-checks `/health` and flushes Redis) and run single-worker — the backend's
  active-timer is one global Redis key, so parallel timer specs would interfere.

## Quick command reference

```
# Backend
cd backend && .venv/Scripts/python.exe -m pytest -q
cd backend && .venv/Scripts/python.exe -m ruff check .

# Frontend
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npx playwright test        # requires docker compose up already running
```

## Next possible steps

- More improvements: create `prompts/app_improvements_v01.md` and repeat the
  workflow above.
- Revisit the UTC-vs-local-timezone limitation if week/day boundaries ever look
  wrong to the user in practice.
- Revisit the tree auto-expand-on-add-child gap if it becomes annoying.
