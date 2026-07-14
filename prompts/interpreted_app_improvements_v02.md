# Interpreted App Improvements (v02)

Ordered restatement of `app_improvements_v02.md`, grouped by view, with the
ambiguous items resolved per your answers below each one. One item in the
original file was a question rather than a request ("how is that small window
called?") — answered inline where it occurs instead of turned into a work
item.

## Plan view

### 1. Ghost/preview chip while dragging from the left panel to the calendar

While dragging a leaf task from the left tree panel over the calendar, show a
live preview chip snapped to the slot the pointer is currently over — the same
"where would this land" preview Google Calendar shows when dragging an event.
On drop, the preview is replaced by the real interval at that slot (same
default-duration behavior as today).

*Implementation note for planning: today there's no `DragOverlay` in the
`@dnd-kit` setup (`PlanView.tsx`'s `DndContext` has none) — dnd-kit's default
behavior of moving the actual source node is what's visible mid-drag. This
item requires adding a `DragOverlay` (or equivalent) rendered over the
calendar, positioned via the same slot-geometry math `PlanCalendar.tsx`
already uses for drop handling.*

### 2. A task can only be scheduled for a time after its required task's scheduled time

**Resolved, per your answer:** the gate is a **temporal-order check**, not an
existence check. When task B requires task A, a new (or moved/resized)
calendar interval for B must start **after** A's own interval(s) end. If A
has multiple intervals, B must start after the latest one (or: after each
interval of A that the specific dependency should be considered "covered
by" — treating it as "after A's last currently-scheduled interval" is the
straightforward reading and what I'll plan around).

**This changes the v01 item 20 rule for scheduling specifically:** v01 made
scheduling a hard block until the required task reaches `done`. That gate now
moves to *time-tracking* (item 4 below) — scheduling itself only requires A to
already have interval(s) placed before B's requested time, not that A is
finished. Both gates coexist: you can schedule B once A is scheduled-before
it, but you can't *start the timer* on B until A is actually `sprint_done`/
`done`.

### 3. A task cannot set an ascendant task as a requirement

A task cannot mark one of its own ancestors (parent, grandparent, ... up the
existing parent/child DAG) as a **required** task. Reasoning restated from
your note: a parent's completion is already derived from its children's
completion (all-leaf-descendants-done ⇒ parent done), so if a child also
*required* an ancestor, satisfying the child would depend on the ancestor
being done, which depends on the child being done — a cross-graph cycle that
today's cycle checks don't catch.

*Implementation note: today, cycle detection runs separately per graph —
`add_parent` walks the parent/child DAG, `add_requirement` walks the
requirement DAG (`backend/app/services/graph_utils.is_reachable`,
`task_service.py`). This item adds a cross-graph check to `add_requirement`:
reject the link if the proposed "required" task is an ancestor of the task in
the parent/child DAG (or, by extension, if the task is a descendant of the
proposed required task).*

### 4. A task cannot be time-tracked until its required task is sprint_done or done

Starting the timer on task B is blocked while any task B requires is still
short of `sprint_done`. This is the gate v01 item 20 originally described for
*scheduling*; per item 2 above, it now applies to *time-tracking* instead
(scheduling has the separate, looser, temporal-order gate).

*Implementation note: today `interval_service.py` raises
`UnmetPrerequisiteError` for scheduling; `TimerService.start()` has no
prerequisite check at all yet (only a leaf-task check). This item adds the
prerequisite check to `TimerService.start()`, and item 2 loosens the existing
check in `interval_service.py` from "done" to "scheduled-before."*

### 5. Replace inline restriction errors with a dialog

Wherever a blocked action (unmet prerequisite, would-be cycle, etc.) is
currently surfaced as inline text, replace it with a **modal dialog**
carrying the message and a single "OK"/"Accept" button that closes it —
removing the inline version entirely. Concretely, this replaces:

- `PlanCalendar.tsx`'s dismissible `scheduleError` banner (shown above the
  calendar on a blocked schedule attempt),
- `TaskDetailPanel.tsx`'s inline red text under the "Requires" section (cycle
  errors) and under the delete-confirmation section.

*Assumption: this converts every current inline validation-error surface,
including the delete-confirmation error text — "this restrictions" reads as
covering the prerequisite/cycle-type blocks specifically, but I'm treating
"the current way of showing them" broadly since the ask is to standardize on
one pattern, not leave a mix.*

### 6. Deleting a task removes its future calendar chips

When a task is manually deleted from the Plan view, remove any of its
calendar intervals that start **after the current time**. Intervals that are
in the past or currently in progress are left alone (they remain as
historical Execute/Evaluate data).

### 7. Time-based lock rules for editing a chip's interval on the Plan calendar

A chip's start/end time can be edited (dragged/resized) according to where
"now" falls relative to it:

- **Current time is after both start and end** (fully in the past): the chip
  is completely locked — neither edge can move.
- **Current time falls inside the interval** (in progress): the start edge is
  locked (can't move a start time that's already passed); the end edge can
  still move.
- **Current time is before both start and end** (fully in the future): both
  edges are freely editable, as today.

### 8. A task can only be scheduled for a time after the current time

No new interval — via drag-from-panel, the "add to calendar" modal, or
otherwise — can be created with a start time before "now." (This is the
creation-time counterpart to item 7's editing rules.)

### 9. Ctrl+Z undoes adding a chip to the calendar

**Closes an existing gap:** v01 item 16 already scoped undo to cover
"drag-created intervals," but per this session's code check, interval
*creation* was never actually wired into the undo stack
(`frontend/src/undo/UndoProvider.tsx`) — only interval delete, interval move/
resize, and the sprint-done transition currently push undo entries. This item
is the fix: pushing an undo entry when a new interval is created (by drag or
by the "add to calendar" modal) whose undo action deletes that interval.

### 10. Ctrl+Y redoes what Ctrl+Z undid

**New capability — today there is no redo at all**, only a single pop-based
undo stack (`UndoProvider.tsx`). This item adds a redo stack: each undo pops
an entry off the undo stack, runs its inverse, and pushes a corresponding
"redo" entry onto a separate redo stack; Ctrl+Y pops and re-applies the most
recent redo entry (and pushes its inverse back onto the undo stack, standard
undo/redo-stack behavior). Applies uniformly to every action type the undo
stack already covers, including the new item 9 case above.

*Assumption: performing a new undoable action clears the redo stack, the
conventional behavior (redo history doesn't survive a fresh action).*

### 11. Past chips render transparent in the Plan calendar

Reuse the same transparent/dimmed treatment the Execute calendar already
applies to elapsed, time-tracked entries: in the Plan calendar, any chip
whose interval is entirely in the past renders transparent instead of full
opacity.

## Task detail view

### 12. Remove the editable "estimated time" field

Drop the manually-typed "Estimated hours" number input from the leaf task
detail panel (added in v01 item 8) — per your note, it's redundant now that
the calendar itself is the source of truth for how much time is committed to
a task.

**Assumption:** the existing **read-only** "hours covered" line (the sum of
that task's reserved calendar intervals, from `useTaskCoverage`) stays and
effectively becomes *the* estimate display — I'm not removing the whole
estimate concept, just the separate manually-entered number that duplicated
it. Parent-task rollups (already computed from descendants) are unaffected
since they never used the manual field.

### 13. Move "add child task" below Parents, matching its format

Move the "+ Child task" button from the top of the detail panel (next to the
name field) down to a new section placed directly below "Parents," styled the
same way the Parents section lists its chips — except **without** the
add-parent dropdown/select, since adding a child isn't "picking an existing
task" the way adding a parent is; it's still the same creation flow as today
(opens the new-task dialog pre-filled with this task as parent), just
relocated.

### 14. Replace the bottom "Delete task" button with a top-right options menu

Remove the standalone "Delete task" button (and its inline confirm step) from
the bottom of the detail panel. Add a **three-dot button** at the top right of
the panel that, when clicked, opens a small popup with a single option,
"Delete task" — the same visual pattern as the existing right-click menu on a
calendar chip (`ContextMenu.tsx`, currently offering just "Delete" there too).

**Naming your question ("how is that small window called?"):** the button
itself (three dots, usually stacked vertically: ⋮) is conventionally called a
**kebab menu button** (a row of three dots stacked horizontally is a "meatball
menu" — this app's icon should be the vertical kebab form to read as a menu
trigger rather than a "more text" ellipsis). The popup it opens is a
**context menu** / **overflow menu** — same family as the `ContextMenu`
component already in the codebase for the calendar-chip right-click. I'll
reuse that existing component for this rather than building a second one.

**No `GLOSSARY.md` (or any glossary section) currently exists anywhere in the
repo** — this will need to be created as part of implementing this item, with
this term as its first entry (e.g. "Kebab menu — the ⋮ button; opens a
context/overflow menu, see `ContextMenu.tsx`").

### 15. Add a "Mark sprint done" button to the task detail view

Add a button on the detail panel that manually triggers the sprint-done
transition, independent of stopping a timer.

**Assumption:** clicking it opens the same "Is the definition of done
fulfilled?" confirmation modal introduced in v01 item 24
(`DoneConfirmModal`), for consistency with the only other place this
transition happens today (`TimerControl.tsx`) — not an instant, unconfirmed
transition.

### 16. Editable interval entries (day / start hour / end hour) on an existing schedule

Today, editing an already-scheduled interval's time is drag/resize-only
(`PlanCalendar.tsx`'s `resizable`/`onEventDrop`/`onEventResize`) — there's no
typed-field way to correct it precisely, only the "Add to calendar" modal's
day/start/end fields for *creating* a new one (v01 item 6). This item adds
the same typed day/start-hour/end-hour fields for **editing** an existing
interval.

**Assumption on entry point:** rather than changing what a chip click does
(today it opens the task's detail panel, per v01 item 12, intentionally), I'm
adding an "Edit time" option to the existing right-click `ContextMenu`
alongside "Delete" — clicking it opens the same time-entry modal used for
creation, pre-filled with the interval's current day/start/end. Flag if you
intended a different entry point (e.g. replacing the click-opens-task-detail
behavior instead).

## Evaluate view

### 17. Diff calendar: explain a plan/execution gap with an "excuse"

In the Calendar subtab's `diff` mode, wherever a planned interval has a
portion with no overlapping tracked time, that gap becomes clickable and
opens a dialog to explain the discrepancy. The dialog lets you either pick
from your existing, previously-created "excuses" (a reusable, named list — a
lightweight tag/reason type you build up over time) or type and save a new
one, then attaches the chosen excuse to that specific gap.

**Resolved, per your answer:** the click target is the **specific
non-overlapping sub-segment** of the planned chip, not the whole chip — which
means the diff-mode chip rendering needs to visually distinguish the covered
portion (overlapping tracked time) from the uncovered portion, and only the
uncovered portion is clickable/hoverable to open the dialog.

**Implementation note for planning:** today `diff` mode is a naive overlay —
`EvaluateCalendar.tsx` renders `[...planned, ...real]` with no actual gap/
overlap computation. This item requires adding real interval-diffing logic
(computing, per planned interval, which sub-ranges are and aren't covered by
any real/tracked interval for the same task) before the visual split and
click targeting can work.

### 18. New Evaluate subtab: "Excuses" metrics

Add a third Evaluate subtab (alongside Calendar and Metrics) showing metrics
over the excuses logged via item 17.

**Resolved, per your answer:** a **frequency table** — how often each excuse
was used, overall and broken down by task — consistent with the existing
Metrics subtab's table-based presentation, not a chart.

## Task lifecycle

### 19. A kept root task resets to "backlog" instead of staying "done"

Per v01 item 10, when a root task's last child reaches `sprint_done`, the
user is asked whether to remove that root task from the Plan view. If they
decline (keep it), this item adds: the root task's state is force-reset to
`backlog`.

**Resolved, per your answer:** this is an **explicit override**, not just
inspecting the live-computed state. Today, `_compute_state` in
`task_service.py` derives a parent's state purely from its descendants (all
leaf descendants done ⇒ parent `done`), computed on the fly rather than
stored. Keeping a finished parent needs a stored override so it reads as
`backlog` (a fresh, reusable container for new sub-tasks) even though its
existing children are all finished — this is new persisted state, not
something `_compute_state`'s existing derivation produces. The override
should presumably clear the moment a new, not-yet-finished child is added
back under it (falls through to normal derivation again) — flagging this as
an assumption for the implementation plan rather than something you were
asked directly.

## Notes on scope

Several items above share underlying plumbing and will likely be designed
together rather than as unrelated features:

- Items 2, 3, and 4 are all extensions of the existing prerequisite/
  requirement graph (`graph_utils.py`, `task_service.py`,
  `interval_service.py`) — one design pass should cover all three, plus
  item 5's dialog-based error surface for when any of them block an action.
- Items 6, 7, 8, and 11 are all "what does the current-time boundary mean for
  a Plan calendar chip" rules — one shared time-boundary helper (likely
  alongside the existing UTC-boundary code flagged in `PROJECT_STATUS.md`)
  should back all four rather than four separate ad hoc checks.
- Items 9 and 10 both touch `UndoProvider.tsx` and should be designed
  together as one undo/redo-stack rework rather than bolting redo on
  separately.
- Items 12 and 16 both touch how a task's calendar-derived time is presented
  in the detail panel (a removed manual number vs. added precise editing) —
  worth sanity-checking together so the detail panel's schedule-related UI
  reads as one coherent section, not two unrelated changes.
- Item 17 depends on real gap/overlap computation existing before item 18's
  metrics can be meaningful — 17 should land first.
