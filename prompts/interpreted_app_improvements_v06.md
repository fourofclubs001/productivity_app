# v06 improvements — interpreted

Ordered restatement of `prompts/app_improvements_v06.md`, clarified per the
answers below. Each item below will likely become its own milestone (M50+),
per the project's usual one-milestone-per-improvement workflow.

## Clarifying answers on record

- **Item 4 (idle-detection default state):** **off by default.** The feature
  must not change any existing timer behavior until the user explicitly
  enables it from the new Configuration dialog (item 3).
- **Item 5 (favicon "show the timer"):** **live digits** — render the actual
  elapsed time (not just a static colored icon) into the favicon while
  tracking, updating in step with `TimerControl.tsx`'s existing per-second
  elapsed-time tick.
- **Item 5 (red-favicon reset) / item 4 (idle auto-stop notice):** auto-stop
  is **not** silent. The moment idle-detection stops the timer, a dialog
  appears telling the user the timer was stopped due to inactivity, with a
  single acknowledgement button at the bottom. The favicon turns red at the
  same moment the timer auto-stops, and only reverts to normal once the user
  clicks that acknowledgement button (not on a fixed delay, not merely on
  page focus/activity).

## Ordered items

1. **Group the Execute/Evaluate task dropdowns by "Tasks" vs. "Recurrent
   tasks", collapsing recurrent groups too.** Two components are in scope,
   per the request's explicit examples:
   - `frontend/src/components/timer/TaskPicker.tsx` (Execute's "select a
     task to track" dropdown)
   - `frontend/src/components/evaluate/TaskFilter.tsx` (Evaluate Metrics'
     task-filter checkbox dropdown)

   Both currently build their tree purely from `parent_ids`/`children_ids`
   (`treeRootIds`/`rootIds` + `treeChildIds` in `lib/taskTree.ts`). Recurrent
   tasks and recurrent groups (`is_recurrent_task`/`is_recurrent_group`) sit
   outside the main DAG (`recurrent_parent_id`, not `parent_ids`) but are
   still present in the same flat `tasks` list from `useTasks()` — today
   they show up as bare extra "roots" in both dropdowns, intermixed with
   real root tasks and with no group nesting shown at all. Fix: split each
   dropdown into two labeled, independently-collapsible top-level sections —
   "Tasks" (today's existing main-tree rendering, unchanged) and "Recurrent
   tasks" (reusing `buildRecurrentTree`/`RecurrentNode` from
   `lib/recurrentTaskTree.ts`, the same structure `RecurrentTasksList.tsx`
   already renders, so recurrent groups expand/collapse exactly as they do
   there). Assumption: this is presentation-only — no backend changes, no
   change to which tasks are selectable/filterable, just how they're
   grouped and labeled.

2. **Plan left-panel drag: show a shared-border line for reorder drops,
   not a full-row outline.** Today (`TaskTreeNode.tsx`), any hovered drop
   target gets the same `outline outline-2 outline-accent` around the whole
   row, whether the eventual action (resolved at drop time by
   `resolveDropAction` in `lib/taskTree.ts`, via the `relativeY` third the
   pointer is over) will be a **reparent** (middle third) or a **reorder**
   (top/bottom third, i.e. "drop next to this row, as a sibling"). Change:
   when the pointer is over a row's outer third (a reorder), instead of
   outlining that row, draw a thin light-blue horizontal line at the
   boundary the hovered row shares with its neighbor in that direction (its
   previous sibling if hovering the top third, its next sibling if hovering
   the bottom third) — visually marking "it'll land here, between these
   two," not "onto this row." The middle-third reparent case keeps today's
   full-row outline unchanged. Requires tracking the pointer's live
   position/third during drag (not just at drop, which is all
   `resolveDropAction` needs today) so the line can render continuously as
   the drag moves. Scoped to the main Plan tree only, per the request's
   wording ("on the plan view left panel") — the separate Recurrent-tasks
   drag-and-drop (M48) is not in scope here.

3. **New Configuration button + dialog.** A new button in the shared nav
   bar (`App.tsx`), at the top-left — meaning before/left-of the existing
   Plan/Execute/Evaluate view tabs, which currently start flush at the left
   edge. Opens a new `ConfigDialog`-style modal. Empty for now, except for
   whatever item 4 below adds to it — no other settings exist yet.

4. **Idle-detection auto-stop for time tracking, configurable in the new
   dialog.** Inside the Configuration dialog: an on/off toggle (**off by
   default**, per the clarifying answer) and a configurable idle-timeout
   duration (a plain numeric input, e.g. minutes; exact default value when
   switched on is an implementation detail, not specified by the user).
   Persisted client-side (`localStorage`, matching the existing precedent in
   `lib/useParentDismissal.ts`/`lib/useResizableWidth.ts`) — this is a
   local/device preference, not backend state, and no other consumer needs
   it server-side.

   Behavior while the setting is on and a timer is actively running
   (`TimerControl.tsx`'s `active` state): track keyboard and mouse activity
   (keydown, mousedown, mousemove, wheel — any of these resets the idle
   clock). If no activity is seen for the configured duration, auto-stop the
   timer **without** marking the task done — equivalent to today's "No, stop
   the timer" branch of `StopTimerConfirmModal`, not the full 3-button
   confirm flow (there's no one necessarily there to click a confirmation).
   At the moment of auto-stop:
   - Play a short alert sound (a generated tone via the Web Audio API is
     sufficient — no audio asset file needed) so a user who's present but
     just not typing/clicking (on a call, reading, etc.) notices.
   - Turn the favicon red (item 5).
   - Show a dialog stating the timer was stopped due to inactivity, with one
     acknowledgement button at the bottom. Clicking it closes the dialog and
     reverts the favicon to normal (item 5) — this is the *only* thing that
     clears the red state.

   Assumption: idle tracking is per browser tab/page (the user is assumed to
   have one tab open, consistent with the project's existing single global
   active-timer assumption in Redis) — no cross-tab coordination is being
   built.

5. **Favicon reflects timer state: neutral / green-with-live-time / red.**
   Today `frontend/index.html` points at a single static `/favicon.svg`.
   New behavior, dynamically generating the favicon (e.g. drawing to an
   off-screen canvas and swapping the `<link rel="icon">` href to the
   resulting data URL):
   - **Neutral (today's icon):** no timer running, and no unacknowledged
     idle-auto-stop pending.
   - **Green, with live elapsed time:** a task is actively being tracked —
     render the current elapsed time (mirroring `TimerControl.tsx`'s
     `formatElapsed`/per-second tick) as small digits on a green background,
     updating every second while tracking continues.
   - **Red:** set the instant idle-detection auto-stops the timer (item 4);
     persists until the user dismisses that milestone's acknowledgement
     dialog, then reverts to neutral. A normal, manual "Stop" (not
     idle-triggered) goes straight back to neutral — red is exclusively the
     idle-auto-stop signal, never used for an ordinary stop.

## Notes for implementation planning

- Items 3, 4, and 5 are tightly coupled (config dialog holds the toggle that
  gates the idle-detector; the idle-detector's auto-stop is what the red
  favicon and the acknowledgement dialog both react to) — likely worth
  sequencing as adjacent milestones in that order: dialog shell (3) →
  idle-detection + auto-stop + acknowledgement dialog (4) → favicon states,
  wired to both tracking state and the item-4 events (5).
- Items 1 and 2 are independent of the config/favicon work and of each
  other — either can be picked up first.
- Item 2 needs a new way to observe live pointer position/third during an
  in-progress drag (today's `resolveDropAction` is only ever called once, at
  drop time) — check what dnd-kit exposes during `onDragMove` /
  `useDroppable`'s active-rect data before deciding the exact mechanism.
