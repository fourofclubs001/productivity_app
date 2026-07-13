# Interpreted App Improvements (v01)

Ordered restatement of `app_improvements_v01.md`, grouped by view, with the
ambiguous items resolved per your answers below each one. Two items in the
original file were questions rather than requests ("is there a pattern name for
this?", "what is that kind of window called?") — answered inline where they occur
instead of turned into work items.

## Plan view

### 1. "Add child task" button on the task detail view

Add a button to the leaf/parent task detail panel that creates a new child task
under the task currently being viewed (same creation flow/dialog as today, just
pre-filled with this task as the parent instead of requiring the user to trigger
creation from the tree root or drag-reparent afterward).

### 2. Color selection at task creation

The "new task" dialog currently only asks for name + definition of done (colors
can only be set afterward, from the detail panel's color swatches). Add the same
multi-select color-swatch picker to the creation dialog so colors can be set up
front.

### 3. Remove the description text area from the task detail view

Drop the free-text "description" field/textarea from the task detail panel
entirely (definition of done stays — only description goes).

### 4. Drag-and-drop reparenting in the left panel (VS Code–style)

VS Code lets you drop a file/folder onto another folder to move it inside.
Implement the equivalent here: dragging one task node in the left panel and
dropping it onto another task node makes the dropped task a child of the target
(same effect as the existing "add parent" mechanism, just via drag instead of a
form).

### 5. Drag a leaf task from the left panel onto the calendar to schedule it

**Supersedes the current "click a task in the panel to arm it, then drag on the
calendar" flow — that flow is being removed** (per your answer to the
clarifying question below). Going forward, the only way to schedule a task from
the panel is a real drag: press on the leaf task row in the left panel, drag it
onto the calendar, and drop it at the desired day/time. Dropping creates a
calendar interval starting at the dropped time with a default duration, and
opens that interval's detail (day/start/end — see item 13) so the exact time can
be fine-tuned immediately.

*Resolves: you rejected the "armed task" selection model outright — it's
removed from the app, not just relabeled. Actual drag-and-drop from the panel is
the sole replacement.*

### 6. "Add to calendar" button on the leaf task detail view

Add a button on a leaf task's detail view that opens a **time-entry modal** —
pick day, start hour, and end hour directly (typed/selected, not dragged) — and
creates the calendar interval from that input.

*Resolves: you explicitly asked for the modal option here, not an "armed
drag" or "auto-schedule next slot" behavior.*

### 7. Remove the "Drag on the calendar to schedule…" helper text

This text is tied to the "armed task" flow being removed in item 5, so it goes
away as a natural consequence — flagging it as its own line item anyway since
the original list called it out separately.

### 8. "Expected time" field + hours-covered indicator

- Add an editable **estimated hours** field, but **only on leaf tasks**. Parent
  tasks display a **read-only rollup**: the sum of their descendant leaf tasks'
  estimates.
- Next to the estimate, show **hours covered**: the sum of the durations of
  calendar intervals currently reserved for that task (leaf: its own intervals;
  parent: the sum across its leaf descendants' intervals). This lets you see at
  a glance "I estimated 6h for this goal, 3.5h of it is actually on the
  calendar so far."
- Assumption (not asked, flagging for the implementation plan): "covered" counts
  *all* currently-reserved intervals for the task regardless of which
  day/week they fall on — not scoped to "this week only" — since a task can have
  intervals spread across multiple future weeks. Revisit this if it turns out
  you want it scoped to the currently-viewed plan period instead.

*Resolves: you confirmed leaf-only estimates with parent rollup.*

### 9. Auto-remove a leaf task from Plan view when it reaches "sprint done"

When a leaf task's state transitions to `sprint_done`, remove it from the Plan
left-panel tree (it remains visible in Execute/Evaluate as already designed —
this only affects the Plan tree).

**Added detail:** a `sprint_done` task must also not be a selectable option in
the Execute view's timer (this was already true as of v00 item 4, which
excludes both `done` and `sprint_done` from the task picker — restating it here
since it's the direct Execute-side consequence of this item). Additionally,
**only leaf tasks are ever selectable** in the timer's task picker — parent/goal
tasks may appear in the picker's tree (per item 25, which now shows the full
panel-matching, expandable tree) for navigation/context, but clicking a parent
row does not start a timer against it, only its leaf descendants can be picked.
This detail is implemented in item 25 below; noted here too since you raised it
alongside item 9.

*Doubt to confirm: your note said "for 9," but the timer/dropdown mechanics
live in the Execute view (item 25) rather than this Plan-view item — I've
applied the change to both 9 (as a cross-reference) and 25 (as the actual
behavior). Let me know if you meant something different by "for 9."*

### 10. Confirm before removing a parent whose last child reaches "sprint done"

When the last remaining non-`sprint_done` child of a parent task transitions to
`sprint_done` (i.e. all of its children are now sprint-done), prompt the user:
should this parent also be removed from the Plan view? Only remove it if
confirmed; otherwise leave it in place (its children stay hidden per item 9,
but the parent itself stays visible until explicitly dismissed).

### 11. Google Calendar–style drag-to-move for already-scheduled tasks

Once a task has a calendar interval, let the user drag that existing event chip
to a different day/time on the Plan calendar to reschedule it, the same way
Google Calendar lets you drag an existing event around. (This is distinct from
item 5, which is about placing a *new* interval by dragging from the left
panel — this item is about moving an *existing* one.)

### 12. Clicking a scheduled task on the calendar opens its detail view

Clicking an event chip on the calendar opens that task's detail panel (same
panel used elsewhere in Plan).

