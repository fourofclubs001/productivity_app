# Interpreted App Improvements (v04)

Ordered restatement of `app_improvements_v04.md`, with the ambiguous items
resolved per your answers below each one. This is the first improvements
list that adds a real external integration (Google Calendar) and a new
domain concept (recurring "routine" tasks), so several items carry more
up-front design framing than past passes — full architecture still gets
worked out in plan mode, this just locks down the *behavior*.

## 1. Connect to Google Calendar

Today there is a single shared top nav bar (`App.tsx`) with three tabs
(Plan/Execute/Evaluate) and no per-view header — so "every view" means one
button in that shared bar, not three separate ones. Add a "Connect Google
Calendar" control there, top-right.

**Resolved, per your answer:** this is a **real OAuth2 connection**, not a
stub — you'll create a Google Cloud OAuth client (Testing-mode is fine for a
single-user app; just add your own Google account as a test user) and I'll
wire the Client ID/Secret in as backend config. Concretely, once we reach the
implementation milestone for this item I'll ask you to:
1. Create an OAuth 2.0 Client ID (type "Web application") in Google Cloud
   Console, with the Google Calendar API enabled on that project.
2. Add authorized redirect URIs for both stacks —
   `http://localhost:8000/auth/google/callback` (prod) and
   `http://localhost:8001/auth/google/callback` (dev) — a client can have
   both registered at once.
3. Drop the Client ID/Secret into `backend/.env` (new `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` vars, following the existing `.env.example`
   pattern) rather than pasting the secret into chat.

Backend holds one global token set (this is a single-user app — no per-user
storage needed), refreshing the access token via the stored refresh token as
needed. The button reflects connected/disconnected state and offers a
"Disconnect" action once connected (clears the stored tokens; does not
delete already-synced Google events).

## 2. Retroactive "push to Google Calendar" for pre-connection events

**Scope, resolved from context:** the only place today where a chip's
right-click menu offers "Delete" for an *event* (as opposed to a task row)
is the Plan calendar chip (`PlanCalendar.tsx` — currently "Edit time" /
"Delete"). The Plan left-panel tree row's right-click "Delete" (v03 M25)
deletes a *task*, not a scheduled event, so it's out of scope here. Execute's
calendar is read-only with no context menu at all, and per item 3 below,
tracked time is explicitly never synced to Google — so this doesn't apply
there either.

Add a third item to the Plan calendar chip's context menu, shown only when
(a) Google Calendar is connected, and (b) that specific interval doesn't yet
have a linked Google event (i.e., it predates the connection, or was created
before this feature shipped at all). Selecting it creates the corresponding
Google Calendar event now and stores the returned event id on the interval,
so the option naturally disappears on subsequent right-clicks of that same
chip.

**Naming note:** this app already has an existing, unrelated "Add to
calendar" feature (`AddToCalendarModal.tsx`) — it means *schedule this task
onto the app's own local Plan calendar*, nothing to do with Google. Reusing
that exact label for this new Google-sync action would be confusing right
next to it. I'll label the new menu item **"Add to Google Calendar"**
(explicit) rather than bare "Add to calendar" — flag if you'd rather I find
different wording.

## 3. Auto-sync new planned events going forward; tracked time never syncs

**Resolved scope:** once connected, *every* new Plan interval — created via
drag-to-schedule, the existing "Add to calendar" (local-schedule) modal, or
typed into the "Edit time" fields — gets pushed to Google Calendar
automatically at creation time, with the returned event id stored back on
the interval (same field item 2's manual action fills in for older ones).

**Assumption, not asked directly:** editing or deleting a *since-synced*
interval should keep Google in sync too (update/delete the linked event),
otherwise Google Calendar would silently drift out of date the first time
someone drags a synced chip to reschedule it. I'm treating this as implied
by "kept in sync," not just "synced once at creation" — flag if you only
want one-way, create-only syncing.

Execute's tracked-time entries are untouched by any of this, exactly as
specified — no Google event is ever created, updated, or read for tracked
time.

## 4. "Routines" tab with a recurrence dialog

The Plan view's left panel currently has no tabs at all — it's just the task
tree directly. Add a small tab strip above it: **"Tasks"** (today's tree,
unchanged) and a new **"Routines"** tab.

**Resolved, per your answers:**
- **Auto-scheduling:** a routine task's recurrence rule automatically
  creates new Plan intervals on each occurrence date — the user doesn't have
  to manually drag each one in. (Generation will lazily catch up a rolling
  window into the future — mirroring the existing `RolloverService`'s
  idempotent "process anything not yet handled since we last checked"
  pattern — rather than a real background cron job, since this app has none
  today.)
- **Hierarchy:** routine tasks are **leaf-only** — no subtasks. Simplest
  model: they're independent root tasks that live only in the Routines tab,
  not duplicated into the main Tasks tree.
- **Occurrence reset:** one persistent task per routine (not a new task
  instance per occurrence). Once an occurrence's interval ends, if the task
  was `sprint_done`/`done` it resets back to `backlog` automatically, ready
  for the next occurrence — reusing the app's existing state machine rather
  than inventing a separate "instance" concept.

**Dialog contents:** the reference screenshot (`references/recurrence_task.png`)
is Google Calendar's *recurrence-rule* sub-dialog specifically — "Repeat
every [N] [day/week/month/year]," "Repeat on" (day-of-week toggles, relevant
for weekly), and "Ends" (Never / On [date] / After [N] occurrences). It
doesn't include a time-of-day, because in Google Calendar that's set
separately on the main event form. Since routine tasks here don't go through
a "create event" form, the new-routine dialog needs to bundle three things
in one place: (1) name + Definition of Done, same as today's `NewTaskDialog`;
(2) a start time + duration for each occurrence (reusing
`IntervalTimeFields.tsx`'s time inputs); (3) the recurrence rule itself,
matching the screenshot's fields exactly. Flag if you pictured this as a
multi-step wizard instead of one dialog.

**Assumption:** deleting or editing one auto-generated occurrence's interval
only affects that single interval (like editing/deleting any other Plan
interval today) — it does not cancel or alter the rest of the series. Full
Google-Calendar-style "this event / this and following / all events" editing
semantics are out of scope for v04 unless you'd like that added.

## Notes on scope and sequencing

- Item 1 (OAuth connect/disconnect) is the foundation everything else here
  depends on — items 2 and 3 both need the stored token/connected-state
  check, so it should land first as its own milestone.
- Items 2 and 3 both touch the same "push an interval to Google Calendar"
  backend capability (create/update/delete a Google event for a given
  interval) — worth building that as one shared piece, then wiring the
  manual (item 2) and automatic (item 3) trigger points to it separately.
- Item 4 (routines) is largely independent of 1–3 in its data model (a new
  recurrence rule + lazy occurrence-generation service), but its generated
  intervals should flow through the same item-3 auto-sync path once both
  exist, rather than duplicating sync logic — sequencing routines after
  items 1–3 avoids that duplication.
- None of this touches Execute or Evaluate's own displays beyond passively
  showing whatever intervals exist (including now auto-generated or
  Google-linked ones) — no changes needed there beyond what falls out of
  the interval model gaining a couple of new optional fields
  (`google_event_id`, and whatever recurrence-linkage a routine's generated
  interval carries).
