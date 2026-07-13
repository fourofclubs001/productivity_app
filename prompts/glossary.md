# Glossary

Shared vocabulary for describing this app's UI and technical design, so the
`prompts/` docs and future conversations use consistent terms. Organized into
UI/interaction vocabulary and domain/technical vocabulary. Add to this file as
new terms come up rather than re-explaining them inline in each prompt doc.

## UI / interaction vocabulary

- **Direct manipulation** — the general UI category where the user acts on the
  visual representation of an object directly (drag, drop, resize) instead of
  through a form or menu. A core interaction principle of this app — see
  `interpreted_app_description.md` §1.1. Drag-and-drop reparenting, calendar
  drag-to-move/resize, panel drag-to-reorder, and panel drag-to-resize are all
  instances of it.
- **Drag-and-drop** — pressing on an element, moving it while held, and
  releasing it onto a target to perform an action. The umbrella mechanism under
  direct manipulation.
- **Drag-and-drop reparenting** — the specific drag-and-drop pattern of
  dropping one tree node onto another to make it a child of the target. Same
  mechanism as VS Code's Explorer (drag a file into a folder). Used in the Plan
  view's left panel to restructure the task DAG.
- **Armed selection / "armed task"** *(removed pattern — historical note)* —
  the earlier flow where clicking a task in the left panel made it the
  "active"/armed task, which the user then dragged onto blank calendar space to
  schedule. Rejected during the v01 pass in favor of dragging the task node
  itself directly onto the calendar. Documented here so future reads of
  earlier commits/specs recognize the term if they see it.
- **Modal / dialog** — a window that opens on top of the app and blocks
  interaction with the rest of the UI until dismissed (e.g. the "new task"
  dialog, the "is the definition of done fulfilled?" dialog). "Modal" and
  "dialog" are used interchangeably in these docs.
- **Context menu** — the menu that appears on right-click, offering
  actions scoped to the element that was clicked (e.g. right-click a calendar
  event → "Delete").
- **Chip / event chip** — the small colored block representing a scheduled
  task on a calendar view (Plan/Execute/Evaluate), styled like a Google
  Calendar event.
- **Rollup** — a read-only value on a parent/goal task computed by aggregating
  the same value across its descendant leaf tasks (e.g. an estimated-hours
  rollup = sum of leaf descendants' estimates). Contrast with a value that's
  independently editable per task.
- **Panel** — a fixed region of the Plan view's layout: the **left panel**
  (the DAG tree) and the **detail panel** (the selected task's details).
- **Subtab** — a secondary tab nested within a top-level view (e.g. Evaluate's
  **Calendar** and **Metrics** subtabs).
- **Resize handle** — a draggable edge/border between two UI regions (e.g.
  between the left panel and detail panel) that lets the user resize them.

## Domain / technical vocabulary

- **DAG (directed acyclic graph)** — the data structure tasks are organized
  as, instead of a strict tree: a task may have multiple parents, but cycles
  (a task being its own ancestor) are never allowed. See
  `interpreted_app_description.md` §2.1.
- **Leaf task** — an actual, executable task (as opposed to a node/goal). Only
  leaves can be scheduled on the calendar, tracked with the timer, or reach
  the `sprint_done`/`done` states directly.
- **Node task / goal task / parent task** — a higher-order task completed
  indirectly, by completing the leaves/sub-nodes beneath it in the DAG. Its
  state and any rollup values (e.g. estimated hours) are derived from its
  descendants, never set directly.
- **Cycle detection** — the backend check that rejects a new DAG edge (a
  reparent link, or a prerequisite link — see below) if it would create a
  cycle, i.e. make some task its own ancestor. Applies separately to the
  parent/child DAG and to the prerequisite dependency graph.
- **Dependency graph / prerequisite / requirement** — a *separate* set of
  directed edges from the parent/child DAG: task A can be marked as required
  by task B, meaning B cannot be scheduled until A reaches `done`. Modeled in
  the backend with its own cycle detection; no dedicated graph-visualization UI
  (setting a requirement is a simple "pick a task" control).
- **Lifecycle states** — the states a leaf task moves through:
  `backlog` → `sprint_backlog` → `in_progress` → `sprint_done` → `done`. See
  `interpreted_app_description.md` §2.3 for the full transition rules,
  including end-of-week rollover.
- **Sprint** — this app's term for "the current week's planned work"; not a
  fixed-length agile sprint construct beyond the Monday-start week boundary
  already defined in §2.3.
- **Calendar interval / reservation** — a concrete block of time (day + start
  hour + end hour) reserved on the Plan calendar for a leaf task. A task can
  have multiple intervals, including across different future weeks.
- **Palette / colors vs. effective colors** — tasks pick from a fixed preset
  color palette. `colors` is what's explicitly set on a task; `effective_colors`
  is what's actually shown after inheritance (a task with no colors of its own
  inherits its parent's).
- **Rollover** — the end-of-week process that transitions tasks planned for
  the week that just ended: `sprint_done` → `done`, `in_progress` → `backlog`,
  unscheduled `sprint_backlog` → `backlog`.
- **Timer / time entry** — the Execute view's stopwatch mechanism; starting it
  sets a task's state to `in_progress`. A time entry is the recorded
  start/stop record produced by one timer run.
- **Definition of done (DoD)** — required free text set when a task is
  created, describing what "done" means for that task; shown when stopping the
  timer to help decide whether to mark the task `sprint_done`.
- **Undo history / action history** — the ordered list of undoable actions
  ctrl+z steps backward through. Scope for this app (as of v01): drag-based
  interactions (reparent, reorder, calendar move/resize/create), destructive
  actions (delete, parent-removal), and the `sprint_done` transition made via
  the DoD-fulfilled modal. Plain field edits are not included.
- **Redis** — the app's sole persistent data store (not just a cache) for this
  stage; no separate relational DB.
- **FastAPI** — the Python backend framework.
- **docker-compose (dev / prod split)** — as of the v01 pass, the single
  compose file is split into a prod file (real data, what's used day to day)
  and a dev file (isolated Redis data for building new features without
  touching real data). See `interpreted_app_improvements_v01.md` item 30.
