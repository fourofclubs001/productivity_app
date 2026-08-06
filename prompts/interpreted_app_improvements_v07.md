# v07 improvements — interpreted

Ordered restatement of `prompts/app_improvements_v07.md`, clarified per the
answers below. Each item below will likely become its own milestone (M57+),
per the project's usual one-milestone-per-improvement workflow.

Items 1 and 7 in the original list describe the same bug (confirmed with the
user) and are merged below. Four items in the source file were literal
diagnostic questions ("why is this happening?") rather than just ambiguous
wording — those were root-caused against the actual code *before* this
document was written (not deferred to implementation time), per the
workflow's updated step 2, and the diagnosis is recorded inline below.

## Clarifying answers on record

- **Items 1/7 (done leaf task still visible in Plan) — root cause confirmed:**
  `frontend/src/lib/taskTree.ts`'s `isHiddenFromPlan` only hides a leaf when
  `state === 'sprint_done'`. `backend/app/services/rollover_service.py`'s
  weekly job later flips `sprint_done → done` once the task's interval week
  has elapsed — at which point the hide check no longer matches and the task
  reappears. Confirmed as the cause of "depositar plata alquiler" resurfacing
  in prod. Fix: hide on both `sprint_done` and `done`.
- **Item 2 (favicon) — scope narrowed:** keep today's (M52) green-while-
  tracking / neutral-otherwise icon color as-is. Move the live mm:ss digits
  **out of the favicon graphic and into the browser tab title text** instead
  (e.g. `12:34 · Productivity App`), rather than drawing them onto the icon.
  The favicon's **red** state is dropped entirely as a consequence of item 3
  below (idle-detection removal) — there's nothing left to trigger it, so the
  favicon only ever needs neutral or green.
- **Item 3 (timer stopping despite activity) — root cause confirmed, and
  the feature is being removed, not fixed:** idle-detection (M51) resets its
  timeout on `window`-scoped `keydown`/`mousedown`/`mousemove`/`wheel`
  listeners, which only fire for the document that currently has OS focus.
  Working in a different window/tab while this app's tab sits in the
  background produces zero such events, so the timer still auto-stops even
  though the user is actively at the keyboard elsewhere — confirmed by the
  user as what happened. Decision: **remove idle-detection auto-stop
  entirely** (M51 + M52's red-state linkage) rather than try to fix it,
  since it can't see true OS-wide activity without native OS integration a
  web app doesn't have. Removed: the idle timeout listener/auto-stop logic
  in `GlobalTimerWatcher.tsx`, the alert tone (`playAlertTone.ts`), the
  acknowledgement dialog, and the Configuration dialog's on/off toggle +
  timeout-minutes input (`idleDetectionSettings.ts`,
  `useIdleDetectionSettings.ts`). **Kept:** the Configuration button/dialog
  shell itself (`ConfigButton.tsx`/`ConfigDialog.tsx`) — it becomes empty for
  now, ready for whatever setting comes next, rather than being torn out too.
- **Item 4 (add existing task as child):** **reparent (move)**, not a
  multi-parent link — the existing task detaches from its current parent(s)
  and attaches under the new parent, same single-tree-position model the app
  already has everywhere else. Existing cycle-prevention
  (`CycleError`/`is_reachable`) applies unchanged, same as any other
  reparent.
- **Item 5 (clicking a Google event):** a **read-only info panel** — reuse
  the existing detail-panel area to show the event's title/time/description,
  no editable fields, no link-out required (not requested).
- **Item 6 (delete-with-children dialog):** picking "just this task"
  **reparents its children up** to the deleted task's own parent(s) (or
  makes them roots if it had none) — mirrors the existing recurrent-group
  "ungroup" pattern from M47's `GroupDeleteDialog`. The other option cascades
  the delete through the whole subtree, same as today's plain delete.
- **Item 9 (cascade mark-done scope):** marking a task with children as done
  marks **every leaf in its subtree** done (the existing sprint-done
  transition, reused per-leaf); non-leaf/goal nodes are never written to
  directly — their displayed state stays live-computed exactly as it already
  works today. Must be undoable via Ctrl+Z, consistent with every other
  mutating action in the app.
- **Item 10 (recurrent task only scheduled through Sept 1 despite a December
  end date) — root cause confirmed, and it's by design, not a bug, but the
  design is changing:** `backend/app/services/recurrent_task_service.py`'s
  `GENERATION_WINDOW_DAYS = 28` means occurrences are generated lazily, only
  28 days ahead of whenever `ensure_applied()` last ran — regardless of how
  far out the rule's own end condition is. From today (2026-08-06), 28 days
  lands right around September 1-3, matching exactly what the user saw; nothing
  was stalled, it just hadn't caught up yet (flagged as a UX gap once before,
  in M43). **New behavior, per discussion:**
  - A recurrent task with a **bounded** end condition (a specific end date, or
    after N occurrences) generates **all** its occurrences up front at
    creation time — no more 28-day cap for these.
  - A recurrent task that **never ends** has no natural stopping point to
    generate up front, so it keeps lazy rolling-window generation — but the
    window is extended from 28 days to **365 days (1 year)**.
