# v08 improvements — interpreted

Ordered restatement of `prompts/app_improvements_v08.md`, clarified per the
answers below. This is the largest pass since the initial build: item 1 turns
the app from single-user / self-hosted into a real multi-user web app on
Firebase + Firestore + Cloud Run, which is not one milestone but an epic
(auth, a full persistence migration off Redis, per-user data scoping, a
public deployment, and a one-time migration of the existing prod data).
Items 3–5 are ordinary-sized frontend changes. Item 2's Fable UX proposal
has been produced (`prompts/v08_fable_ux_proposal.md`) and distilled into
the **Fable UX checklist** near the end of this document — 30 polish items
for the user to pick from.

**Selected scope (user decision):** everything — items 1, 3, 4, 5 (item 1
as the full epic: Auth + Firestore migration + per-user scoping + public
deploy + prod data migration, this pass) **and all 30 Fable UX checklist
items**, including the judgment-call items. This is a very large pass;
expect it to run 25+ milestones. Sequencing is worked out in plan mode —
see "Notes for implementation planning" and the checklist's
cross-dependencies.

## Clarifying answers on record

- **Item 1 — Firebase scope: full Firestore, confirmed.** Not "Firebase Auth
  only against the existing Redis backend" — the decision (after discussing
  the trade-off) is to move persistence off Redis entirely and onto Cloud
  Firestore, alongside Firebase Authentication. The Redis backend is
  retired at the end of this pass. Rationale accepted: the repository layer
  (`backend/app/repositories/*.py`) is already separated from the domain
  logic (`backend/app/services/*.py`), so this is a persistence-layer
  rewrite (~7 repository classes) plus a full re-validation of the service
  layer and test suite on top of it — the graph/state/recurrence math
  itself does not change.
- **Item 1 — email sign-in: Firebase email link (magic link), not a typed
  code.** The user enters their email, receives a sign-in link, and clicks
  it — Firebase's native passwordless flow. No custom 6-digit OTP, no email
  provider to wire up. The two accepted registration/login methods are:
  (a) Google account (Firebase Google provider), (b) email link.
- **Item 1 — existing prod data: migrate to the owner's account, with a
  Redis backup taken first.** Before the migration runs: dump the current
  prod Redis (`redis-cli --rdb` / `BGSAVE` copy, or a keyspace export) and
  keep it somewhere safe so the old state can be fully restored if the
  migration goes wrong. Then a one-time script re-keys every existing prod
  entity (tasks, intervals, entries, excuses, recurrent tasks/groups, the
  Google connection) into Firestore under the owner's Firebase UID
  (`lucasvitali001@gmail.com`), so signing in as that account shows exactly
  today's data.
- **Item 1 — hosting: in scope, and Firebase Hosting is chosen (user
  decision).** v08 deploys the app publicly, it does not just deliver
  multi-user capability on the local Docker stack. The frontend is served
  from **Firebase Hosting** (Spark free tier — custom domain + auto SSL).
  Backend on **Google Cloud Run** and data in **Cloud Firestore**, same
  GCP project (see the hosting table under item 1). The local Docker dev
  stack stays for development; prod becomes the Firebase/Cloud Run
  deployment and the prod `docker-compose.yml` stack is retired at cutover.
- **Item 2 — the Fable UX proposal is produced now and folded into this
  document before any implementation.** A Fable agent audits the current UI
  and writes `prompts/v08_fable_ux_proposal.md`; its recommendations are
  then merged into this interpreted doc as a numbered checklist. Nothing —
  UX or otherwise — is implemented until the user has picked which items
  from the full v08 list (items 1–5 **and** the Fable checklist) they want
  built. A Sonnet agent implements the approved UX subset.
- **Item 3 — format, assumed:** below one hour, `mm:ss` (zero-padded
  minutes, e.g. `07:42`); at one hour and above, `hh:mm:ss` (e.g.
  `1:04:09`). This replaces today's `formatFaviconLabel` behaviour in
  `frontend/src/lib/favicon.ts`, which always renders `mm:ss` and so shows
  90 minutes as `90:00`.
