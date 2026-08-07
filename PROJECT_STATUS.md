# Project Status / Continuity Notes

Working notes for picking this project back up in a future session. Not user-facing
docs (see `README.md` for that) — this is "what's true right now and how we work
here."

## Where things stand (as of M67, post-v07)

The app is fully built and working: Plan / Execute / Evaluate views, FastAPI +
Redis backend, React + Tailwind frontend, Google Workspace/Calendar-styled light
theme. v00 (8 items), v01 (30 items, M1–M12), v02 (19 items, M13–M23), v03
(11 items, M24–M34, plus one post-v03 ad hoc fix), v04 (4 items, M35–M39:
Google Calendar sync + routine/recurring tasks, plus one post-v04 ad hoc fix,
M40: pulling Google events back into Plan/Execute), v05 (11 items, M41–M49:
timer stop UX, two real bug fixes, the "routine"→"recurrent task" rename,
recurrent-task groups + drag-and-drop, and drag-to-create on the Plan
calendar), and v06 (5 items, M50–M54: Execute/Evaluate dropdown grouping,
a live drag reorder-line indicator on the Plan tree, a Configuration dialog,
idle-detection auto-stop for time tracking, and a dynamic favicon reflecting
timer state) are all fully implemented, committed, and pushed.

**Deployed to prod as of 2026-07-26** — `docker compose up --build -d` run
against the prod stack (ports 8000/5173/6379). Frontend-only change, no
migration needed (unlike v05) — only the `frontend` container was rebuilt/
recreated, `backend` stayed running throughout. Verified post-deploy:
`/health` ok, frontend 200, and the served bundle's asset hash
(`index-yAtv-TKV.js`) matches the final dev build, confirming M50–M54 are
live.

**Redeployed to prod as of 2026-07-27** (M55, M56) — this pass touched
both backend and frontend, so `docker compose up --build -d` rebuilt/
recreated both containers this time. Verified post-deploy: `/health` ok,
frontend 200, served bundle's asset hash (`index-DwedjtUy.js`) matches the
final build.

v07 (13 items, M57–M67: leaf-visibility bugs, idle-detection removal +
timer-in-title, existing-task reparenting, Google-event detail panel,
delete-with-children, a drag/resize investigation, cascading mark-done,
recurrent-generation windowing, Execute picker filtering, a boot script,
and colored task indicators everywhere) is now fully implemented,
committed, and pushed — see the v07 milestones section below and
`prompts/interpreted_app_improvements_v07.md` for the full item list and
root-caused diagnoses.

**Redeployed to prod as of 2026-08-06** (M57–M67) — this pass touched both
backend and frontend, so `docker compose up --build -d` rebuilt/recreated
both containers. Verified post-deploy: `/health` ok (`redis: true`),
frontend 200, served bundle's asset hash (`index-BxjEmCtc.js`) matches the
final build.

No further `prompts/app_improvements_vNN.md` is pending — the next one
arrives whenever the user drops one in, per the workflow below.

### v02 milestones (M13–M23, one commit each, all pushed)

- **M13** (`f60e1e4`) — reusable `AlertDialog`, replacing inline error banners/text
  across Plan calendar, task detail panel, add-to-calendar modal.
- **M14** (`7c67b76`) — scheduling gated on temporal order (a task can be scheduled
  once its prerequisite is itself scheduled before it; blocks outright if the
  prerequisite has zero intervals); time-tracking gated on prerequisites reaching
  sprint-done; requiring an ancestor task now rejected as a cross-graph cycle.
- **M15** (`7a977a4`) — interval creation rejects past start times; deleting a task
  only cleans up its future (not-yet-started) intervals now, not past/in-progress
  ones. Required rebasing several backend test fixtures off a hardcoded
  `2026-07-13` date (which had itself become "the past" by the time this session
  ran) onto a dynamically-computed future Monday/month, plus fixing a few
  Playwright specs whose fixed "today at 9am UTC" fixtures had the same problem —
  see the new `frontend/e2e/helpers/time.ts`'s `todayAt()`.
- **M16** (`f5405ad`) — past/in-progress/future edit-lock rules for scheduled
  intervals (`frontend/src/lib/intervalTiming.ts`), past Plan chips render
  transparent, "Edit time" added to the calendar chip's right-click context menu.
- **M17** (`42f642f`) — drag-to-schedule shows a Google-Calendar-style live
  drop-preview ghost chip, snapped to the grid, before the drop happens
  (`slotToPixelRect` in `calendarGeometry.ts`).
- **M18** (`355cdfa`) — undo/redo reworked: `UndoEntry` is now a self-describing
  `{label, run()}` shape (run performs the action and returns the entry that
  reverses it), so repeated undo/redo stays correct even when an action recreates
  a row under a new server-generated id. Ctrl+Y (and Ctrl+Shift+Z) now redoes.
  Interval creation (drag-to-schedule and the "Add to calendar" modal) is now
  undoable too — v01 scoped this but never actually wired it up.
  - **Gotcha discovered during M18** (not yet fixed, just worked around in tests):
    dragging a task row that requires scrolling the left tree panel into view (a
    long, suite-accumulated task list) throws off dnd-kit's reported pointer
    delta (`event.delta` ends up wrong by a large, deterministic offset once the
    source row needed a scroll to reach), causing `resolveDropSlot` to compute an
    out-of-bounds point and silently no-op the schedule — no error dialog, the
    chip just never appears. Root-caused via `console.log`-instrumented debug
    Playwright specs (see the pattern in this file's earlier "M8/M12 gotcha"
    entries). Disabling dnd-kit's `autoScroll` on `PlanView`'s `DndContext` did
    **not** fix it (tested — reverted that change). The actual fix applied was
    at the test level only: `frontend/e2e/undo.spec.ts`'s drag-created-interval
    test now does `page.setViewportSize({width:1280, height:3000})` before
    dragging, so the row is always in view without scrolling. **This is a real,
    unfixed latent bug in production drag-to-schedule** for a user with a long
    enough task list that the target row needs scrolling — flagged here since it
    wasn't fixed, only avoided in tests.
- **M19** (`f2a321f`) — task detail panel restructured: manual "Estimated hours"
  input removed (calendar-derived coverage is now the only estimate display);
  "+ Child task" moved from the top row to a new section below Parents; bottom
  "Delete task" button replaced by a top-right kebab (⋮) "Options" menu (reusing
  `ContextMenu.tsx`) with a confirm step (new `ConfirmDialog.tsx`); leaf tasks
  in-progress get a "Mark sprint done" button reusing the existing
  `DoneConfirmModal`. Added `GLOSSARY.md` at repo root (kebab menu / context menu
  terms). New shared `frontend/src/lib/taskDoneUndoEntries.ts`, also adopted by
  `TimerControl.tsx` to de-duplicate mark/revert-done undo-entry logic.

