# Interpreted App Improvements (v03)

Ordered restatement of `app_improvements_v03.md`, grouped by view, with the
ambiguous items resolved per your answers below each one. Items 2 and 11 in
the original file are verbatim duplicates ("right-click delete on the Plan
left panel") — merged into a single item 2 below; everything after it is
renumbered down by one, so this file has 11 items instead of 12.

## Plan view — calendar

### 1. Dragging a past-locked chip forward creates a copy, not a move

Today, a chip whose interval is **fully in the past** can't be dragged at
all: `PlanCalendar.tsx`'s `draggableAccessor` returns `false` for any event
where `end <= now` (`intervalTiming.ts`'s `isFullyPast`), so the drag gesture
never even starts. In-progress chips (start passed, end hasn't) *are*
draggable, but any start-time change is rejected — client-side
(`handleEventChange`) and server-side (`IntervalService._enforce_edit_lock`,
`interval_service.py`) both raise a lock error.

**Resolved, per your answer:** this is a deliberate **exception to the M16
lock**, scoped to exactly this gesture — dragging a past (or in-progress,
start-locked) chip to a slot after "now" no longer moves it. Instead it
**creates a new interval** at the drop target, and the original past interval
is left completely untouched, exactly as it was — still there, still
historical record. This effectively turns "drag a locked chip forward" into
a copy/duplicate action rather than a move, which is the one case in the app
where a drag is allowed to *not* delete the source.

*Implementation note for planning:* both the `draggableAccessor` gate and the
lock-enforcement paths (client `handleEventChange`, server
`_enforce_edit_lock`) need a new branch: if the source event is past/locked
**and** the drop target's start is after "now," allow the gesture and, on
drop, call the interval-creation path instead of the interval-update path.
Dragging a locked chip to another **past** slot should presumably still be
rejected as today (no valid use case for backdating history) — flagging this
as an assumption, not something you were asked directly.

### 2. Right-click "Delete" on a Plan left-panel task row

Right-click on a task row in the Plan view's left tree panel currently opens
only the browser's native context menu — `TaskTreeNode.tsx` has no
`onContextMenu` handler at all. Deleting a task exists today only via the
detail panel's kebab (⋮) "Options" menu (`TaskDetailPanel.tsx`, added in v02
item 14).

Add the same `ContextMenu.tsx` component already used elsewhere in the app
(the calendar chip's right-click menu, and the detail panel's kebab menu) to
each row in the left tree panel, triggered by `onContextMenu`, with a single
"Delete" item that opens the existing delete-confirmation flow
(`ConfirmDialog`) — the same confirmation step the kebab-menu path already
uses, just reachable from a second entry point.

### 3. Save/Discard buttons for name and Definition-of-Done edits

Title and Definition of Done are already editable, plain controlled inputs
in `TaskDetailPanel.tsx` — nothing is auto-saved on blur. A "Save changes"
button already exists (gated on `isDirty`) but renders inline below the
"Estimated time" block, not top-right, and there is currently **no discard/
cancel button at all** — the only way to undo an in-progress edit today is to
navigate to a different task (which resets the local form state via a
`useEffect` on `task.id`).

This item repositions and completes that existing mechanism: move "Save"
next to a new "Discard" button, both placed at the **top right of the
panel, to the left of the kebab (⋮) Options button** — replacing the current
inline placement. "Save" persists the edit (same mutation as today).
"Discard" reverts the local `name`/`dod` form state back to the task's
last-saved values without navigating away. Both buttons only need to be
enabled/visible while there's an unsaved edit (`isDirty`), consistent with
today's gating.

### 4. Interval editing at the detail panel: independent start/end dates

`IntervalTimeFields.tsx` (shared by both the calendar's "Edit time" modal and
the detail panel's inline interval editor) currently exposes a single shared
`day` field plus separate `startTime`/`endTime` fields — one date is applied
to both ends, so an interval can only be expressed as same-day. This makes
it impossible to represent (or correctly edit) a plan that crosses midnight.

Split this into two independent date fields — a start date and an end date —
alongside the existing start-time and end-time fields, in both places that
reuse `IntervalTimeFields.tsx`. Validation: end (date+time combined) must
remain strictly after start, same as today's same-day time-only check, just
computed across the full datetime instead of time-of-day alone.

### 5. "Requires" dropdown: visual parity with Execute's task picker

The Plan detail panel's "Requires" prerequisite selector is currently a flat,
alphabetically-sorted native `<select>` (`TaskDetailPanel.tsx`) with no
hierarchy — it's a plain list of task names, and includes non-leaf ("goal")
tasks as selectable options. Execute's task picker (`TaskPicker.tsx`) is a
custom indented-tree dropdown (depth-based indentation, expand/collapse
carets) that also greys out and disallows selecting goal tasks.

**Resolved, per your answer:** this is **visual parity only**. Swap the
"Requires" dropdown to use the same indented-tree presentation as Execute's
picker (indentation, carets, tree structure instead of a flat alphabetical
list) — but do **not** adopt Execute's leaf-only restriction. Goal (non-leaf)
tasks remain selectable as prerequisites, unchanged from today's capability;
they should render as normal (not greyed-out/disabled) rows in the
restyled dropdown, unlike how Execute presents them.

### 6. Block deleting a past interval via the detail panel's "×"; show a dialog

The task detail panel's per-interval "×" button (`TaskDetailPanel.tsx`) calls
`deleteInterval` directly with no time check. Unlike interval *editing*
(which is covered by M16's `_enforce_edit_lock`), interval *deletion* was
never brought under that lock, on either the frontend or the backend
(`IntervalService.delete_interval` has no lock check) — so today, a user can
freely delete an interval that's already in the past or currently in
progress, silently erasing history that M15/M16 otherwise went out of their
way to preserve.

Block deletion of any interval whose `end` is not strictly in the future
(i.e., fully-past and in-progress intervals, same boundary as the existing
`isFullyPast`/edit-lock helpers) via the detail panel's "×" — clicking it on
a locked interval opens a dialog stating the deletion isn't possible, instead
of performing the delete.

**Assumption:** `PlanCalendar.tsx`'s right-click "Delete" on a calendar chip
has the identical gap (no lock check on delete) and isn't mentioned in the
original request, but leaving it unrestricted would mean the same interval
is deletable from one entry point and blocked from another. I'm applying the
same lock check there too, for consistency — flag if you want the calendar
right-click delete left as-is.

### 7. No visual "duplicate chip" while dragging an existing chip to reschedule

**Resolved, per your answer:** this is about the existing-chip reschedule
drag (react-big-calendar's built-in `withDragAndDrop` addon,
`PlanCalendar.tsx`) — not the M17 ghost-preview used when dragging a new,
unscheduled task in from the left tree panel (that flow has no pre-existing
chip to conflict with, so there's nothing to duplicate). Today this codebase
adds no custom preview styling to the reschedule-drag flow, so whatever
"looks like two chips" during the gesture is the library's uncustomized
default drag visuals — the source chip stays fully rendered at its original
slot while a drag image follows the cursor.

Fix: hide the source chip for the duration of the drag gesture (from
drag-start until drop or cancel), so only the moving drag image is visible —
matching your answer ("hide it"). On drop, normal behavior resumes (the chip
reappears at its new slot; on cancel, back at its original slot). This is a
rendering-only change; the underlying move-on-drop data behavior ("removing
the old chip and inserting the dragged chip on its time interval") already
works correctly today per the original report and needs no fix.

## Undo

### 8. Ctrl+Z scoped per view, not global

`UndoProvider.tsx` currently maintains a single global undo/redo stack pair,
with one `keydown` listener intercepting Ctrl+Z/Ctrl+Y regardless of which
view (`ActiveComponent` in `App.tsx`) is currently mounted — an undo pops
whatever the most recently pushed entry was, even if it came from a view
that isn't the one currently on screen.

Scope undo so that Ctrl+Z while viewing Plan only pops/undoes entries that
originated from Plan, Execute only pops Execute-originated entries, and so
on — **except** where undoing a view's own entry needs to also revert a
side-effect that touched another view's data (the original request's carve-
out), in which case that single undo entry still performs the full,
correct reversal across whatever it touched.

**Assumption (design, not asked directly):** rather than genuinely separate
per-view stacks (which would make cross-view entries ambiguous about which
stack to live in), tag each `UndoEntry` at push time with the set of
view(s) it's relevant to — normally just the view that pushed it, but a
cross-view side-effect entry (e.g., an action on Plan that also changes
Execute's display) gets tagged with both. Ctrl+Z on a given view then
searches the shared undo stack from the top for the most recent entry tagged
with the *current* view, pops and runs it (and anything above it in the
stack that's skipped over stays in place, not discarded) — rather than
maintaining fully independent stacks per view, which would complicate the
already-reworked-in-M18 `{label, run()}` self-describing entry design more
than necessary. Flag if you intended fully independent per-view stacks
instead (where a skipped-over entry from another view would need separate
handling).

## Evaluate view

### 9. Excuses can only be attached to gaps before the current time

`ExplainGapDialog.tsx` and its trigger (`EvaluateCalendar.tsx`'s
`onSelectEvent`, gated only on `mode === 'diff' && diffKind === 'uncovered'`)
currently have no time restriction anywhere in the stack — a **future**
planned interval trivially has no real tracked time yet, so it renders as a
fully "uncovered" gap and is just as clickable as a genuinely-missed past
gap, which doesn't make sense (you can't yet have failed to do something
that hasn't happened).

Restrict the click target to uncovered segments whose time range is fully
before "now" — a future uncovered segment should render as non-interactive
(same non-clickable treatment the diff calendar already gives *covered*
segments), consistent with the existing visual distinction between covered/
uncovered chip portions from M22. Add the equivalent check server-side too
(`ExcuseService.attach`, `excuse_service.py`), which currently has no
time-based validation either — a determined client could otherwise still
hit the endpoint directly for a future gap.

## Task lifecycle

### 10. Root task doesn't return to "backlog" when its last remaining child is deleted outright

M20's keep-as-backlog override (`state_override`, `_compute_state`,
`TaskTree.tsx`'s "No, don't remove" flow) already works correctly for the
common case — a child reaches `sprint_done`/`done`, or is deleted, while at
least one sibling child remains: `qualifiesForRemovalPrompt` and the backend
override both key off the *current* set of children, so the prompt re-fires
correctly as siblings change.

**Resolved, per your answer:** the gap is specifically when the **last
remaining child is deleted outright** (not completed) — `children_ids`
becomes empty, `qualifiesForRemovalPrompt` short-circuits to `false`
(`taskTree.ts`) so the "keep as backlog?" prompt never fires, and separately
`_compute_state`'s `if not node.children` branch (`task_service.py`) makes
the now-childless parent read as `is_leaf: true` off its own raw `state`
field, bypassing the `state_override` check entirely rather than resolving
to `backlog`.

Fix: when a task's last remaining child is deleted (leaving it with zero
children) and it previously had at least one child, treat that the same way
as "last child reached sprint_done/done" for purposes of surfacing the
keep-as-backlog decision — the removal prompt should fire, and choosing
"No" should apply the same `state_override` path that already exists for
the completion case. A childless task that **never** had children (a
freshly created leaf, or an intentionally empty new root) is unaffected —
this only applies to a task transitioning from "had children" to "has
none."

## Cross-view data model

### 11. Deleting a task shouldn't erase its time-tracked chip's name on Execute/Evaluate

Deleting a task already correctly preserves the underlying data: backend
task deletion removes the task from the graph and cleans up only its
**future** (not-yet-started) intervals, deliberately leaving past/in-progress
intervals and **all** time-tracking `Entry` records completely untouched
(`routers/tasks.py`, `TaskService.delete_task`). So this isn't data loss —
it's a **display bug**. `Entry` (`models/entry.py`) stores only a bare
`task_id`, no denormalized task name, and every place that renders a
tracked-time chip resolves the name via a live lookup
(`tasksById.get(entry.task_id)`, with an `'Unknown task'` fallback) in
`ExecuteCalendar.tsx`, `EvaluateCalendar.tsx`, and — not mentioned in the
original report, but the same bug — `PlanCalendar.tsx`'s rendering of a
task's own still-preserved past chips. Once the task is deleted, every one
of those lookups falls through to the fallback.

Fix: snapshot the task's name onto the `Entry` (and, since the same live-join
pattern affects Plan's past-chip rendering too, onto `Interval` as well) at
creation time, so the display name survives independently of whether the
originating task still exists. Rendering falls back to the live task lookup
only when a name snapshot isn't present (e.g. existing entries created before
this change ships), and to `'Unknown task'` only if neither is available.
This naturally satisfies the original request's explicit constraint —
"deleting a task from the Plan view should not affect the tracked task on
Execute view, neither the display of information at Evaluate view" — since
none of those views' displays depend on the task still existing after this
fix.

## Notes on scope

- Items 1 and 7 both touch the existing-chip reschedule drag in
  `PlanCalendar.tsx`, but are otherwise unrelated (a locked-source copy
  behavior vs. a drag-visual fix for unlocked chips) — worth sequencing
  together since both touch the same `onEventDrop`/`handleEventChange` path,
  but they don't share logic beyond that.
- Item 6's lock check and item 9's time check are both instances of the same
  underlying "is this before/after now" boundary already centralized in
  `intervalTiming.ts` for editing — reuse that rather than writing new ad hoc
  comparisons.
- Item 11 (name snapshotting) should land before or alongside item 6, since
  item 6 prevents deleting past intervals but doesn't touch the task-deletion
  path itself — they're independent fixes that happen to both concern
  interval/entry history integrity.
- Item 8 (per-view undo) is a standalone architecture change to
  `UndoProvider.tsx` — none of the other items depend on it, but it's the
  largest single item here and worth scoping as its own milestone rather than
  bundling with anything else.