- **Item 4 — assumed:** after the Execute tab is removed, the top-nav tabs
  are **Plan** and **Evaluate** only. The Plan view keeps its left panel
  (Tasks / Recurrent tasks) and detail panel unchanged; only its calendar
  changes — it gains the tracked-time entries that today only the Execute
  calendar shows. Pulled-Google chips stay display-only (as today). The
  still-interactive part (drag-to-schedule, reschedule, resize,
  drag-to-create) applies to planned intervals **and now to tracked-time
  chips** — see the next answer.
- **Item 4 — tracked-time chips are editable (user decision, major change).**
  A tracked-time entry chip on the merged calendar can be dragged to a new
  time, edge-resized to change its start/end, and deleted — the same
  gestures planned-interval chips already support. This is a manual
  correction of recorded history ("I actually started at 09:15, not
  09:00"). New backend surface: `PATCH /entries/{id}` and
  `DELETE /entries/{id}` (plus `EntryService`/`EntryRepository` update +
  delete, the delete also pruning the by-start index). The currently
  *running* entry (no `end` yet) is not freely editable — at most its start
  may be adjusted; its end is owned by the live timer. Tracked entries are
  **not** pushed to Google Calendar (the v04 decision that Execute time
  never syncs to Google is unchanged), so editing one touches only this
  app's data. The detail panel gains a "Tracked time" list mirroring the
  existing "Sprint schedule" interval list, with the same inline
  edit/delete affordances.
- **Item 4 — the running-timer indicator's new home, assumed:** since
  `ExecuteView` (which hosts `TimerControl`'s "Tracking … / elapsed / Stop"
  bar) is being deleted, the active-timer readout + Stop button move into
  the shared nav bar, rendered by the already-always-mounted
  `GlobalTimerWatcher` (next to the Google / Config buttons). Nothing shows
  there when no timer is running. Flagged for confirmation in the notes
  below.
- **Item 5 — assumed:** the "track time" button in the detail panel is
  shown for **leaf tasks only** (the app only ever tracks leaves), sits
  directly above the task-name input, and is subject to the same
  preconditions the current Execute "Start" button already enforces
  (prerequisites must have reached sprint-done, etc. — the backend's
  existing `start_timer` validation, unchanged). When the selected task
  *is* the currently-active timer, the button becomes "Stop" and opens the
  existing `StopTimerConfirmModal` (Yes-mark-done / No-just-stop / Cancel).
  Trying to start it while a different task's timer is running is rejected
  with an alert (matches today's backend behaviour — one global active
  timer).

## Ordered items

### 1. Multi-user web app on Firebase Authentication + Cloud Firestore

The app becomes a real multi-user product. This is an epic — expect it to
span several milestones. Scope:

- **Firebase Authentication.** Two sign-in methods only: Google account, and
  email link (passwordless magic link). Frontend gets an auth gate (unauthed
  users see a sign-in screen, nothing else); the Firebase client SDK holds
  the session and supplies an ID token.
- **Backend token verification.** Every API request carries the Firebase ID
  token in the `Authorization: Bearer …` header. A new FastAPI dependency
  verifies it (Firebase Admin SDK) and yields the caller's `uid`. All
  routers depend on it; unauthenticated requests get 401.
- **Persistence migration Redis → Firestore.** Rewrite all of
  `backend/app/repositories/*.py` against Firestore. The service layer
  (`task_service`, `interval_service`, `recurrent_task_service`,
  `rollover_service`, `evaluate_service`, `excuse_service`,
  `timer_service`, `google_auth_service`, `google_sync_service`) keeps its
  shape but every repository method is new code and every service +
  endpoint is re-tested. `redis_client.py`, the `redis` dependency, the
  Redis containers in both compose files, and the `redis-cli FLUSHALL`
  test-setup hooks all go away by the end.
- **Per-user data scoping.** Every entity is namespaced by `uid` (e.g.
  `users/{uid}/tasks/{taskId}`, `users/{uid}/intervals/{intervalId}`, …).
  Two users never see each other's tasks, intervals, entries, excuses,
  recurrent tasks, or Google connection. The single global active-timer,
  the rollover idempotency marker, and the Google token set all become
  per-user.
- **Google Calendar connection per user.** Today there is one global
  `google:tokens` set. It becomes one connection per user; OAuth
  connect/disconnect, refresh, and the sync hooks all operate on the
  current user's tokens.
- **Rollover & recurrent-task catch-up per user.** Both run today as
  request-scoped "catch up on read" dependencies (`apply_rollover`,
  `apply_recurrent_task_catchup`). They stay request-scoped but operate on
  the calling user's data only.
- **One-time prod data migration.** Back up prod Redis first (see clarifying
  answers). Then a script (idempotent, `--dry-run`-capable, in
  `backend/scripts/` following the M45 migration-script precedent) copies
  every existing prod entity into Firestore under the owner's UID.

**Public hosting** (making it reachable by other people, not just
localhost) — the free-tier stack, all one Google Cloud project:

| Layer | Service | Free tier |
|---|---|---|
| Frontend (static SPA) | **Firebase Hosting** (Spark plan) | 10 GB stored, ~10 GB/mo transfer, custom domain + auto SSL. No card required. |
| Backend (FastAPI container) | **Google Cloud Run** | 2M requests/mo, 360k GB-s, 180k vCPU-s/mo; scales to zero → $0 at personal volume. Pairs natively with Firestore (same project, Application Default Credentials, no key file). Needs a billing account on file (card), but stays free at this volume. |
| Data | **Cloud Firestore** (Spark plan) | 1 GiB stored, 50k reads / 20k writes / 20k deletes per day. No card required. |
| Container image / build | Artifact Registry (0.5 GB) + Cloud Build (120 min/day) | Both within free limits. |

- Non-Google alternatives for the backend if avoiding a card on file
  matters: **Render** or **Koyeb** free web service (both sleep on
  inactivity; Firestore access from outside GCP then needs a
  service-account key file to manage as a secret). Frontend could also go
  on Cloudflare Pages / Netlify / Vercel free tiers instead of Firebase
  Hosting — but Firebase Hosting is the path of least resistance here.
- **Chosen (user decision): Firebase Hosting + Cloud Run + Firestore.** One
  project, real free tiers, Cloud Run scales to zero. Deployment is in
  scope for v08 — the app goes public, not just multi-user-capable on the
  local stack.

### 2. Fable UX/visual polish proposal, folded into this doc

The UI "still feels a bit rusty." Shape:

1. A **Fable agent** audits the current UI (Plan tree + calendar, detail
   panel, dialogs, Evaluate, the Google Workspace–styled light theme) and
   writes a concrete visual/UX improvement proposal — spacing, typography,
   colour, component polish, interaction rough edges — to
   `prompts/v08_fable_ux_proposal.md`. Not code.
2. Its recommendations are merged into this document (section below, TBD)
   as a numbered, checkable list.
3. The user picks which UX items — and which of v08 items 1–5 — to build.
4. A **Sonnet agent** implements the approved UX subset, one commit per
   coherent group, tests green.

No behaviour is changed under this item without the user's pick first.

The Fable agent's full proposal is at `prompts/v08_fable_ux_proposal.md`
(30 items, with per-item rationale, effort, and file lists). The checkable
summary is in the **"Fable UX checklist"** section near the end of this
document. The agent could not connect a browser, so the audit is
source-based — pixel values should be eyeballed against the running app
during implementation.

### 3. Timer tab-title format: `mm:ss` under an hour, `hh:mm:ss` from an hour

While a timer is tracking, the browser tab title shows the elapsed time
(`… · Productivity App`, per M58). Today the digits come from
`formatFaviconLabel` in `frontend/src/lib/favicon.ts`, which always renders
`minutes:seconds` — so anything past 59:59 keeps counting minutes
(`90:00`, `132:15`). Change: under one hour show `mm:ss`; at one hour and
above show `hh:mm:ss`. Update the formatter (and its unit tests); the
favicon icon itself is unaffected (it's a plain colour swap now, no digits).

### 4. Remove the Execute tab; merge its calendar into Plan

- **Delete the Execute tab and view.** Top nav becomes Plan / Evaluate.
  Remove `ExecuteView.tsx`; fold what's still needed elsewhere.
- **Plan's calendar shows tracked time too.** `PlanCalendar` today renders
  planned intervals + pulled Google events. It gains the tracked-time
  entries (`useEntriesForWeek`) that `ExecuteCalendar` shows — same
  "actual vs planned" picture the Execute calendar gave, now on Plan.
- **Tracked-time chips are editable** (drag to move, edge-resize, delete),
  not display-only. New `PATCH /entries/{id}` + `DELETE /entries/{id}`
  backend endpoints and the `EntryService`/`EntryRepository` methods behind
  them. The running entry's end stays owned by the live timer. No Google
  sync for entries. The Plan calendar needs a three-way chip distinction:
  `interval` (editable, Google-synced), `entry` (editable, not synced),
  `google` (not editable) — today's binary `isExternal` flag isn't enough.
  A matching "Tracked time" list is added to `TaskDetailPanel` alongside
  "Sprint schedule".
- **`ExecuteCalendar.tsx`** is either retired (its logic merged into
  `PlanCalendar`) or kept as the shared implementation both the old views
  used — decided in plan mode.
- **The running-timer UI moves to the nav bar** (see clarifying answers):
  `GlobalTimerWatcher` renders the "Tracking <task> — <elapsed> — Stop"
  affordance when a timer is active. `TimerControl`'s task-picker + Start
  half is superseded by item 5.
- **Ripple:** `ViewKey` (`lib/views.ts`) loses `'execute'`; per-view undo
  scoping (M33) that tagged entries for `'execute'` collapses onto the
  remaining views — the mark/revert-done pair currently tagged for both
  Execute and Plan just becomes Plan-tagged.

### 5. Start time-tracking from a button in the task detail panel

Add a button directly above the task-name input in `TaskDetailPanel`
(`components/tree/TaskDetailPanel.tsx`):

- Shown for **leaf tasks** only.
- Label "Track time" (or similar) when idle; starts the timer for this task
  via the existing `useStartTimer`, with the backend's existing start
  preconditions unchanged.
- When this task is the active timer, the button reads "Stop" and opens the
  existing `StopTimerConfirmModal`.
- Starting while another task's timer runs → alert, no switch (today's
  one-global-timer behaviour).

This is what replaces the old Execute-view task-picker + Start flow removed
in item 4.

## Fable UX checklist

From `prompts/v08_fable_ux_proposal.md`. Polish only — light theme, Google
restraint, no dark mode, no component library, no calendar-library or
palette change. Effort: **S** = under an hour, **M** = a few hours,
**L** = a day-plus. **All 30 are selected** (user decision) — the
judgment-call items are called out so plan mode can confirm the specific
visual choice, not whether to do them.

### (a) Foundational tokens
- [x] **UX-1** (S) — elevation/radius/scrim tokens (`--shadow-1/-2`,
  `--radius-sm/-md`, `--color-scrim`); drop borders + `shadow-xl` on every
  dialog/menu, swap `bg-black/50` → `bg-scrim`.
- [x] **UX-2** (S) — three missing colour tokens (`--color-text-tertiary`,
  `--color-border-subtle`, `--color-warning-text` — current amber badge is
  ~1.9:1 contrast); on-palette `EXTERNAL_EVENT_STYLE` / favicon / `ColorDots`.
- [x] **UX-3** (S) — type scale: add 13px UI size + 11px caption, retire
  `text-[10px]`, `tabular-nums` on body.
- [x] **UX-4** (S) — remove the `calc(100vh-49px)` magic number (explicit
  `h-12` nav + `flex-1 min-h-0` main).

### (b) Component primitives
- [x] **UX-5** (M) — `Button` component, 4 variants + icon, one 32px size;
  replace ~38 inline button strings.
- [x] **UX-6** (S) — one input recipe with a real 2px accent focus state;
  `accent-color` on checkboxes/radios.
- [x] **UX-7** (S) — `StateBadge` quieter; `done` stops being the only
  solid-fill pill.
- [x] **UX-8** (S/M) — `Menu` (context/options): sizing, viewport edge
  clamping, keyboard nav, `role=menu`.
- [x] **UX-9** (M) — `Dialog` component; delete the 20 copy-pasted
  scaffolds; padding 16→24px. Do in one pass with UX-1 + UX-5.
- [x] **UX-10** (S/M) — inline SVG icon set (~8 icons) replacing the unicode
  glyphs `▸ ▾ ⋮ ⚙ × ‹ ›`; animated chevron rotation. *Judgment call:
  hand-rolled vs `lucide-react` (agent recommends hand-rolled).*

### (c) Plan tree + detail panel
- [x] **UX-11** (S) — merge the "Tasks/Recurrent tasks" tab strip with the
  redundant "TASKS +" header row.
- [x] **UX-12** (S) — tree row rhythm, `cursor-grab`, hover drag-handle,
  hover `⋮`, ring-based reparent drop preview. *Judgment call: depth guide
  lines.*
- [x] **UX-13** (S) — reduce badge noise in tree rows (hide for
  `backlog`/`done`). *Judgment call — you may scan by state.*
- [x] **UX-14** (M) — detail-panel header action bar; **this is where the
  item-5 "Start timer" button lands** (`▶ Start` / `■ Stop 00:12:34`),
  absorbing the standalone "Add child task" section.
- [x] **UX-15** (S) — detail-panel section rhythm + labels; rename
  "Estimated time" → "On calendar" (label/value currently disagree).
- [x] **UX-16** (S) — collapse the empty detail column to 0 width until a
  task is selected. *Judgment call.*

### (d) Merged Plan calendar
- [x] **UX-17** (S) — highlight today's date-number in a circle, not the
  whole column.
- [x] **UX-18** (S) — 48px hour rows, scroll to 07:00 on load, gutter
  labels on the hour line, current-time dot.
- [x] **UX-19** (S/M) — chip refinements: 4px radius, title-first,
  luminance-aware text colour (yellow/sage/pink + white currently fail
  contrast), softer two-colour split, better selected-chip ring, external
  left-border. *Judgment call: diagonal split vs side stripe.*
- [x] **UX-20** (M) — **planned-vs-tracked visual language for the merged
  calendar** (planned = solid fill, tracked = tint + left-border on top,
  live = ring + pulsing dot) + a toolbar legend. **Must be decided before
  item 4's merge ships** or plan and tracked chips are indistinguishable.
- [x] **UX-21** (S) — calendar toolbar: round `‹ ›` icon buttons + a
  **Today** button (no way back to the current week today), promoted week
  label.
- [x] **UX-22** (S) — drag-from-tree drop target: tint the grid wrapper
  instead of a 2px ring around the whole calendar.

### (e) Evaluate
- [x] **UX-23** (S/M) — collapse the two stacked tab rows; `SegmentedControl`
  for the sub-tabs and the Planned/Real/Diff + Day/Week/Month toggles.
- [x] **UX-24** (S) — Evaluate fills height; right-align + `tabular-nums`
  numeric columns; stat-tile restyle; *judgment call: %-colour thresholds*;
  optional tiny progress track in the by-task table.
- [x] **UX-25** (S) — diff-calendar legend + clearer "click to explain" gap
  hover.

### (f) Motion, states, feedback
- [x] **UX-26** (S) — global transitions + `:focus-visible` ring + dialog/
  menu enter keyframes + `prefers-reduced-motion` guard.
- [x] **UX-27** (S) — `EmptyState` component for tree / detail / empty week
  / metrics.
- [x] **UX-28** (S/M) — skeleton loaders instead of "Loading…" strings;
  spinner-in-button for pending actions.
- [x] **UX-29** (M) — **undo snackbar** (Ctrl+Z undo exists but is
  invisible today). *Judgment call — the one net-new UI surface.*
- [x] **UX-30** (S) — small fixes: `GoogleConnectButton` status chip,
  `ConfigButton` gear icon, nav wordmark, resize-handle hover, Enter/Escape
  on the task-name input, wider pickers.

### Agent's recommended minimal set (if only ~5 ship)
UX-1 + UX-26 · UX-5 + UX-9 · UX-10 · UX-17 + UX-18 + UX-19 + UX-21 ·
UX-11 + UX-14 + UX-15. Optional 6th: UX-29.

### Cross-dependencies with items 3–5
- **UX-14 carries item 5** — the detail-panel Start/Stop button is part of
  the action-bar restyle; build them together.
- **UX-20 gates item 4** — pick the planned-vs-tracked chip language before
  merging the calendars.
- **UX-4 / UX-21 / UX-24** all touch code that item 4 rewrites
  (`ExecuteView` removal, calendar toolbar, Evaluate height) — sequence
  after item 4.

## Notes for implementation planning

- **Item 1 is the whole pass's risk.** Suggested milestone breakdown to
  settle in plan mode: (a) Firebase project + Auth on the frontend + the
  backend token-verification dependency, still on Redis, single-user data
  keyed by the one UID; (b) Firestore repository rewrite, entity type by
  entity type, behind the existing repository interfaces, with the test
  suite ported to the Firestore emulator; (c) per-user scoping switched on
  across all routers; (d) Firebase Hosting + Cloud Run + Firestore
  deployment (project setup, container deploy, `firebase.json`, deploy
  script/CI); (e) prod Redis backup + one-time migration script + cutover;
  (f) Redis removal (containers, `docker-compose.yml` prod stack, config,
  dead code).
- **Public hosting — decided: Firebase Hosting + Cloud Run + Firestore**,
  and the deploy is in scope for v08 (see item 1). Cloud Run wants a
  billing account on file (no charge at this volume); the frontend's
  `VITE_API_BASE_URL` build arg points at the Cloud Run URL; CORS origins
  in `config.py` gain the Firebase Hosting domain; the prod
  `docker-compose.yml` stack is retired at cutover (the dev stack stays for
  local work). A deployment milestone (Firebase project setup, Cloud Run
  service + Artifact Registry + Cloud Build, `firebase.json` hosting config,
  CI or a deploy script) is added to item 1's breakdown.
- **Test infrastructure changes materially.** Backend tests today use a real
  Redis via the `redis_client` fixture with `FLUSHALL` between concerns;
  Playwright's `global-setup.ts` does `redis-cli FLUSHALL` against the dev
  stack. All of that moves to the **Firestore emulator** (local, part of the
  Firebase CLI). Budget time for the fixture/setup rewrite, not just the
  app code.
- **Firestore has no sorted sets.** The Redis sorted-set-backed queries —
  intervals by start (`list_for_week`), excuses by start, the midpoint
  `order` / `recurrent_order` sequences — become Firestore range queries
  with composite indexes (define them up front in `firestore.indexes.json`).
  Straightforward, but each needs its own test.
- **Rollover / recurrent catch-up now cost Firestore reads on every
  request.** Today they scan Redis sets cheaply. On Firestore each
  request-scoped catch-up is a small collection read per user; fine at this
  scale, but worth a guard (e.g. skip if the per-user "last applied"
  marker is recent) so a chatty frontend doesn't multiply reads.
- **Confirm the running-timer indicator's placement** (nav bar via
  `GlobalTimerWatcher`) before building item 4 — it's an assumption, and a
  floating widget or a strip under the nav are alternatives.