- **Item 11 (done goal tasks visible in Execute's picker) — root cause
  confirmed:** `frontend/src/components/timer/TaskPicker.tsx`'s default
  `isHidden` only checks `task.is_leaf && state in {sprint_done, done}` — a
  non-leaf (goal) task is never evaluated at all, so a goal whose rolled-up
  state has reached `'done'` (every leaf descendant done) still shows. Fix:
  broaden the hide check to apply to any task, leaf or goal, whose state is
  finished. Since a goal's computed state only reaches `'done'` once *every*
  descendant leaf is done, this automatically keeps ancestors of any
  not-yet-finished descendant visible — no extra ancestor-walk logic needed.
  **Scope: main task tree only.** Recurrent tasks/groups stay excluded from
  this picker exactly as today (M53's deliberate design, unrelated to this
  fix); Evaluate's `TaskFilter` is untouched — it intentionally shows done
  tasks for historical period filtering, a different purpose than "pick a
  task to start tracking."
- **Item 12 (auto-start on boot):** the **prod** stack (`docker-compose.yml`,
  ports 8000/5173), started via Docker on Windows login, followed by
  auto-opening the frontend URL in the default browser. This is a local
  Windows machine setup task (Task Scheduler / Startup folder), not an
  application code change.
- **Item 13 (colored circles everywhere):** applies broadly — every place a
  task name renders in a list gets the same colored-circle indicator the
  Plan left panel already shows: Execute's `TaskPicker`, Evaluate's
  `TaskFilter` (both Metrics and Excuses), the Requires dropdown, and the
  Recurrent tasks list.
- **Item 8 (ghost drop-preview not working on Plan calendar drag):** a video
  reproduction is at `prompts/references/bug_moving_tasks_on_plan_calendar.mp4`.
  Root-causing this is left for the implementation milestone, not resolved
  here — the fix will need to check why M17's drop-preview ghost chip isn't
  rendering (or resolving) for the reported drag interaction, using the video
  as the reproduction case.

## Ordered items

1. **Leaf tasks stay hidden from the Plan tree after rolling over from
   `sprint_done` to `done`.** `isHiddenFromPlan` (`lib/taskTree.ts`) treats
   `sprint_done` and `done` identically for a leaf — both mean "finished,
   hide from Plan." One-line fix, confirmed root cause above. Covers both
   original item 1 (the "depositar plata alquiler" report) and item 7 (the
   general symptom).

2. **Favicon: live timer moves from the icon into the tab title text; red
   state is dropped.** While tracking, the document title shows the live
   elapsed mm:ss (updating on the same per-second tick `GlobalTimerWatcher`
   already runs) alongside the app name; the favicon icon itself keeps its
   existing green-while-tracking / neutral-otherwise color swap from M52,
   just without digits drawn onto it. No red state — see item 3's removal
   below for why.

3. **Remove idle-detection auto-stop (M51) entirely; keep the Configuration
   dialog as an empty shell.** Delete: the idle timeout listener/auto-stop
   logic in `GlobalTimerWatcher.tsx`, `lib/playAlertTone.ts`'s call site and
   the alert tone itself, the acknowledgement `AlertDialog`, and
   `idleDetectionSettings.ts`/`useIdleDetectionSettings.ts` plus the
   Configuration dialog's toggle/timeout-minutes controls that write to them.
   `ConfigButton.tsx`/`ConfigDialog.tsx` stay in the nav, dialog body now
   empty, ready for a future setting.

4. **"+ Child task" can attach an existing task, not just create a new
   one.** New affordance alongside the existing create-new-child flow (likely
   a small chooser, similar in spirit to M49's `NewEventChooserDialog`) that
   opens a task picker (reusing `TaskPicker`'s indented-tree presentation,
   per M26's precedent for the Requires dropdown) to select any existing
   task and reparent it here. Existing cycle-prevention applies unchanged.

5. **Clicking a pulled-in Google Calendar event shows it in a read-only
   detail panel.** Google events on Plan/Execute (`isExternal: true`, from
   M40) currently have no click handler wired to open anything. New: clicking
   one opens a read-only panel (reusing the existing detail-panel area/shell)
   showing the event's title, start/end time, and description — no editable
   fields, since these events aren't owned by this app.

6. **Deleting a task with children asks "just this task" vs. "whole
   subtree."** New confirm dialog (mirrors M47's `GroupDeleteDialog`'s
   Cancel/two-destructive-choices shape) on the Plan left panel's delete
   paths (kebab menu, right-click). "Just this task" deletes the one task and
   reparents its children up to its own parent(s) (or makes them roots if it
   had none). "Whole subtree" cascades the delete through all descendants,
   matching today's existing behavior.

7. *(merged into item 1 above.)*

8. **Plan calendar drag-to-schedule ghost/drop-preview isn't showing.**
   Regression or gap against M17's live drop-preview ghost chip. Root-cause
   during implementation using the video at
   `prompts/references/bug_moving_tasks_on_plan_calendar.mp4` as the
   reproduction case.

9. **Right-click "mark as done" on a Plan left-panel task, cascading through
   its subtree, undoable.** New context-menu item (`ContextMenu.tsx`,
   alongside the existing right-click "Delete") that marks every leaf
   descendant of the clicked task done (a no-op subtree walk of one leaf if
   the clicked task is itself a leaf). Reuses the existing
   `lib/taskDoneUndoEntries.ts` mark/revert-done undo-entry logic, extended
   to cover marking multiple leaves as a single undoable action (one Ctrl+Z
   reverts the whole cascade, not leaf-by-leaf).

10. **Recurrent task generation: full up-front generation for bounded end
    conditions; 1-year rolling window (was 28 days) for never-ending rules.**
    `RecurrentTaskService`/`occurrence_dates()` gains a branch: if the
    recurrence's `end_type` is `on_date` or `after_n_occurrences`, generate
    every occurrence through that bound at creation time, no window cap. If
    `end_type` is `never`, keep the existing lazy catch-up-on-read mechanism
    (confirmed correct across multiple calls back in M43), just with
    `GENERATION_WINDOW_DAYS` raised from 28 to 365.

11. **Execute's `TaskPicker` hides fully-done goal tasks too, not just done
    leaves.** Broaden the default `isHidden` predicate (currently
    leaf-only) to also hide a non-leaf task once its rolled-up state reaches
    `'done'` — ancestors of any not-yet-finished descendant stay visible
    automatically, since their computed state won't be `'done'` while any
    descendant leaf remains unfinished. Scoped to the main tree only;
    recurrent tasks/groups and Evaluate's `TaskFilter` are unaffected.

12. **Auto-start the prod Docker stack and open the site on Windows login.**
    Local machine setup (not app code): a Windows Task Scheduler entry (or
    Startup-folder script) that runs `docker compose up -d` against the prod
    stack (`docker-compose.yml`, ports 8000/5173) on login, then opens
    `http://localhost:5173` in the default browser once it's reachable.

13. **Colored task-circle indicator everywhere a task name is listed.**
    Extend the Plan left panel's existing colored-circle rendering (reusing
    `effective_colors`/whatever component already draws it there) to:
    `TaskPicker` (Execute), `TaskFilter` (Evaluate Metrics + Excuses), the
    Requires dropdown, and `RecurrentTasksList`.

## Notes for implementation planning

- Items 1 and 11 are both instances of the same category of bug (a "hide
  when finished" predicate that doesn't cover every state/shape it should)
  and touch unrelated files — fine to sequence independently, but worth
  implementing back-to-back since the fix pattern is identical.
- Items 2 and 3 are coupled: item 3 removes idle-detection's red favicon
  trigger, which item 2 already assumes is gone. Sequence 3 before (or
  together with) 2, not after — otherwise item 2 would briefly need to keep
  red-state plumbing it's about to lose.
- Item 3 is a net removal, not a new build — expect this milestone to mostly
  delete code and its tests (idle-detection Playwright specs, `playAlertTone`
  unit tests, `GlobalTimerWatcher`'s idle-effect tests) rather than add any.
- Item 13 touches four+ components with the same change — likely worth
  extracting whatever the Plan left panel uses for its colored circle into a
  small shared component/helper first, rather than duplicating the render
  logic four times.
- Item 12 has no automated test coverage possible (it's outside the
  app/repo, a Windows startup configuration) — verification will be manual
  (reboot and confirm), not a Playwright spec.
- Item 10's "generate everything up front for a bounded rule" means a lot of
  Google Calendar sync calls could fire synchronously in one request if
  connected (each occurrence's `create_interval` triggers a best-effort push,
  per M37) — e.g. ~140 sequential calls for a daily rule running to December.
  **Decision: synchronous is fine** — generate and sync inline during
  creation even if it takes a few extra seconds for a long bounded range; no
  background job/async infrastructure is being introduced for this.
