# Interpreted App Description

## 1. Overview

A personal web app for planning, executing, and evaluating daily/weekly tasks.

- **Frontend:** React
- **Backend:** Python
- **Database:** Redis
- **Scope (first stage):** Single user only — no user management/auth needed.

The app has three top-level views: **Plan**, **Execute**, **Evaluate**.

---

## 2. Task Model (shared across all views)

### 2.1 Structure

- Tasks are organized as a **DAG** (directed acyclic graph), not a strict tree.
  - **Leaves** = actual, executable tasks.
  - **Nodes** = higher-order goals, completed indirectly by completing the leaves/sub-nodes beneath them.
  - Because it's a DAG (not a tree), a single task can have **multiple parents**.

### 2.2 Colors

- Any task can be assigned one or more colors, chosen from a **fixed preset palette** (a small curated set of swatches, similar to Google Calendar's event colors).
- Colors are inherited down the sub-DAG from parent to children.
- A task with its own assigned color(s) overrides the inherited color(s) from its parent(s).

### 2.3 Lifecycle states

Leaf tasks move through these states:

1. **Backlog** — default state when a task is created.
2. **Sprint backlog** — set when the user clicks "add to sprint" on a leaf task; requires reserving at least one concrete time interval on the calendar (multiple intervals allowed).
3. **In progress** — set when a timer is started against the task (Execute view).
4. **Sprint done** — set when the user stops the timer and chooses to mark the task as done.
   - If the user stops the timer without marking it done, the task remains **in progress**.
5. **Done** — set at the end of the week for any task that was **sprint done**.

**End-of-week rollover rules:**

These rules apply only to tasks that were **planned for the week that just ended** (i.e., their reserved time interval fell within that week). Tasks scheduled for a future week are left untouched until their own week ends.

- `sprint done` → `done`
- `in progress` → `backlog`
- `sprint backlog` (scheduled but never started) → `backlog`

The week starts on **Monday**.

**Node task states** are derived automatically from their descendants (leaves and sub-nodes), not set manually:
- `backlog` — all descendants are `backlog` or `sprint backlog`.
- `in progress` — at least one descendant is `in progress`, `sprint done`, or `done`.
- `done` — all descendants are `done`.

### 2.4 Task fields

- **Name** — required to create a task; shown in the tree, like a file/directory name in VS Code.
- **Description** — free text, visible when opening a leaf task.
- **Definition of done** — required to create a task; visible when opening a leaf task.

### 2.5 Editing operations (v1 scope)

Beyond creating a task, the following operations are in scope for v1:

- **Rename / edit** — change a task's name, description, and definition of done after creation.
- **Delete** — remove a task from the DAG.
- **Reparent** — add or remove parent links for a task (attach/detach it from additional parent nodes), since the structure is a DAG.
- **Un-schedule** — manually pull a task back from `sprint backlog` to `backlog`, removing its reserved calendar interval(s).

---

## 3. Plan View

Purpose: plan the tasks to be worked on during the following week.

### 3.1 Left panel — DAG tree

- Presented like the VS Code file explorer: top-level (highest-order) tasks are shown collapsed, and can be expanded to reveal their immediate children.
- Unlike a file tree, a task (node or leaf) may appear under more than one parent, since the underlying structure is a DAG.
- A new task is created the same way a new file is created in VS Code (the "+ file"-style button at the top of the panel).

### 3.2 Task detail panel

- Clicking a leaf task opens its description and definition of done, similar to opening a file in VS Code.
- A leaf task's detail panel has an **"add to sprint"** button in the bottom right.
  - Clicking it moves the task to **sprint backlog** state.
  - The user must then reserve one or more concrete time intervals on the calendar for that task.

### 3.3 Calendar (sprint scheduling)

- Opens as a window showing a Google Calendar–style week view.
- The user can navigate forward to **any future week** (not limited to just the following week) and reserve a time interval there.
- Used to reserve the time interval(s) for tasks added to the sprint. A task can have intervals reserved in multiple different future weeks.

---

## 4. Execute View

Purpose: register time actually spent on a task while it happens (Toggl-style).

### 4.1 Timer

- A stopwatch/timer can be started against a selected task.
- Only **one timer can be active at a time** — starting a new one implies stopping any currently running timer.
- Starting the timer sets the task's state to **in progress**.
- Stopping the timer prompts the user to choose:
  - **Mark as done** → task state becomes **sprint done**.
  - **Don't mark as done** → task remains **in progress**.

### 4.2 Calendar display

- Google Calendar–style week view, split by time:
  - For time already elapsed: shows the **actually registered** task executions.
  - For time not yet elapsed: shows the **planned** tasks (from the Plan view's reserved intervals).

---

## 5. Evaluate View

Purpose: evaluate and improve the user's planning skills by comparing plan vs. reality.

### 5.1 Calendar comparison

Google Calendar–style views for:
- The **planned** week.
- The **real** (actually executed) week.
- A **diff** between the two.

### 5.2 Statistics

- **Hours:** executed vs. planned, in absolute hours and as a percentage (executed / planned).
  - For the whole week.
  - Per task (both leaves and nodes).
- **Task counts:** number of tasks finished vs. not finished.
  - For the whole week.
  - Per task (both leaves and nodes).

---

## 6. Integrations

### 6.1 Google Calendar (two-way sync) — deferred to a later phase

- **Not part of the first version.** The core Plan / Execute / Evaluate workflow will be built and working first, using the app's own calendar views only.
- Once the core workflow is solid, this will be added:
  - When a time interval is reserved for a task in the Plan view calendar, it is pushed to the user's Google Calendar.
  - Conversely, changes made directly in Google Calendar (move/edit/delete of the corresponding event) sync back and update the task's reserved interval(s) in the app.
  - Requires setting up OAuth credentials in a Google Cloud project.

---

## 7. Deployment

- **Local only** for this first stage — the app runs on the user's own machine (e.g. via docker-compose), accessed at `localhost`.
- No hosting, HTTPS, or public domain needed at this stage.

---

## 8. Notes / Assumptions

- "Adding to sprint" and calendar reservation are assumed to apply to **leaf tasks only**, since nodes represent aggregate goals rather than schedulable work.
- Timezone isn't specified yet — assumed to default to the user's local timezone.
- Redis is assumed to be the **sole persistent data store** (not just a cache) for this first stage, given no other DB is mentioned.
- Confirmed: the week starts on **Monday**.
- Confirmed: time intervals can be reserved for any future week, not just the immediately following one; end-of-week rollover only affects tasks planned within the week that just ended.
- Confirmed: task colors come from a fixed preset palette.
- Confirmed: v1 includes rename/edit, delete, reparent, and un-schedule operations on tasks.
- Confirmed: app runs locally only for this stage; Google Calendar sync is deferred to a later phase.