- **Editable tracked chips (item 4) share the calendar's drag machinery.**
  `PlanCalendar` already has the hand-rolled mousedown/mousemove drag-arm
  listener (M31) gated on `[data-interval-id]`, plus react-big-calendar's
  `withDragAndDrop`. Entry chips need their own `[data-entry-id]` hook and
  parallel `onEventDrop`/`onEventResize` branches routing to the new
  `PATCH /entries/{id}` instead of the interval endpoint. The
  cross-midnight split guard (`isMultiDaySegment`) and the past-lock rules
  need a deliberate decision for entries: a tracked entry is *always* in
  the past, so the M16 "can't edit a past interval" lock must **not** be
  applied to it — editing history is the whole point.
- **Items 3, 4, 5 are independent of item 1** and of the Fable work — they
  can land first (small, low-risk) while item 1's plan is being worked out.
  Item 5 depends on item 4 only loosely (both touch the timer UI); sequence
  4 then 5.
- **Fable UX sequencing:** the foundational + primitive items (UX-1..10,
  26..28, 30) are independent of everything and can land any time. UX-14
  (action bar) ships with item 5; UX-20 (chip language) is decided before
  item 4; UX-4/21/23/24 come after item 4. The auth gate and any
  account/profile surface from item 1 don't block the polish, but the
  sign-in screen itself should get the new `Button`/`Dialog`/token
  treatment once those exist.
- **Pre-v08 ad-hoc fixes, already committed** (`e15dbe1` Google
  invalid-grant token cleanup, `4cbc9e4` recurrent-task duplicate-occurrence
  guard) — separate from v08, landed on `main` before this pass starts, not
  yet pushed.
