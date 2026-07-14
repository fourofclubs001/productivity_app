- When dragging from Plan left panel to the calendar, add a ghost chip that shows were in the calendar would the chip be position if drop there (like in google calendar)

- a task can be plan for after its required task are planned.

- a task cannot set an ascendant task as required (there is cycle, top task is only done when bottom task are done)

- a task cannot be time tracked if the required task are not sprint done or done yet.

- for showing this restrictions when they are intended to be broken, use a dialog with an accept button at the bottom for closing it. remove the current way of showing them.

- at evaluate view, diff calendar, the time intervals where there is no overlap between the planned task and the tracked time for it, a comment can be added via clicking the planned chip and a dialog for explaining the difference appears. The dialog allows to select between user created "excuses" or to create a new one. Add a third subtab to the evaluate view that shows metrics over this "excuses". This allows to evaluate, learn and fix why the plan and the execution differ.

- when a root task is not deleted after all its subtasks are done / sprint done, assign it the backlog state again

- rollback the estimated time entry from the detailed view. the estimated time is already expressed on the calendar.

- at the sprint schedule detailed view, the time interval should be editable with entries that specify, day, start hour and end hour.

- move the add child button at detailed view from the top to a section below Parents, with the same format as Parents, but without the dropdown.

- remove the "delete task" at the bottom of the detailed view. Add three points at the top right like "options", when clicked the only option must be "delete task" in the same way that is shown when right clicking a chip. How is that small window called? add the name to the glossary

- when a task its manually deleted at plan view remove the chips that are planned for after the current time.

- at plan view, the chips time interval cannot be modified if they are before the current time. If the current time is in the time interval, the start time is blocked, but the end time can be moved. If the current time is before both, both can move. If the current time is after the start time and end time, the chip is completely blocked.

- task can only be plan for after the current time. no task can be added for before the current time.

- ctrl+z must revert the addition of a chip at the calendar.

- ctrl+y must revert crtl+z

- At the plan view, when the chip is before the current time, make it transparent like in execute calendar with time tacked in the past

- add a button to the task detailed view to mark it as sprint done