### 13. Make the sprint schedule's time interval editable

In the interval/schedule detail view, day, start hour, and end hour should each
be directly editable fields (not just visual drag), so a reservation can be
corrected precisely.

### 14. Drag-and-drop reordering in the left panel

Allow dragging a task row up/down among its siblings in the left panel to
change their display order.

### 15. *("Is there a pattern name for the kind of interactions I'm describing?")*

Answered here rather than turned into a task: what you're describing across
items 4, 5, 11, and 14 is generally called **direct manipulation** — the broader
UI category where users act on visual representations of objects directly
(drag, drop, resize) instead of through forms/menus. The specific sub-pattern
for item 4 (dropping one tree node onto another to reparent it) is usually
called **drag-and-drop reparenting**, and it's the same mechanism VS Code's
Explorer, Trello/Asana cards, and Google Calendar's event dragging all use —
one interaction family, applied to three different surfaces (tree, list,
calendar) in this app.

### 16. Ctrl+Z undo

**Scope, per your answer:** undo covers (a) the new drag-based interactions
this pass introduces — calendar move (item 11) / resize (item 17) / drag-created
intervals (item 5), reparent-by-drag (item 4), and panel reorder-by-drag (item
14) — **and** (b) destructive actions — task delete, calendar-interval delete
(item 19), and the parent-removal confirmation (item 10). Plain field edits
(renaming, description, definition of done, color toggles) are **not** covered
by undo. Ctrl+Z steps backward through this combined action history one step at
a time.

**Added, per your follow-up:** (c) the `sprint_done` state transition made via
the "is the definition of done fulfilled?" modal (item 24) is also undoable.
Undoing it reverts the task's state from `sprint_done` back to `in_progress`
(the same state it would be in had "no" been chosen in that modal) — it does
**not** restart or resurrect the timer, since the timer entry itself was
already stopped/recorded independently the moment "Stop" was clicked (per v00
item 3), decoupled from the done/not-done decision.

*Assumption to confirm: I'm treating this as reverting the state only, not the
timer. Flag it if you actually want ctrl+z to also resume the timer.*

### 17. Click-and-drag to extend a task's time on the calendar

Dragging the bottom (or top) edge of a scheduled event resizes its duration —
same resize-by-edge-drag interaction Google Calendar uses. Works together with
item 11 (dragging the body moves it; dragging an edge resizes it).

### 18. Resizable side panels in Plan

The left tree panel and the detail panel should be draggable-wider/narrower via
a resize handle on their shared edge, rather than fixed width.

### 19. Right-click a calendar task to delete it

Right-clicking a scheduled event on the calendar shows a context menu with a
"Delete" option that removes that calendar interval.

### 20. Task prerequisites (scheduling dependency)

From a task's detail view, allow marking another task as a **requirement** for
it. Once set, the dependent task **cannot be scheduled** (no calendar interval
created — items 5/6 both blocked) until the required task reaches `done`.

This is a **hard block**, not just a warning — matching the literal wording
"can only be scheduled after the required one" (confirmed by the DAG's existing
hard-block precedent: reparenting already prevents cycles the same way).

**Per your follow-up:** prerequisites are modeled as a real **dependency
graph** in the backend (a task can require multiple other tasks; requirements
are directed edges, separate from the parent/child DAG edges), with **cycle
detection** run on every new requirement link — the same way reparenting
already has to guard against DAG cycles — rejecting a link that would make two
tasks mutually (directly or transitively) require each other. **No dedicated
graph-visualization UI is needed right now** — setting a requirement stays a
simple "pick a task" control on the detail view; the graph only needs to exist
under the hood to support the cycle check and the "is it satisfied yet"
scheduling gate.

