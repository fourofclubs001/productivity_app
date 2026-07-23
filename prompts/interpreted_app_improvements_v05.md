# v05 improvements — interpreted

Ordered restatement of `prompts/app_improvements_v05.md`, clarified per the
answers below. Each item below will likely become its own milestone (M41+),
per the project's usual one-milestone-per-improvement workflow.

## Clarifying answers on record

- **Item 5 (routine → recurrent task rename):** full rename across code *and*
  frontend, **with a one-time data migration** — the user has real routines
  in prod (deployed 2026-07-23) that must survive the rename. The migration
  needs to move/rename: the `is_routine` task hash field, the
  `routine_anchor_date`/`routine_start_time`/`routine_duration_minutes`/
  `routine_generated_until` fields (whatever they're renamed to), the
  `routines:all` Redis set key, and the `/routines` API route — plus every
  internal identifier (`RoutineService`, `RoutineCreate`, `ROUTINES_KEY`,
  `NewRoutineDialog.tsx`, etc.) get renamed to the "recurrent task"
  vocabulary. Run the migration once against prod's real Redis data as part
  of shipping this milestone (in addition to whatever the dev/test fixtures
  need).
- **Item 7 (routine/recurrent-task groups, delete behavior):** deleting a
  group with children must **prompt** — a dialog asking whether to delete
  the child recurrent tasks/subgroups too, or ungroup them (move children
  back up a level) instead. Not a silent default either way.
- **Item 9 (drag-to-create on Plan calendar):** after the ghost-preview drag
  finishes, the user must be able to choose **either** create a new task
  (recurring or not) **or** pick an existing not-yet-scheduled task to drop
  into that slot — not just always-create-new.
- **Item 9, non-recurring quick-create fields:** when the "create new"
  branch is non-recurring, the dialog only asks for name + definition of
  done (same minimal shape as recurring-task creation) — no parent/goal
  picker. Always a root-level leaf task; reparent later via the tree if
  needed.

## Ordered items

1. **Timer stop confirmation gets a third option.** Currently (`TimerControl.
   tsx`) clicking "Stop" immediately stops the timer, *then* shows
   `DoneConfirmModal` with two choices ("No, keep in progress" / "Yes,
   done") — there's no way to back out without the timer already having
   stopped. Rework so clicking "Stop" opens the confirmation dialog **before**
   stopping anything, with three options:
   - **Yes** — mark the task done and stop the timer (today's "Yes, done").
   - **No, stop the timer** — stop the timer, don't mark done (today's "No,
     keep in progress", but the timer *does* still stop — today it already
     had stopped by this point, so behavior is unchanged here, just the
     wording/timing moves).
   - **Cancel** — do nothing; the timer keeps running, dialog closes.
   Assumption: this is the only reading under which "cancel" is meaningful,
   since today the timer is already stopped by the time any dialog appears.

2. **Bug: biweekly (or any interval>1) weekly recurrence stops generating
   after ~2 occurrences.** Reported repro: "every 2 weeks on Friday until
   Dec 31" only ever produces the current Friday and the next corresponding
   Friday — no further occurrences appear even as real time passes well
   past the 28-day rolling generation window (`RoutineService.
   _generate_occurrences`, `GENERATION_WINDOW_DAYS = 28`). Static read of
   `occurrence_dates()` and the `routine_generated_until` bookkeeping didn't
   turn up an obvious math error — the phase-locked-to-anchor walk looks
   correct in isolation, and `apply_routine_catchup` is wired as a
   dependency on `/tasks`, `/intervals`, and `/routines` so it should be
   re-invoked (and the window re-extended) on ordinary app usage. Needs
   **live reproduction** during implementation (create exactly this
   recurrence rule against the dev stack, then advance time / make repeated
   requests and watch `routine_generated_until` and generated intervals) to
   actually root-cause — candidates to check: whether `week_index % interval`
   phase-locking drifts once `_generate_occurrences` is called across
   multiple separate invocations rather than one continuous walk, or whether
   something *else* is silently swallowing occurrences past the second one
   (the `except (PastIntervalError, TaskNotLeafError,
   UnmetPrerequisiteError): continue` in the generation loop is a plausible
   place something unexpected is being caught and dropped).

3. **Bug: deleting a task doesn't clean up Google Calendar for its pruned
   future intervals.** Root-caused: `routers/tasks.py`'s `delete_task`
   endpoint prunes a deleted task's not-yet-started intervals directly via
   `interval_repo.delete(interval["id"])` (the raw repository method) —
   this bypasses `IntervalService.delete_interval()`, which is the method
   that actually does the best-effort Google event deletion (confirmed:
   deleting an interval *directly*, e.g. via the calendar chip's right-click
   "Delete", already correctly syncs to Google). Fix: route the task-delete
   cascade through `IntervalService.delete_interval()` (or otherwise fold in
   the same Google-delete call) instead of the bare repository delete, so a
   task's orphaned Google events don't get left behind.

4. **Recurrence interval number input: allow clearing and retyping.**
   `RecurrenceRuleFields.tsx`'s "Repeat every" input
   (`Math.max(1, Number(event.target.value) || 1)`) snaps back to `1`
   immediately if the field is ever emptied mid-edit, which makes it
   impossible to clear "1" and type e.g. "3" by first backspacing — the
   value jumps to 1 on every keystroke that transiently empties the field.
   Allow an empty/in-progress string as transient local state, only
   coercing to a valid integer ≥ 1 on blur/submit.

5. **Rename "routine" → "recurrent task" throughout code and UI**, per the
   clarifying answer above (full rename + prod data migration). Includes
   at minimum: `RoutineService` → e.g. `RecurrentTaskService`,
   `RoutineCreate` → `RecurrentTaskCreate`, `is_routine` →
   `is_recurrent_task`, `routines:all` Redis key → `recurrent_tasks:all`,
   `POST /routines` → `POST /recurrent-tasks` (and any other `/routines`
   routes), `NewRoutineDialog.tsx` → `NewRecurrentTaskDialog.tsx`,
   `RoutinesList.tsx` → `RecurrentTasksList.tsx`, the "Routines" tab label →
   "Recurrent tasks" (or similar), plus every test file, fixture, and
   comment referencing "routine". A migration script/step renames the
   existing prod Redis data (task hash field + set key) in place rather
   than discarding it.

6. **Add a "Today" button to calendar week navigation**, next to the
   existing "← Prev" / "Next →" buttons, on all three calendars that share
   this pattern (`PlanCalendar.tsx`, `ExecuteCalendar.tsx`, and
   `EvaluateView.tsx`'s calendar nav — all three already use
   `shiftWeek`/`weekStartKey` from `lib/week.ts`). Clicking it jumps straight
   to the week containing "now" (`utcNow()`), regardless of how far the user
   has navigated away. Assumption: applies uniformly to all three, since the
   request says "at the calendars" (plural) and all three already share the
   same nav component/pattern.

7. **Recurrent-task groups, for organization.** On the Routines (soon
   "Recurrent tasks") tab, the "+" button opens a dialog to choose:
   - **Recurrent task** — today's existing `NewRoutineDialog` flow
     unchanged.
   - **Recurrent group** — a new, much simpler creation dialog that only
     asks for a name (no DoD, no schedule, no colors) — purely an
     organizational container, generates no calendar occurrences of its own.

   Nesting rules: a recurrent task can be a child of a recurrent group; a
   recurrent group can be a child of another recurrent group. This is a
   **new, separate hierarchy** from the main task tree (recurrent tasks
   already are, per M39: "permanently leaf, organizationally separate from
   the main tree — never reparented in or out" — groups extend that
   separate structure, they don't touch the main tree's parent/child
   model). Deleting a group with children opens a confirm dialog offering
   "delete children too" vs. "ungroup" (move children up a level), per the
   clarifying answer above — never a silent default.

8. **Auto-adjust end date/time instead of warning, in recurrence
   creation.** Today, `NewRoutineDialog.tsx` shows a red "End must be after
   start" warning (`{!(end > start) && ...}`) when the first-occurrence end
   is before/equal to start, and blocks submission (`canSubmit` requires
   `end > start`). Instead: when the user picks a start date/time that's
   after the current end date/time, automatically bump the end date (and,
   per the request, the end *time* too) to match the new start — preserving
   the existing duration is one option, or simply snapping end = start
   (needs a decision at implementation time on which — snapping end to
   equal start seems to be what's literally requested: "the end date should
   automatically change to the same date as the selected initial date...
   the same should happen with the time"). No more red warning for this
   specific case; the fields self-correct instead.

9. **Click-drag on the Plan calendar to create a new event.** Today,
   `PlanCalendar.tsx` has `selectable={false}` — drag-to-select empty
   calendar space is entirely disabled (the only existing drag interactions
   are dragging an *existing* task row onto the calendar to schedule it, or
   dragging an *existing* chip to reschedule it, M17/M31/M32). New flow:
   1. Enable slot-selection on the time grid; while dragging, render a
      ghost/empty preview chip showing just the selected time range
      (visually similar in spirit to M17's existing drop-preview ghost, but
      for a raw click-drag on empty space rather than a task-row drag).
   2. On drop, open a small chooser: "recurrent" vs. "not recurrent" —
      **and**, per the clarifying answer, also let the user pick an
      **existing unscheduled task** instead of creating a new one.
   3. Branches:
      - *Recurrent + new* → opens the existing `NewRoutineDialog`, pre-filled
        with the dragged start/end as the first occurrence.
      - *Not recurrent + new* → opens a new, minimal dialog (name + DoD only,
        per the clarifying answer — no parent/goal picker, always a
        root-level leaf) that creates the task **and** an interval for the
        dragged time range in one step, mirroring how routine creation
        already creates a task + first occurrence together.
      - *Existing task* (either recurring or not — TBD at implementation
        time whether "recurrent vs. not" even applies once picking an
        existing task, since an existing task's recurrence is already fixed)
        → schedule that task into the dragged slot, reusing the existing
        interval-creation path.

10. **Drag-and-drop reordering within the Recurrent tasks tab**, constrained
    to the group hierarchy from item 7: a recurrent task can be dropped
    onto/into a recurrent group (becoming its child) or reordered among
    siblings, but **never** becomes the parent of another recurrent task.
    A recurrent group can be dropped into another recurrent group. Depends
    on item 7's group model existing first.

11. **Recurrence creation should resolve to the closest future matching day,
    not block.** Reported repro: selecting a weekly recurrence day (e.g.
    Monday) while "today" is a later day in that week (e.g. Thursday)
    currently prevents creating the task. Static review of
    `occurrence_dates()`/`create_routine` didn't find a hard validation that
    would reject this outright — the generation math already appears to
    correctly skip a same-week candidate that falls before the anchor date
    and resolve to the next matching future weekday instead, and
    `RoutineCreate` has no weekday-vs-anchor validator that would raise an
    API error. This needs **live reproduction** during implementation to
    find the actual blocker (or confirm it's a UX-clarity gap rather than a
    hard error — e.g. the task silently gets created with its first
    occurrence next Monday, and the lack of any visible feedback about that
    reads as "nothing happened" / "I can't create it"). Whichever it turns
    out to be, the fix is the same either way: creating the task must always
    succeed, resolving to the closest future occurrence of the selected
    day(s), with clear UI feedback on what the first occurrence date will
    be.

## Notes for implementation planning

- Items 7 + 10 are tightly coupled (group model, then drag rules on top of
  it) — likely worth sequencing as adjacent milestones, group creation/
  deletion first, then the drag-and-drop constraints.
- Item 5 (the rename + migration) touches nearly every file item 7/9/10 will
  also touch (`NewRoutineDialog`, `RoutinesList`, `RoutineService`, etc.) —
  worth doing the rename *before* items 7/9/10 so new code is written
  against the final "recurrent task" vocabulary rather than needing to be
  renamed again right after.
- Items 2 and 11 are both flagged as "needs live reproduction against the
  dev stack" rather than fully root-caused here — static code reading
  didn't surface a definitive bug for either, so the first implementation
  step for both should be reproducing the reported symptom against the
  running dev stack before writing a fix.
