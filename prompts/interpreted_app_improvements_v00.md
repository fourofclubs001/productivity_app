# Interpreted App Improvements (v00)

Ordered restatement of `app_improvements_v00.md`, with the ambiguous items resolved
per your answers below each one.

## 1. Block deleting a task with a running timer

- If the task currently being tracked by the active timer is deleted, reject the
  deletion.
- Show an inline message (in the Plan view's task detail panel, where the Delete
  button lives) explaining that the task's timer is running and must be stopped
  first.
- This directly closes the "delete a task mid-timer" gap discussed earlier: instead
  of silently leaving a dangling active entry, deletion is blocked outright until
  the timer is stopped.

## 2. Reskin the whole app: Google Workspace look, Google Calendar–style calendars

- Replace the current dark, VS Code–styled theme everywhere (task tree, detail
  panel, calendars, tabs) with a light Google Workspace–style theme — **full
  replacement, no dark mode toggle** (confirmed).
- The task tree keeps its current behavior (expand/collapse, DAG rendering,
  create/edit/delete/reparent) — only the visual skin changes, not the file-explorer
  interaction model.
- The calendars (Plan / Execute / Evaluate) should specifically match the look of
  `prompts/references/google_calendar.png`: white background, thin light-gray
  gridlines, day headers as "MON 13" (abbreviated day name + date number stacked),
  a timezone label in the top-left corner of the grid, and solid rounded-corner
  colored event chips (blue/orange-style palette) rather than the current dashed/
  transparent styling.

## 3. Stop the timer immediately when "Stop" is clicked

- Currently, clicking "Stop" only reveals the "mark as done?" choice — the timer
  keeps running (and the elapsed time keeps accruing) until "Yes, done" or "No,
  keep in progress" is picked.
- Change this so the timer actually stops (the entry's end time is recorded, the
  live clock freezes) the instant "Stop" is clicked. The "mark as done?" choice
  then applies retroactively to that already-stopped entry's task, rather than
  gating when the stop happens.
- Implementation note: this means the backend needs a way to record "stop now, decide
  done-or-not after" — i.e. decouple ending the timer entry from setting the task's
  done state, instead of doing both in one `POST /timer/stop { mark_done }` call as
  today.

## 4. Exclude finished tasks from the timer's task picker

- The Execute view's "select a task" dropdown currently only excludes tasks in
  state `done`, not `sprint_done`. Fix the filter to exclude both — a task that's
  been marked done for the current sprint shouldn't be selectable to start a new
  timer against.

## 5. Use Playwright instead of claude-in-chrome for testing going forward

- Set up Playwright as a real, repeatable E2E test suite (e.g. `frontend/e2e/` with
  its own `playwright.config.ts`, pointed at the running `docker compose` stack).
- Convert the flows previously verified by hand via claude-in-chrome — task
  create/edit/delete/reparent, drag-to-schedule, timer start/stop/mark-done,
  Evaluate stats — into actual Playwright spec files that live in the repo and run
  in seconds.
- From here on, use Playwright (not claude-in-chrome) as the way to verify
  frontend/integration behavior.

## 6. Fade past events on the Execute calendar

- On the Execute view's calendar, events whose time has already passed (before the
  current moment) should render slightly transparent compared to events still ahead
  of the current moment (which render at full opacity).
- This is an addition to, not a replacement of, the existing actual-vs-planned
  distinction — past events are actual entries (currently solid-filled) and future
  events are planned intervals (currently dashed outline); the past ones just get a
  reduced-opacity treatment on top of that.

## 7. Remove the "Actual / Planned" legend from the Execute view

- Delete the small "● Actual  ○ Planned" legend currently shown above the Execute
  calendar, top-right.

## 8. Split the Evaluate view into Calendar and Metrics subtabs, with filters on Metrics

- Add two subtabs within Evaluate:
  - **Calendar** — the existing week navigation + Planned/Real/Diff calendar.
  - **Metrics** — the existing stats (summary tiles + per-task table), plus new
    filters described below.
- **Time-period filter**: a granularity switch — **Day / Week / Month** — where
  picking a granularity changes what one "period" means, and Prev/Next navigate
  through periods of that size (the same navigation pattern the app already uses
  for weeks, just generalized to day- and month-sized periods too). Not a
  free-form date range picker (confirmed).
- **Task filter**: a multi-select of tasks that narrows the Metrics subtab.
  Confirmed behavior:
  - Selecting tasks recomputes **everything** on the subtab — both the summary
    tiles and the per-task table — to reflect only the selected tasks, not just
    the table rows.
  - Selecting a parent "goal" task automatically includes all of its descendant
    leaf tasks' time, consistent with how goal-level rollup already works
    elsewhere in Evaluate (a goal's own hours are always the sum of its
    scheduled/executed descendant leaves, never logged directly against the goal
    itself).
  - Implementation note: this generalizes the current `/evaluate/week` endpoint,
    which only aggregates by ISO week, into something that accepts a period
    granularity + date and an optional task-id filter.

## Notes

- Item 2 in the original file had a stray trailing "per" that reads like a typo
  ("...calendar look.per") — ignored as noise, not a real requirement.