### 21. Show the new task's detail view right after creation

After submitting the "new task" dialog, automatically open that task in the
detail panel (instead of leaving whatever was previously selected).

### 22. Expand the color palette

The palette currently has 8 fixed colors. Add more options to it (exact new set
to be picked during implementation — reasonable extension of the existing named
palette, not a free-form color picker, to stay consistent with how colors are
stored/rendered today).

### 23. Two-color pattern on calendar chips

When a task has exactly two colors assigned, render its calendar event chip
split diagonally between the two colors (assumption — not asked; a clean,
common way to show a dual-color chip without needing a legend). Tasks with one
color render solid as today; the display for 3+ colors isn't addressed by the
original list, so it'll fall back to the same two-color treatment using the
first two until/unless you want something else.

## Execute view

### 24. Replace "mark done?" with a "definition of done fulfilled?" confirmation

When the time tracker is stopped, instead of asking "mark as done?", show a
**modal** — *("what is the name of that kind of window?" — this is called a
modal, or modal dialog; same UI family as the existing "new sub-task" dialog)* —
asking "Is the definition of done fulfilled?" with that task's existing
`definition_of_done` text (already a required field on every task — no new data
model needed) displayed next to the question for reference.

Choosing "yes" transitions the task to `sprint_done`; that specific transition
is now part of the ctrl+z undo history — see item 16.

### 25. Task-selection dropdown: panel order + expand/collapse

The Execute view's task-selection dropdown should list tasks in the same order
as the Plan left panel (not whatever default ordering it uses today), and
support the same expand/collapse-to-show/hide-subtasks behavior as the Plan
tree.

**Added detail (raised alongside item 9):** parent/goal task rows may appear in
this tree for navigation (expanding to reveal their children), but are **not
selectable** — only leaf tasks can actually be picked to start a timer against.
`sprint_done` (and `done`) leaf tasks continue to be excluded from selection
entirely, consistent with v00 item 4, now re-verified under the new
tree-shaped dropdown rather than the old flat list.

## Evaluate view

### 26. Task list ordering matches the Plan left panel

### 27. Completed root tasks sink to the bottom of the Metrics subtab

When a root (top-level) task reaches `done` and disappears from the Plan left
panel, it should still appear in the Evaluate Metrics subtab's task list/table —
just moved to the bottom, below the still-active tasks.

### 28. Same expand/collapse behavior as the Plan left panel

The Evaluate task list should support expanding/collapsing to show/hide
subtasks, mirroring the Plan tree.

### 29. Task filter gets the same ordering + expand/collapse

The existing "filter by task" multi-select (added in v00) should use the same
panel-matching order and expand/collapse behavior as items 26/28.

*(Items 26–29 are one consistent piece of work: make every place Evaluate lists
tasks — the main table and the filter picker — mirror the Plan panel's
ordering and tree-expand behavior, with the one addition in 27 for
already-completed root tasks.)*

## Development workflow

### 30. Separate development and production environments

**Per your answer:** this doesn't need CI/CD or a deploy pipeline right now —
just data isolation so day-to-day development doesn't touch your real task
data. Plan:

- Split the current single `docker-compose.yml` into two: `docker-compose.yml`
  (prod — what you use day to day, keeps your real data) and
  `docker-compose.dev.yml` (dev — what gets used while building new features).
- The dev compose file points at its own isolated Redis (separate container/
  volume/port, or a separate Redis logical DB number — implementation detail to
  settle in planning) so nothing dev touches can ever collide with prod data,
  and both can run side by side if needed (different host ports).
- "Getting new features onto prod" is just: stop the prod containers, pull/build
  the updated code, and start the prod compose file again — no separate
  deploy step, since prod is the same docker-compose setup you already run
  locally today, just rebuilt from newer code.
- This does answer your question directly: yes, a dev/prod docker-compose split
  works for what you described — it's a data-isolation mechanism, not a
  full deploy pipeline, which matches what you said you actually wanted.

## Notes on scope

A few items above (9, 10, 20, 23) touch the same underlying idea — tasks
disappearing or becoming unschedulable based on state/dependencies — and will
probably be designed together as one small piece of "task lifecycle" logic
rather than three unrelated features, since they share the same state-transition
plumbing.