- **M20** (`c1916c8`) — item 19: a kept ("No, don't remove") root task whose
  children are all done/sprint_done now displays as `backlog`, not the
  live-computed `done`, until it gets a new not-yet-finished child.
  - Backend: new `state_override` task hash field. `_compute_state` checks it
    *before* the normal derivation — if `state_override == "backlog"` and all
    leaf descendants are still in `{sprint_done, done}`, returns `backlog`;
    otherwise falls through to normal live computation unchanged. **No
    explicit clear-on-event logic** — the override is just another input
    consulted at read time, so it's naturally bypassed the instant a child
    reopens or a new unfinished child is added. New
    `TaskService.keep_as_backlog(task_id)` (validates the task is non-leaf and
    all its leaf descendants are already `{sprint_done, done}`, mirroring the
    frontend's `qualifiesForRemovalPrompt` condition), new error
    `TaskNotEligibleForBacklogOverrideError`, new endpoint `POST
    /tasks/{task_id}/keep-as-backlog`. 6 new pytest cases (91→102 total).
  - Frontend: the tree's "No" (decline removal) button now also fires the new
    `useKeepAsBacklog()` mutation alongside the existing `onDecide(taskId,
    'kept')` localStorage call. `frontend/src/components/tree/TaskTree.test.tsx`
    needed no mock changes — it uses `renderWithClient`'s real
    `QueryClientProvider`, and the new hook is never actually invoked by
    existing test interactions. Extended
    `frontend/e2e/lifecycle-visibility.spec.ts`'s decline-removal test to
    assert the `StateBadge` reads "Backlog" after declining and reverts to the
    live-computed state (`In progress`, in the test's fixture) once a new
    unfinished child is added.
- **M21** (`3c67877`) — backend half of the "Excuses" feature (v02 items 17/18):
  a new `Excuse` domain lets a specific gap (task + time range) be tagged with
  a reusable, named reason. New `ExcuseRepository` (Redis hash + by-start
  sorted set, mirroring `EntryRepository`), `ExcuseService`, `GET /excuses`,
  `POST /excuses/attach`, `GET /excuses/frequency` (period-scoped, same
  query shape as `GET /evaluate/period`). Typed excuses are de-duplicated by
  normalized (trim+lowercase) text; re-explaining the exact same gap updates
  that attachment in place rather than creating a duplicate (so frequency
  counts don't double up). Extracted `Granularity`/`period_bounds` out of
  `evaluate_service.py` into a new shared `period_utils.py` (evaluate_service
  re-exports `Granularity` so `routers/evaluate.py`'s import is unaffected).
  11 new pytest cases (102→113 total).
- **M22** (`e345978`) — real gap/overlap computation for the Evaluate diff
  calendar. New `frontend/src/lib/intervalDiff.ts` diffs each planned interval
  against real tracked time for the same task (merging overlapping real
  ranges, clipping to the planned bounds, subtracting to get uncovered gaps)
  — replacing the old naive `[...planned, ...real]` concat. `EvaluateCalendar`
  renders one chip per resulting segment in diff mode; only uncovered segments
  are clickable (distinct style + cursor), firing a new `onExplainGap`
  callback prop that `EvaluateView` uses to open a new `ExplainGapDialog.tsx`
  (pick an existing excuse or type a new one, POSTing via the M21 endpoint).
  The separate real-entry chips are still rendered as before, so tracked time
  with no corresponding plan stays visible. 19 new vitest cases.
- **M23** (`80f515a`) — third Evaluate subtab, "Excuses": a period-scoped
  frequency table (reusing Metrics' existing Day/Week/Month nav) showing
  overall totals and a by-task breakdown, via new `ExcusesPanel.tsx` (mirrors
  `StatsPanel.tsx`'s table conventions, flat rather than tree-based since
  excuses aren't hierarchical). New `frontend/e2e/excuses.spec.ts` exercises
  the whole feature end-to-end (schedule an untracked task → click the
  fully-uncovered gap → save a new excuse → see it in the Excuses subtab).
  **This completes the v02 pass.**

### v03 milestones (M24–M34, one commit each, all pushed)

- **M24** (`c3fd340`) — item 3: "Save"/"Discard" buttons moved from below
  "Estimated time" to the detail panel header's top-right, next to the kebab
  (⋮) Options button. New "Discard" resets local `name`/`dod` state back to
  the task's last-saved values, no mutation, no navigation.
- **M25** (`2655f01`) — item 2: right-click "Delete" on a Plan left-panel task
  row, reusing the same `ContextMenu`/`ConfirmDialog` pair the calendar
  chip's right-click and the detail panel's kebab menu already use, wired to
  `useDeleteTask`.
- **M26** (`158b1dd`) — item 5: Requires dropdown gets Execute's `TaskPicker`
  indented-tree presentation instead of a flat alphabetical `<select>`.
  Generalized `TaskPicker` with `isHidden`/`isSelectable`/`placeholder`/
  `emptyMessage` props (defaults preserve Execute's existing behavior
  exactly) — Requires passes `isSelectable={() => true}` so goal (non-leaf)
  tasks stay selectable there, unlike Execute's leaf-only restriction.
- **M27** (`194a40e`) — item 4: `IntervalTimeFields.tsx`'s single shared `day`
  field split into independent `startDate`/`endDate`, so an interval can
  represent a plan crossing midnight. Validation now compares full combined
  datetimes. `defaultTimeValue()`'s 1-hour quick-default is clamped to stay
  same-day when the natural +1h would cross midnight, because of a
  **newly-discovered, unfixed latent bug**: PlanCalendar's react-big-calendar
  week/day grid doesn't render a chip at all for an event whose date range
  spans midnight (confirmed via a throwaway debug spec) — see "Known
  limitations" below.
- **M28** (`a1ee33b`) — item 11: `Entry`/`Interval` now snapshot the task's
  name at creation time (`task_name`, nullable for pre-existing rows), so a
  deleted task's still-preserved past intervals/entries keep showing their
  real name on Execute/Evaluate/Plan instead of falling through to "Unknown
  task". Surfaced and fixed a real bug along the way: `useDeleteTask()`
  never invalidated the intervals/entries query caches, so the Plan calendar
  kept showing a just-deleted task's future-interval chip (previously masked
  because its title silently fell back to "Unknown task" once the task left
  the cache, which looked enough like "gone" to pass the pre-existing test).
- **M29** (`0040bcc`) — item 6: interval *deletion* brought under the same
  edit-lock M15/M16 already apply to interval *editing* — new
  `IntervalDeleteLockedError`, raised whenever the interval's start isn't
  strictly in the future. Both delete entry points (detail panel's "×",
  calendar chip's right-click "Delete") now show an explanatory dialog
  instead of calling the mutation, applied consistently to both.
- **M30** (`dc73948`) — item 9: excuses can now only be attached to gaps
  fully in the past — a future planned interval trivially has no real
  tracked time yet, so it isn't "missed" yet either. `EvaluateCalendar`'s
  diff-mode uncovered segments only fire `onExplainGap` (and only get
  interactive styling) once `isFullyPast`; backend `ExcuseService.attach`
  gets a matching `FutureGapExcuseError` guard against a client hitting the
  endpoint directly.
- **M31** (`7fe35e0`) — item 7: the existing-chip reschedule drag now hides
  the source chip for the gesture's duration instead of showing react-big-
  calendar's default "looks like two chips" visual. **Gotcha discovered**:
  the addon's own `onDragStart`/`onBeginAction` fires on *every* mousedown on
  a draggable chip — including a plain click, not just a real drag — so
  using it directly to hide the chip broke left-click-to-open-detail
  entirely (root-caused by reading the library's source, since the bug
  reproduced identically in isolation). Fixed by tracking mousedown-then-
  movement-past-a-5px-threshold ourselves, mirroring how the library's own
  `Selection` helper distinguishes a click from a drag.
- **M32** (`57ae008`) — item 1: dragging a past-locked chip's start to a
  future slot now creates a new interval at the drop target and leaves the
  original completely untouched (a copy, not a move) — a deliberate,
  narrow exception to the M16 edit lock. Dragging to another past slot is
  still rejected. `draggableAccessor` relaxed to allow starting the gesture
  for any chip; the branch logic is extracted to a pure
  `resolveDragRescheduleAction()` in `intervalTiming.ts` so it's unit-
  testable directly, since genuinely past/in-progress intervals can't be
  created through the public API at all (same limitation as M16/M29's lock
  tests).
- **M33** (`229c20e`) — item 8: Ctrl+Z/Ctrl+Y scoped per view. Each
  `UndoEntry` now carries a `views: ViewKey[]` tag (new `lib/views.ts`), set
  at push time — normally just the pushing view, except the mark/revert-done
  pair (pushed from both Execute's stop-timer flow and Plan's own "Mark
  sprint done" button, touching state both views' displays depend on), which
  is tagged for both. `App.tsx` threads its `activeView` state into
  `UndoProvider` as a prop; Ctrl+Z/Ctrl+Y scan the stack from the top for the
  most recent entry tagged with the active view and splice it out —
  skipped-over entries for other views stay in place, poppable once that
  view is active again. Pushing a new entry only invalidates the redo stack
  for its own view(s).
- **M34** (`95e3d79`) — item 10: a root task now returns to `backlog`
  (rather than reading as a leaf) when its last remaining child is deleted
  outright, not just completed. New monotonic `ever_had_children` marker
  (set the instant a task gains its first child, in
  `TaskRepository.add_child_edge` — the single choke point every
  parent-gaining path funnels through) keeps a childless former-goal reading
  as `is_leaf: false` and its state as the normal live-computed default
  (or the `state_override` "keep as backlog" choice) rather than falling
  back to its own raw `state` field. `keep_as_backlog` and the frontend's
  `qualifiesForRemovalPrompt` are both relaxed to accept this case, reusing
  the existing "keep as backlog?" prompt row unchanged. A task that never
  had children is unaffected.

### Post-v03 ad hoc fix: cross-midnight chip rendering

- Fixed the "PlanCalendar doesn't render a chip for a cross-midnight interval"
  known limitation flagged during M27/M34 above, prompted by the user hitting
  it in practice on the **Execute** calendar (a tracked time entry that ran
  past midnight had no visible chip at all). Root cause was confirmed to be
  in `react-big-calendar` itself, not app-specific: its week/day time grid
  simply can't render an event whose start/end fall on different **local**
  calendar days, and all three calendars (`PlanCalendar.tsx`,
  `ExecuteCalendar.tsx`, `EvaluateCalendar.tsx`) feed it events through the
  same path, so the bug was never actually Plan-only, just first noticed
  there.
  - Fix: new `frontend/src/lib/splitEventAcrossDays.ts` (`splitAcrossDays`)
    clips any event spanning local midnight into one segment per day it
    touches — mirroring how the library's own month view already splits
    multi-day all-day events. All three calendars' `events` memos now
    `flatMap` through it.
  - `PlanCalendar.tsx` is the one interactive calendar (drag-move, edge-
    resize), so a new `CalendarEvent.isMultiDaySegment` flag disables
    `draggableAccessor`/`resizableAccessor` for split segments — dragging a
    visually-clipped day-segment would otherwise report only that day's
    partial range to `onEventDrop`/`onEventResize`, silently truncating the
    real interval. The custom mousedown/mousemove drag-arm listener (see
    M31's gotcha above) got the same guard. A cross-midnight interval stays
    fully editable via the existing "Edit time" modal (typed start/end
    dates, from M27) and right-click delete; only body-drag/edge-resize are
    excluded for that one case.
  - Execute/Evaluate needed no such guard — they're read-only, so splitting
    is purely a rendering change there.
  - **Gotcha hit while testing:** a Vitest fixture using UTC interval times
    that "obviously" crossed midnight didn't actually trigger a split,
    because the test runner's local timezone (GMT-3) shifts the wall-clock
    crossing point — `splitAcrossDays` correctly operates on *local*
    calendar days (matching how react-big-calendar buckets day columns via
    `calendarLocalizer.ts`'s date-fns localizer), not UTC days. Fixed by
    using a 30h+ span in the fixture, which guarantees crossing a local
    midnight regardless of the runner's offset.
  - Verified via new unit tests (`splitEventAcrossDays.test.ts`, plus a
    `PlanCalendar.test.tsx` case covering both rendered segments and that
    right-click delete / left-click-open still resolve to the one underlying
    interval) and a throwaway Playwright spec against the dev stack
    (confirmed 2 chips render for both a Plan interval and an Execute
    entry crossing midnight; deleted before committing, per the usual
    throwaway-spec convention).

### v04 milestones (M35–M39, one commit each, all pushed)

First pass with a real external integration (Google Calendar) and a new
recurring-schedule domain concept (routine tasks). Full design rationale is
in `prompts/interpreted_app_improvements_v04.md`.

- **M35** (`5589c35`) — item 1: real Google OAuth2 connect/disconnect. New
  `GoogleAuthService`/`GoogleRepository` (single global token set in Redis —
  `google:tokens` hash — no per-user auth in this app), new
  `GET/POST /auth/google/*` routes, "Connect Google Calendar" control in the
  shared nav bar (`App.tsx`). **Key pattern established here and reused by
  every later Google milestone**: `app/dependencies.py`'s
  `get_google_oauth_client`/`get_google_calendar_client` auto-select a
  `Fake*` (no network, canned responses) vs `Httpx*` (real) implementation
  based purely on whether `settings.google_client_id`/`google_client_secret`
  are set — so dev/CI/Playwright always run against the deterministic fake
  with zero real network calls, and dropping real credentials into a root
  `.env` (see "Google Calendar setup" below) switches to genuine calls with
  no other code change. 20 new pytest cases (113→133).
- **M36** (`eee96fa`) — item 2: shared `GoogleSyncService`/
  `GoogleCalendarClient` bridge (create/update/delete a Google event for an
  interval) plus the manual "Add to Google Calendar" Plan-chip context-menu
  item (`POST /intervals/{id}/push-to-google`) for intervals that predate
  the connection. Shown only when connected and the interval has no
  `google_event_id` yet. 4 new pytest cases (133→137).
- **M37** (`eadb27e`) — item 3: automatic go-forward sync. `IntervalService.
  create_interval`/`update_interval`/`delete_interval` each fold in a
  best-effort Google push/update/delete when connected, reusing M36's
  service unchanged — this is backend-only, no frontend diff, since
  `google_event_id` was already surfaced from M36. Execute (tracked time)
  is untouched, exactly per the request. 4 new pytest cases (137→141).
  **Gotcha hit while testing**: the Google connection is a *single global
  toggle*, unlike task/interval test fixtures which get isolation from
  unique names — an earlier e2e spec leaving it connected leaked into later
  specs assuming the default disconnected state. Fixed by having every
  Google-related spec force-disconnect via the backend endpoint at its own
  start, rather than relying on run order.
- **M38** (`11113ce`) — item 4 backend half: routine tasks. A recurrence
  rule (repeat every N day/week/month/year, weekly day-of-week selection,
  ends never/on-date/after-N-occurrences — mirrors Google Calendar's own
  "Custom recurrence" dialog, see `prompts/references/recurrence_task.png`)
  lives as extra hash fields on the existing Task row — routines are leaf
  tasks, not a separate domain, tracked via a new `routines:all` Redis set.
  New `RoutineService.ensure_applied()` mirrors `RolloverService`'s
  idempotent "catch up on read" pattern (explicit `now` override, **never**
  mocks real time) to lazily generate occurrences through a rolling 28-day
  window, reusing `IntervalService.create_interval` so every generated
  occurrence automatically flows through M37's Google sync with no
  duplicated logic. A `sprint_done`/`done` routine resets to `backlog` once
  any of its occurrences has concluded. New `POST /routines`.
  **Correctness gotcha caught in testing, not shipped**: an early version
  of `occurrence_dates()` cascaded each step off the *previous candidate*
  rather than always re-deriving from the recurrence's anchor date — this
  silently drifted a monthly/yearly rule's day-of-month after a clamped
  month (Jan 31 → Feb 28 → **Mar 28**, not Mar 31) and misaligned any
  catch-up call resuming mid-window onto the wrong cadence entirely.
  Rewritten to always phase-lock to the anchor (walk the full theoretical
  sequence from the anchor on every call, filtering to what's new) — cheap
  at this app's scale, and the only way to keep the rule's true cadence
  regardless of when generation happens to run. 17 new pytest cases
  (141→158). Backend-only milestone, no e2e spec (no UI yet).
- **M39** (`17b7cd7`) — item 4 frontend half: Tasks/Routines tab strip above
  the Plan left panel (new, since none existed before — the panel used to
  render the task tree directly). New flat `RoutinesList.tsx` (routines are
  leaf-only, no tree needed) and `NewRoutineDialog.tsx` (name+DoD +
  first-occurrence start/duration via the existing `IntervalTimeFields` +
  new `RecurrenceRuleFields.tsx`). Creating a routine immediately shows a
  Plan chip with no manual drag, since M38's generation runs as part of
  creation. `TaskDetailPanel` hides the Parents/Add-child-task sections for
  a selected routine (permanently leaf, organizationally separate from the
  main tree — never reparented in or out). 8 new vitest cases (170→178).
  **This completes the v04 pass.**

### Post-v04 ad hoc fix: pull Google Calendar events into Plan/Execute (M40)

- `app_improvements_v04.md` item 1 actually asked for two things: the
  "Connect Google Calendar" button, *and* "the google calendar events will
  be visible on the app calendar views." `interpreted_app_improvements_v04.md`
  only carried the button half forward — the pull-back half was silently
  dropped during interpretation and never built, until the user hit it
  directly (connected, then couldn't see their real Google events on Plan).
- New `GoogleCalendarClient.list_events` (Protocol + `Httpx`/`Fake` impls,
  alongside the existing create/update/delete) fetches events in a
  `timeMin`/`timeMax` range; all-day events (Google's date-only `start.date`
  field, vs. timed `start.dateTime`) are skipped, since this app's model has
  no untimed-event concept. `GoogleSyncService.list_events` wraps it with
  the same best-effort/swallow-failures shape as `push_interval` etc. New
  `GET /google/events?week_start=...` (`app/routers/google_events.py`,
  separate from the auth-flow `routers/google.py`) dedups against this
  app's own already-synced intervals (via `IntervalService.list_for_week`)
  so an interval this app pushed to Google (M37) doesn't also come back as
  a second, external-looking chip.
- `PlanCalendar.tsx`/`ExecuteCalendar.tsx` both merge in
  `useGoogleEventsForWeek` alongside their existing intervals/entries,
  tagging pulled events `isExternal: true` with a namespaced `google-{id}`
  React key and a fixed neutral/gray style (`EXTERNAL_EVENT_STYLE` in
  `eventColor.ts`) instead of task colors. Plan additionally guards
  `draggableAccessor`/`resizableAccessor` against `isExternal` and skips
  setting `data-interval-id` on external chips so the existing
  mousedown-drag-arm listener and right-click context menu both naturally
  no-op on them — no new guard logic needed there beyond that.
- **Confirmed scope (user decision), deliberately excluded:** pulled events
  do **not** appear on Evaluate — its calendar is a diff/gap view (planned
  vs. tracked time, excuse-attachment) with a different purpose, and its
  metrics (`StatsPanel`, `ExcusesPanel`) must never count them. No Evaluate
  code was touched.
- 3 new pytest cases (158→161), 3 new vitest cases (178→181, including a new
  `ExecuteCalendar.test.tsx` — no test file existed for that component
  before now).

#### Google Calendar setup (needed before real-Google manual verification)

Every M35–M39 automated test runs against the in-process fake adapter — no
setup needed for those. To verify against your *actual* Google Calendar:
1. Google Cloud Console → new/existing project → enable the Google Calendar
   API → create an OAuth 2.0 Client ID (type "Web application"); Testing
   mode is fine for this single-user app, just add your own account as a
   test user.
2. Add both authorized redirect URIs to that one client: `http://localhost:
   8000/auth/google/callback` (prod) and `http://localhost:8001/auth/google/
   callback` (dev).
3. Create a root-level `.env` (already gitignored, doesn't exist yet as of
   this commit) with `GOOGLE_CLIENT_ID=...` and `GOOGLE_CLIENT_SECRET=...`
   — **not** `backend/.env`, since the prod Dockerfile `COPY`s the backend
   directory at build time and would risk baking a secret into the image
   layer. Docker Compose auto-substitutes `${GOOGLE_CLIENT_ID}` etc. from
   this root `.env` into both compose files' backend `environment:` blocks.
4. Rebuild whichever stack you're testing (`docker compose up --build` /
   `docker compose -f docker-compose.dev.yml up --build`) so the new env
   vars take effect, then use the nav bar's "Connect Google Calendar".

### v05 milestones (M41–M49, one commit each, all pushed)

Full design rationale is in `prompts/interpreted_app_improvements_v05.md`.

- **M41** (`a54fe5d`) — item 1: the timer's stop confirmation gets a third
  option. Clicking "Stop" now opens the confirm dialog *before* stopping
  anything (previously it stopped immediately, then asked about marking
  done) — "Yes" marks done and stops, "No, stop the timer" stops without
  marking done, "Cancel" leaves the timer running untouched. New
  `StopTimerConfirmModal.tsx` keeps this 3-button, timer-specific flow
  separate from `DoneConfirmModal.tsx`'s plain 2-button "mark done" dialog
  (still used as-is by `TaskDetailPanel`'s own "Mark sprint done" button).
- **M42** (`8bb8dc2`) — item 3 bug fix: deleting a task didn't sync its
  future intervals' deletion to Google Calendar. Root cause:
  `routers/tasks.py`'s `delete_task` pruned future intervals via a raw
  `IntervalRepository.delete()` call, bypassing
  `IntervalService.delete_interval()` — the only place that actually does
  the Google-side delete (confirmed: deleting an interval *directly*, e.g.
  via the calendar chip's right-click, already synced correctly). Fixed by
  routing the cascade through `IntervalService` instead.
- **M43** (`b39600d`) — item 2 investigation: "every 2 weeks on Friday until
  Dec 31 only ever produces 2 occurrences." No prior test exercised
  `recurrence_interval > 1` through `ensure_applied()` across multiple
  calls. Added an integration test driving a biweekly rule through many
  irregular `now` advances spanning 100+ simulated days — it **passed
  against the existing code with no fix needed**: the multi-call catch-up
  mechanism is correct. No functional defect found; likely a UX-observation
  gap (Plan only shows the current week by default, and nothing surfaces
  "generated through when"), not a generation stall.
- **M44** (`0e310e7`) — item 11 investigation + fix: "selecting Monday while
  today is Thursday, I cannot create the task." Confirmed via a live repro
  against the dev stack that creation never actually fails — the backend
  already resolves to the closest future matching weekday correctly. The
  real gap: the current week's Plan calendar shows nothing for it (first
  occurrence lands next week), reading as "nothing happened." New
  `lib/recurrenceResolve.ts` mirrors the backend's weekly resolution
  client-side; the New recurrent task dialog now shows a "First occurrence:
  &lt;date&gt;" preview so success is confirmed rather than inferred.
- **M45** (`f2f2c32`) — item 5: full rename, "routine" → "recurrent task",
  across backend and frontend (`RoutineService`→`RecurrentTaskService`,
  `is_routine`→`is_recurrent_task`, `routines:all`→`recurrent_tasks:all`,
  `/routines`→`/recurrent-tasks`, `NewRoutineDialog`→
  `NewRecurrentTaskDialog`, `RoutinesList`→`RecurrentTasksList`, the
  "Routines" tab label → "Recurrent tasks", every test/fixture referencing
  the old names). New `backend/scripts/` package (no prior precedent in
  this repo) holds a one-time, idempotent, `--dry-run`-capable migration
  script (`migrate_routine_to_recurrent_task.py`) that renames the Redis
  hash fields and set key in place. **Run against prod mid-session**
  (dry-run → inspect → real run), preserving all 9 real recurrent tasks
  that existed there — see "Prod status, mid-pass" above.
- **M46** (`5dcb444`) — item 8: picking a first-occurrence start past the
  current end now auto-snaps end's date+time to match start, instead of a
  blocking red "End must be after start" warning.
- **M47** (`4469ca7`) — item 7: recurrent-task groups. A new organizational
  hierarchy, separate from the main task tree — a group is name-only (no
  schedule), recurrent tasks/groups nest under groups via a new
  `recurrent_parent_id` field with its own `recurrent_order` sequence
  (deliberately never sharing state with the main tree's `order`/
  `ORDER_STEP`). New `POST /recurrent-tasks/groups`,
  `DELETE /recurrent-tasks/groups/{id}?delete_children=bool` (cascades
  through nested groups/tasks, or reparents direct children up to the
  deleted group's own parent — "ungroup"). `RecurrentTasksList.tsx`
  rewritten from a flat list into a real tree (indent + expand/collapse);
  the "+" button opens a chooser between "Recurrent task" and "Recurrent
  group"; a new `GroupDeleteDialog` offers Cancel/Ungroup/Delete-children-too
  — never a silent default. No drag-and-drop yet in this milestone —
  nesting could only be set up directly via the API.
- **M48** (`d8c361f`) — item 10: drag-and-drop within the Recurrent tasks
  tab. Mirrors the main tree's dnd-kit pattern (`PointerSensor`, per-row
  `useDraggable`+`useDroppable`, `useDndMonitor` → pure drop-resolution
  helper) but scoped to a **second, independent `DndContext`** wrapping
  just the Recurrent tasks panel — dnd-kit scopes drop targets to a
  `DndContext`'s own children, so this hierarchy's drags can never interact
  with the main tree's or the Plan calendar's. New
  `resolveRecurrentDropAction()` (`lib/recurrentTaskTree.ts`) enforces the
  item-10 constraint: only a recurrent *group* can be a reparent target —
  dropping onto a plain task always falls back to a sibling reorder,
  regardless of where in the row the pointer lands.
  `recurrentDescendantIds()` blocks a group from being reparented into its
  own subtree. New `PATCH /recurrent-tasks/{id}/parent` and `.../order`
  (same midpoint-insertion scheme as the main tree's `reorder_task`, against
  `recurrent_order`). Also fixed a gap from M47: `recurrent_order` was only
  ever set on groups at creation, never on plain recurrent tasks, and
  wasn't exposed on `TaskOut` at all — corrected here.
- **M49** (`3dbbb59`) — item 9: drag-to-create a new event on the Plan
  calendar. `selectable` was `false` everywhere; enabled react-big-calendar's
  native `selectable`+`onSelectSlot` (confirmed no conflict with the two
  existing drag systems — dnd-kit task-row-drag only ever activates from a
  `useDraggable` source, and the hand-rolled chip-reschedule listener
  already gates on `[data-interval-id]`, so both structurally ignore empty
  grid space already — verified by running the full existing drag-spec
  suite against the now-`selectable` calendar before building further). A
  new chooser (`NewEventChooserDialog`) offers recurring-new (reuses
  `NewRecurrentTaskDialog`, now taking an optional `initialRange`),
  not-recurring-new (new `QuickCreateTaskDialog`: name+DoD only, two plain
  client-side calls — create task then create interval, no new combined
  backend endpoint), or existing-task (new `ScheduleExistingTaskDialog`,
  reusing `TaskPicker` + `useCreateInterval` directly). **This completes
  the v05 pass.**

### v06 milestones (M50–M54, one commit each, all pushed)

Full design rationale is in `prompts/interpreted_app_improvements_v06.md`.
Entirely frontend-only — no backend/pytest changes anywhere in this pass.

- **M50** (`7b82744`) — item 3: a Configuration button + dialog. New
  `ConfigButton.tsx`/`ConfigDialog.tsx` (`components/nav/`), matching
  `GoogleConnectButton.tsx`'s self-contained convention (owns its own open
  state, no props). Wired into `App.tsx`'s nav as the first child *inside*
  the existing left tab-group `<div>`, not as a third top-level sibling of
  `<nav>` — that div uses `justify-between` with exactly two groups, so a
  third sibling would drift the tabs toward center instead of staying
  flush-left. Empty placeholder body (M51 fills it in).
- **M51** (`8ae3a55`) — item 4: idle-detection auto-stop for time tracking,
  off by default. New always-mounted `GlobalTimerWatcher.tsx` (rendered
  once in `App.tsx`, **not** inside `TimerControl`/`ExecuteView`) owns the
  idle-timeout listener/timer, since the backend's active timer (single
  global Redis key) keeps running regardless of which view is on screen,
  and `TimerControl` unmounts — along with anything it owned — the instant
  the user leaves Execute. While enabled and a timer is active, `window`
  keydown/mousedown/mousemove/wheel listeners reset a `setTimeout`; on
  fire it stops the timer without marking done (today's existing
  "No, stop the timer" path), plays a generated Web Audio tone
  (`lib/playAlertTone.ts`, no audio asset file), and shows an `AlertDialog`
  acknowledgement the user must dismiss. Settings (`{enabled,
  timeoutMinutes}`) live in a small external store
  (`lib/idleDetectionSettings.ts` + `useSyncExternalStore`-based
  `useIdleDetectionSettings.ts`), not a plain per-component `useState`
  localStorage hook like `useResizableWidth.ts` — the Configuration dialog
  (writer) and `GlobalTimerWatcher` (reader) are separate component
  instances that both need the *same* live value in the same tab, which a
  plain hook can't give without a page reload.
- **M52** (`426081d`) — item 5: dynamic favicon reflecting timer state.
  New `lib/favicon.ts`, split for testability since jsdom has no real
  `<canvas>` 2D context: pure `formatFaviconLabel`/`faviconState`, a
  fake-context-testable `drawFavicon`, and an untested imperative
  `applyFavicon` shell (canvas → data URL → swap `<link rel="icon">`,
  also switching `type` to `image/png` since a PNG data URL under the
  static `index.html`'s `type="image/svg+xml"` risks being ignored).
  Green with live elapsed mm:ss digits while tracking; red the instant
  M51's idle-detection auto-stops the timer, reverting to neutral only
  once that acknowledgement dialog is dismissed — a normal manual stop
  goes straight to neutral, never through red. Also fixed, while writing
  this milestone's Playwright spec: the fixture task name "Idle stop …"
  collided with the Stop button's accessible name once the entry's
  calendar chip rendered, breaking every later `timer.spec.ts` test in the
  same run — renamed to "Idle timeout …" (same fixture-naming gotcha
  documented repeatedly below).
- **M53** (`5261d8e`) — item 1: group the Execute/Evaluate dropdowns by
  "Tasks" vs. "Recurrent tasks". `TaskPicker.tsx` (Execute) and
  `TaskFilter.tsx` (Evaluate Metrics) both already excluded recurrent
  tasks/groups from their *visible* main-tree computation, but never gave
  them a section of their own — they leaked in as bare, ungrouped extra
  "roots" (recurrent items always have `parent_ids: []`, so they
  trivially qualified as main-tree roots too). Now two independently-
  collapsible sections per dropdown: "Tasks" (unchanged) and "Recurrent
  tasks" (via a new `flattenRecurrentTree`/`recurrentNodeMap` pair added
  to `lib/recurrentTaskTree.ts`, reusing the same `{id, depth}` row shape
  `lib/taskTree.ts`'s `flattenTree` already produces). Recurrent groups
  are forced non-selectable/non-checkable in both — a real correctness
  fix, not just cosmetic parity: a recurrent group computes `is_leaf: true`
  (it has no main-tree `children_ids`, only a `recurrent_parent_id` edge),
  so the existing `isSelectable`/is_leaf-based conventions that correctly
  exclude a main-tree "goal" can't be trusted to exclude a recurrent group
  the same way.
- **M54** (`d7e06a8`) — item 2: a live drag reorder-line indicator on the
  Plan tree. Dragging a task row over another row's outer third (a
  reorder) previously got the exact same full-row `outline-accent` as the
  middle third (a reparent) — both looked like "drop onto this row." New
  `DropPreview` type + `sameDropPreview` in `lib/taskTree.ts`, computed
  live in `TaskTree.tsx` and threaded down through `TaskTreeNode.tsx`'s
  recursion (at *every* level, same as `expanded`/`selectedId` already
  are): the middle third keeps the unchanged outline; the outer thirds
  instead render a thin absolutely-positioned line at the boundary shared
  with whichever neighbor the drop would land next to. **Real gotcha
  caught by the new Playwright spec, not just a design guess**: the live
  preview was first wired to dnd-kit's `onDragOver`, which only fires when
  the *hovered target itself* changes — so it never saw the pointer move
  from a row's middle third to its own top edge without leaving the row,
  leaving the preview stuck on whatever it resolved to on entry. Fixed by
  switching to `onDragMove`, which fires on every pointer move regardless.
  Scoped to the main Plan tree only — the separate Recurrent-tasks drag
  (`RecurrentTasksList.tsx`, M48) is untouched. **This completes the v06
  pass.**

### Post-v06 ad hoc addition: recurrent groups selectable in Evaluate filters (M55)

- **M55** (`cc8f122`) — a recurrent group was non-selectable in Evaluate's
  Metrics and Excuses task filters (M53 above forced this, since a group
  computes `is_leaf: true` and has no main-tree rollup). This left a group
  with real tracked recurrent tasks under it unfilterable, just a mute
  label. Generalized the old goal-only rollup helper in
  `backend/app/services/period_utils.py` into `expand_task_selection`/
  `recurrent_ancestors`/`recurrent_descendant_tasks`/
  `main_tree_descendant_leaves`, covering the main tree's `children_ids`
  hierarchy and the separate `recurrent_parent_id` hierarchy independently
  (a plain task has no recurrent descendants, a recurrent group has no
  main-tree descendants, so combining both is always safe). `evaluate_
  service.py` and `excuse_service.py` both reuse it — selecting a recurrent
  group now rolls up its hours/excuse counts the same way selecting a goal
  already rolled up its leaves, and a leaf's recurrent-group ancestors get
  their own aggregated row via `recurrent_ancestors`. `TaskFilter.tsx`
  (Evaluate) gives a recurrent group a checkbox again. **Execute's
  `TaskPicker` deliberately stays unchanged** — it's leaf-only/group-
  excluded by design (M53), since tracking time against a specific task has
  no rollup concept, unlike a period-scoped filter. 6 new pytest cases
  (192 total across a new `test_period_utils.py` plus `test_evaluate.py`/
  `test_excuses.py` additions), frontend `TaskFilter.test.tsx` extended to
  assert the group checkbox fires `onChange` with the group's own id.
  Also bundled in: `ConfigButton` moved next to `GoogleConnectButton` in
  the nav bar (incidental, same session, no functional change).
  This work was implemented but left uncommitted at the end of the v06
  session — picked back up and committed here once noticed.

### Post-v06 ad hoc fix: recurrent groups excluded from the main Tasks tree (M56)

- **M56** (`987ccf4`) — a recurrent group leaked into the Plan view's main
  "Tasks" tab as a root, alongside real top-level tasks. Root cause: like a
  recurrent task, a recurrent group has `parent_ids: []` (both hierarchies
  are organizationally separate from the main tree), so it trivially
  qualified as a main-tree root too — the same category of bug M53 already
  fixed for the Execute/Evaluate dropdowns, just never applied to
  `TaskTree.tsx`'s own root filter. Fixed by excluding `is_recurrent_group`
  there alongside the existing `is_recurrent_task` exclusion. New
  `TaskTree.test.tsx` case asserting neither a recurrent task nor a
  recurrent group renders as a Plan-tree root.

### v07 milestones (M57–…, one commit each, pushed as completed)

Full design rationale, including root-caused diagnoses for every "why is this
happening?" question in the original list, is in
`prompts/interpreted_app_improvements_v07.md`. Plan at
`C:\Users\shimi\.claude\plans\partitioned-moseying-token.md`.

- **M57** (`ad8f58f`) — item 1/7: `frontend/src/lib/taskTree.ts`'s
  `isHiddenFromPlan` only hid a leaf at `state === 'sprint_done'`, so a leaf
  that later rolled over to `done` (via the weekly `RolloverService`)
  reappeared in the Plan tree — confirmed root cause of "depositar plata
  alquiler" resurfacing in prod. Hide on both finished states now.
- **M58** (`5a620ed`) — items 2+3: idle-detection auto-stop (M51) removed
  entirely — it resets its timeout on `window`-scoped events, which only
  fire for the document with OS focus, so working in a different
  window/tab still let the timer auto-stop despite real activity elsewhere
  (confirmed with the user as the cause of item 3's report). Removed: the
  auto-stop logic, alert tone, acknowledgement dialog, Configuration
  dialog's toggle/timeout controls, and the favicon's red state (nothing
  triggers it anymore). Configuration button/dialog stays as an empty
  shell. Live elapsed-time digits move from the favicon icon (now a plain
  neutral/green color swap) into the browser tab title instead.
- **M59** (`17f0ba7`) — item 4: "+ Child task" now opens a chooser between
  "Create new task" (unchanged) and "Attach existing task" (new
  `AttachExistingChildDialog.tsx`, reparenting the picked task — detaching
  it from its previous parent(s), not an additive multi-parent add like
  Requires). New `ancestorIds()` alongside the existing `descendantIds()`
  in `lib/taskTree.ts` so the picker excludes any would-be-cyclic pick
  up front rather than relying on the backend's `CycleError` alone.
  Extracted the reparent-with-undo sequence `TaskTree.tsx` already used
  for drag-reparenting into shared `lib/reparentUndo.ts`.
- **M60** (`0ba58c3`) — item 5: clicking a pulled Google Calendar event now
  opens a new read-only `GoogleEventDetailPanel` (title/time/description,
  no editable fields) instead of silently no-op'ing — wired into both
  `PlanCalendar` and `ExecuteCalendar`'s `onSelectEvent` (Execute had no
  click handler on any event at all before this). Backend: `description`
  wasn't surfaced past the Google API response — added to `GoogleEventOut`
  and threaded through `list_events`.
- **M61** (`3d39579`) — item 6: deleting a task with children now asks
  "just this task" (reparents children up to the deleted task's own
  parent(s), new logic in `TaskService.delete_task`'s `delete_children`
  param, mirroring M47's recurrent-group ungroup — **not** the same as
  today's old edge-cleanup-only default) vs "delete whole subtree"
  (cascades via new `graph_utils.descendant_ids`). Leaf tasks keep the
  plain confirm dialog. Cascade delete also cleans up future intervals for
  every leaf descendant being removed, reusing the M42 `IntervalService`
  path.
- **M62** — item 8 (Plan calendar drag ghost/preview "not working," video
  at `prompts/references/bug_moving_tasks_on_plan_calendar.mp4`):
  investigated, not fixed — extracted and analyzed the video frame-by-frame
  (top-edge resize, chip vanishes ~1s mid-drag), then wrote two realistic
  Playwright reproductions matching that exact gesture (one matching the
  video's timing, one matching the project's own existing bottom-edge-resize
  test pattern); neither reproduces any flicker against current `main` —
  resize/preview behavior is clean. **User confirmed** ("mark as not
  currently reproducible") this resolution before further work. Along the
  way, closed a real test-coverage gap (no prior spec covered the top edge
  at all — only bottom-edge resize and body-move) with a new permanent
  regression test in `calendar-move-resize.spec.ts`, and did a deep-dive
  into that file's two still-failing pre-existing tests (unrelated to item
  8 — see "Known limitations" below for the refined, still-unresolved
  root-cause notes). No app code changed in this milestone.
- **M63** (`90b655d`) — item 9: right-click "Mark as done" on the Plan tree
  now cascades through a task's whole subtree, undoable in one Ctrl+Z. New
  `TimerService.mark_subtree_done` force-sets every non-finished leaf
  descendant to `sprint_done`, deliberately bypassing `mark_done`'s
  `in_progress`-only precondition (most leaves in a right-clicked subtree
  are still `backlog`) — `mark_done`/`POST /timer/mark-done` itself is
  untouched, still enforcing that precondition for its existing callers.
  New `POST /timer/mark-subtree-done` returns the affected leaf ids. New
  `makeMarkSubtreeDoneUndoEntry` generalizes the existing single-task
  mark/revert-done undo-entry pair over an array of ids so however many
  leaves were touched, one Ctrl+Z reverts them all (looping the
  single-task helpers with separate `pushUndo` calls would have produced
  one stack entry per leaf instead).
- **M64** (`c677aa9`) — item 10: recurrent-task generation split by
  bounded vs. unbounded end conditions. Root cause of "end date December,
  only scheduled through September 1" (confirmed with the user):
  `GENERATION_WINDOW_DAYS=28` meant every rule, bounded or not, only ever
  generated 28 days ahead of whenever `ensure_applied()` last ran,
  regardless of the rule's own end condition — nothing was stalled,
  generation just hadn't caught up yet. A bounded rule (`on_date`/
  `after_count`) now generates every occurrence through its own true end
  at creation time (new `_initial_generation_window_end`) — no more
  artificial cap. An unbounded (`never`) rule keeps the same lazy
  catch-up-on-read mechanism, just with the rolling window raised from 28
  to 365 days. Synchronous Google Calendar sync for every occurrence
  generated up front is accepted as-is, no background job introduced.
  Backend-only milestone.
- **M65** (`584b880`) — item 11: Execute's `TaskPicker` now also hides a
  fully-done **goal**, not just a done leaf — its default `isHidden` only
  ever checked `task.is_leaf && state in {sprint_done, done}`, so a goal
  whose every leaf descendant had finished still showed in prod. Dropped
  the `is_leaf` guard: since a goal's computed state only ever reaches
  `done` once *every* leaf descendant is done (never `sprint_done`
  directly), this naturally keeps any goal with an unfinished descendant
  visible with no separate ancestor-walk needed. No e2e coverage added —
  a goal only computes to `done` after real weekly rollover flips every
  leaf from `sprint_done` to `done`, not achievable via the public API
  within a test run (the backend's own suite documents this same
  constraint); frontend unit tests exercise the fix directly instead.
- **M66** (`cad7ea6`) — item 12: new `scripts/start-on-boot.ps1` — brings
  up the prod Docker stack, polls `/health` until reachable, then opens
  the frontend in the default browser. Not a standard milestone (local
  machine configuration, not application behavior, no automated test
  applies). The one-time Task Scheduler registration command is documented
  in the script's header; attempted from this session but Task Scheduler
  denied access (both `Register-ScheduledTask` and `schtasks.exe`) — left
  for the user to run themselves.
- **M67** (`6eb0013`) — item 13: the colored-circle indicator already used
  in the Plan tree and Recurrent tasks list (`ColorDots.tsx`) is now also
  wired into `TaskPicker`'s row renderer (covering Execute's picker, the
  Requires dropdown, and the Recurrent-tasks section inside `TaskPicker`
  in one change, since they share a row renderer) and `TaskFilter`'s row
  renderer (Evaluate Metrics + Excuses). **This completes the v07 pass**
  (M57–M67, all 13 interpreted items).

This has repeated three times now (initial build, v00, v01) and is worth reusing:

1. User drops a plain, unstructured bullet list into `prompts/app_improvements_vNN.md`.
2. Read it, then resolve open items **one by one in conversation** with the user
   before anything is written — not a single upfront batch dump. Two kinds of
   open items get resolved here, and both matter:
   - **Wording ambiguity** — via `AskUserQuestion` (not everything, only real
     ambiguity; note assumptions for the rest).
   - **Literal diagnostic questions the user wrote into the file itself**
     (e.g. "why is this happening?", "what could the problem be?") — these
     get actually investigated (read the code, root-cause it) and the
     finding discussed with the user now, in conversation, rather than
     deferred to "investigate during implementation." The interpreted
     document (step 3) should already state the diagnosed cause, not just
     restate the question.
3. Once the open questions are resolved, write
   `prompts/interpreted_app_improvements_vNN.md`: an ordered, clarified restatement
   incorporating the answers.
3b. Before committing, surface in chat any issues/concerns flagged in that
    document (e.g. its "Notes for implementation planning" section) that still
    need a decision — don't let them sit silently in the file. Resolve those
    with the user first; only once they're settled does the commit in the next
    step happen.
4. Commit + push the `prompts/` addition on its own (small, low-risk commit).
5. Enter plan mode, design an implementation approach — usually one milestone per
   improvement or tightly-related group — and get it approved.
6. Implement milestone by milestone. Each milestone: backend `pytest` + `ruff check
   .`, frontend `npm test` + `npm run build` + `npm run lint`, plus a Playwright spec
   exercising the change against the real running stack — all green before
   committing. One commit per milestone, pushed immediately after (this repo's
   established preference: commit at each milestone, push after each).
7. Use Playwright (`frontend/e2e/`), not claude-in-chrome, for all frontend/
   integration verification. It's seconds instead of minutes and leaves a reusable
   regression spec behind. For one-off visual/behavioral debugging (not just
   screenshots — this session also used throwaway specs with `console.log` +
   `page.on('console', ...)` piping to debug a dnd-kit geometry bug, see M18's
   gotcha above), write a throwaway spec, then delete it (and any screenshots)
   before committing — don't commit assertion-less or debug-only specs.

## Known limitations (deliberately deferred, not bugs)

- **Editing an existing recurrent task's recurrence rule** (v04, M38/M39;
  renamed from "routine" in v05 M45) — not implemented. The New recurrent
  task dialog only covers creation; changing a recurrent task's repeat
  interval/days/end condition after the fact isn't possible yet (delete and
  recreate is the only workaround). Flagged as a natural follow-up in the
  v04 plan, not built since the interpreted improvements list only asked
  for creation. Still not built as of v05.
- **Deleting or editing one recurrent-task-generated occurrence only
  affects that one interval** (v04, M38) — no Google-Calendar-style "this
  event / this and following / all events" semantics. Deliberately out of
  scope for v04, still not built as of v05.
- **Google Calendar sync** (v04 M35–M37, plus post-v04 M40) — real OAuth2
  connect/disconnect, manual/automatic push of Plan intervals, and pulling
  Google's own events back into Plan/Execute (read-only, not editable, not
  reflected in Evaluate) are all implemented. Execute's tracked time is
  still deliberately never *pushed* to Google (see
  `prompts/interpreted_app_improvements_v04.md` item 3) — only the pull
  direction touches Execute.
- **No auth/users** — single-user by design for this stage.
- **Timezone boundaries are UTC, not the user's local time.** The backend stores and
  buckets everything in UTC (`datetime.now(UTC)`, week/day/month math all UTC-based).
  The frontend was fixed in the v00 pass (`frontend/src/lib/time.ts`'s `utcNow()`) to
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
  you manually click the parent's chevron. Noticed while writing a Playwright spec
  during the v00 pass; out of scope of that improvements list, so left alone.
- **Drag-to-schedule breaks silently when the dragged row needed scrolling into
  view** (discovered in M18, v02 pass) — see that milestone's writeup above. Only
  worked around in tests (tall viewport), not actually fixed in production code.
  Would need real root-causing of dnd-kit's delta-tracking interaction with a
  scrolled ancestor container to fix properly.
- **Playwright suite has some crowding-related flakiness in later-running specs**
  (discovered in M18/M19, v02 pass) — `global-setup.ts` only flushes Redis once
  per whole run, not per-spec, so by the time later specs run, dozens of tasks/
  events have accumulated from every earlier spec in the same run. This has been
  observed to occasionally cause an otherwise-passing right-click/drag interaction
  to time out (element present but interaction flakes), especially for specs near
  the end of the file list. Retrying (`npx playwright test` again, or just the
  affected file alone) has so far always passed. Not fixed — would need either a
  per-spec Redis flush (slower) or more deliberately-isolated fixture data.
  **Recurred repeatedly during the v03 pass** (M25, M27, M29, M31, M34) as the
  suite grew further — same symptom each time (an isolated single-file or
  single-test re-run always passed), and occasionally a substring collision
  in a locator name (e.g. a new test's task literally named "...Delete..." or
  "...Cancel...") ambiguously matched a same-named button elsewhere in the
  DOM once enough tasks piled up; fixed case-by-case by renaming the fixture
  data, not by addressing the underlying no-flush-between-specs cause.
  **Recurred again during the v05 pass** (M41, M42): a fixture task named
  "Timer cancel …" collided with the new timer-stop dialog's own "Cancel"
  button, and a task named "DeleteCascade …" collided with a context menu's
  "Delete" button — same fix each time (rename the fixture, e.g. to "Timer
  abort …"/"TaskCascadeSync …"). Also hit a genuine cross-file ordering bug
  in M49: a new spec file (`drag-to-create.spec.ts`) sorting alphabetically
  before `recurrent-tasks.spec.ts` and creating a recurrent task broke that
  file's "no recurrent tasks yet" empty-state assertion when the full suite
  ran together (fixed by dropping that assertion from the e2e spec — it's
  already covered by a unit test — rather than fighting cross-file order).
  **Recurred again during the v06 pass** (M52): a fixture task named
  "Idle stop …" collided with the timer's own "Stop" button — same fix
  again (renamed to "Idle timeout …").
  **A materially different, more severe issue found during the v06 pass**
  (not this crowding gotcha — flagged separately so it isn't conflated with
  it): `schedule.spec.ts`, `calendar-move-resize.spec.ts`,
  `drag-to-create.spec.ts`, and the two calendar-drag cases in `undo.spec.ts`
  (drag-created-interval undo/redo, and the per-view-scoped-undo test) fail
  **even completely alone**, immediately after a fresh Redis flush — not
  just when crowded by a full-suite run. Confirmed by checking out the
  pre-v06 baseline commit (`dbc44eb`) and re-running `schedule.spec.ts` in
  isolation there too: identical failures, so this is an environment-level
  regression (this session's Windows/Docker/Playwright/Chromium
  combination, most likely) unrelated to any v06 code change, not a defect
  introduced by M50–M54. The main Plan **tree's** own drag (`tree-drag.spec.ts`,
  `tree-drop-preview.spec.ts`, both used to verify M54) is unaffected and
  passes reliably — the break is specific to react-big-calendar's
  drag-to-schedule/reschedule interactions, not dnd-kit row-dragging in
  general. Not investigated further or fixed (out of scope for the v06
  improvements list) — worth a real root-cause pass if it's still
  reproducing next session.
  **Partially root-caused during the v07 pass (M62), still not fully
  resolved:** re-checked at the start of M62 (item 8's reported "ghost
  preview not working during drag" bug) — `schedule.spec.ts` and
  `drag-to-create.spec.ts` now pass cleanly (whatever caused those has
  since resolved itself, likely a Playwright/Chromium version bump).
  `calendar-move-resize.spec.ts` still fails, but narrowed down to
  exactly 2 of its 6 tests: "the source chip is hidden while dragging"
  and "cancelling a reschedule drag with Escape" — both of which assert
  on the `.rbc-addons-dnd-dragged-event` class appearing mid-drag. Deep
  debugging (temporary `console.log` instrumentation directly in
  `PlanCalendar.tsx`'s mousedown/mousemove listener, since removed) found
  the app's own drag-arm listener never even fires for these two tests'
  exact gesture — traced one contributing factor to `todayAt(9)` no
  longer resolving to a literal 9am once real 9am UTC has already passed
  for the day (it pushes forward to "now + 30 min" instead, which late in
  the UTC day lands far down the scrollable time grid, confirmed via
  `document.elementFromPoint` returning `null` at the computed click
  coordinates) — but adding `scrollIntoViewIfNeeded()` before every
  `boundingBox()` call in the file did **not** fix it, so this isn't the
  complete explanation either. **Confirmed unrelated to item 8's video**:
  a realistic single-continuous-`mouse.move()` reproduction of the video's
  exact top-edge-resize gesture (new permanent regression test in
  `calendar-move-resize.spec.ts`, since no prior spec covered the top edge
  at all) shows clean behavior with no flicker, and the underlying
  reschedule-drag mechanics do still functionally work (the interval's
  time does update) even when the two visual-assertion tests fail to find
  their expected element — so this looks like a narrower, still-unresolved
  Playwright-mouse-simulation/DnD-addon interaction bug in the test
  harness itself, not a product regression. Next session: try instrumenting
  `withDragAndDrop`'s own internal drag-state (or bisecting its version)
  rather than the app's listener, since the app-level listener was
  conclusively ruled out as the cause.

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
  - **Gotcha hit during M5 (v01):** the dev compose file bind-mounts `./frontend:/app`
    plus an anonymous volume for `/app/node_modules`, so that node_modules survives
    host bind mounts. That anonymous volume also **survives `docker compose -f
    docker-compose.dev.yml up --build`** across container recreations — Compose reuses
    it rather than replacing it with the freshly-`npm install`ed layer from the new
    image. Net effect: adding a new frontend dependency and running `up --build`
    silently keeps serving the *old* `node_modules`, missing the new package, with no
    error until something tries to import it. Fix when this happens: `docker compose
    -f docker-compose.dev.yml stop frontend && docker compose -f
    docker-compose.dev.yml rm -f -v frontend && docker compose -f
    docker-compose.dev.yml up -d --build frontend` (the `-v` on `rm` is what actually
    drops the stale anonymous volume). Same applies to the backend if a Python
    dependency is ever added, though it has no anonymous volume today since
    `backend/requirements.txt` installs happen in a layer that isn't bind-mount-shadowed.
- **Gotcha hit during M8 (v01):** `react-big-calendar/lib/addons/dragAndDrop`'s default
  export comes through **double-wrapped** (`mod.default.default`, an object rather than
  the `withDragAndDrop` function itself) specifically under Vite's **dev-server**
  esbuild dependency pre-bundling — a CJS/ESM interop quirk of that package's export
  shape. It resolves correctly as a plain function under both vitest and the
  production `vite build` (Rollup), so this only surfaces as a runtime `TypeError:
  withDragAndDrop is not a function` in the browser against the dev stack, with **no
  build-time or type error anywhere** (`tsc`, `vitest`, and `vite build` all pass
  clean) — the first sign is a blank white page with all network requests returning
  200 and nothing in the console. Fixed in `frontend/src/components/calendar/
  PlanCalendar.tsx` with a defensive unwrap (`typeof x === 'function' ? x : x.default`)
  rather than assuming either shape.
- **Gotcha hit during M12 (v01):** don't nest an interactive `<button>` inside a
  `<label>` that also wraps a `<checkbox>` (e.g. an expand/collapse chevron next to a
  checkbox row) — browsers' accessible-name computation gets confused by two
  interactive elements sharing one label, and the checkbox's accessible name comes
  back empty (Testing Library's `getByRole('checkbox', { name })` then fails to find
  it). Fix: keep the chevron button as a sibling *outside* the `<label>` (see
  `TaskFilter.tsx`).
- **Gotcha hit during M18 (v02):** see this file's M18 writeup above (dnd-kit +
  scrolled-container delta bug).
- Backend venv: `backend/.venv`. Frontend deps: `frontend/node_modules`. Both already
  installed — no fresh `pip install`/`npm install` needed unless dependencies change.
- Playwright's Chromium binary is installed (`npx playwright install chromium` was
  already run). E2E specs require the **dev** compose stack running first (global
  setup health-checks `/health` on port 8001 and flushes the dev Redis) and run
  single-worker — the backend's active-timer is one global Redis key, so parallel
  timer specs would interfere.
- **Gotcha hit during the v05 pass:** the root `.env`'s real Google OAuth
  credentials get picked up by **both** compose files (`docker-compose.yml`
  and `docker-compose.dev.yml` both do `${GOOGLE_CLIENT_ID:-}` substitution),
  so once real credentials exist for prod, rebuilding *dev* with the default
  `.env` in place also switches dev to the **real** Google adapter — breaking
  every Google-related Playwright spec, since they assume the deterministic
  fake adapter (clicking "Connect Google Calendar" would otherwise redirect
  to real `accounts.google.com`, which can't complete automatically). Fix:
  rebuild dev with those two vars explicitly blanked for that invocation —
  `GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= docker compose -f
  docker-compose.dev.yml up --build -d` — which overrides the `.env` file's
  values (shell env takes precedence over `.env` in Compose's variable
  substitution) without touching the `.env` file itself or prod. Verify via
  `curl -s http://localhost:8001/auth/google/login` — a `Location` pointing
  at `accounts.google.com` means real credentials leaked in; a `Location`
  pointing back at `localhost:8001/auth/google/callback?code=fake-google-code`
  means the fake adapter is active as expected.

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

- **Root-cause `calendar-move-resize.spec.ts`'s two remaining failing
  tests** ("the source chip is hidden while dragging," "cancelling a
  reschedule drag with Escape") — see this file's "Known limitations"
  entry under the v06-era environment regression for the M62 deep-dive's
  refined (but still incomplete) findings: the app's own drag-arm listener
  was conclusively ruled out, `scrollIntoViewIfNeeded()` did not fix it,
  and the underlying reschedule-drag mechanics still functionally work
  even when these two visual-assertion tests fail — next step suggested is
  instrumenting `withDragAndDrop`'s own internal drag-state instead.
- No `prompts/app_improvements_vNN.md` pending — next one arrives whenever
  the user drops one in.
- Consider actually fixing the M18 dnd-kit scrolled-container drag bug (currently
  only worked around in tests) if it turns out to bite a real user.
- Revisit the UTC-vs-local-timezone limitation if week/day boundaries ever look
  wrong to the user in practice.
- Revisit the tree auto-expand-on-add-child gap if it becomes annoying.
- Consider a per-spec (not per-run) Redis flush for the Playwright suite if the
  crowding-related flakiness noted above gets worse as more specs are added
  (it has: recurred in the v03, v04, v05, v06, *and now v07* passes across
  several specs, always resolved by an isolated re-run).
- Editing an existing recurrent task's recurrence rule (v04/v05 limitation
  above) if it turns out to be annoying in practice.
- Recurrent-task groups (v05 M47) currently have no way to set up nesting at
  *creation* time (only via drag-and-drop, M48, after the fact) — revisit if
  that turns out to be an annoying two-step dance in practice.
- Register `scripts/start-on-boot.ps1` in Task Scheduler (v07 M66) — the
  script and registration command are ready, but registration itself
  couldn't be completed from within a Claude Code session (Task Scheduler
  denied access); the user needs to run the command from the script's
  header comment themselves.
