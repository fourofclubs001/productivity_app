Plan view:

- add button to create child task from task detailed view
- add option to select task color on task creation
- remove description text area from task detailed view
- on vs code is possible to put a directory or file inside a directory by drag and drop. Search for this mechanism and implement it for making a taks a child of another
- make it possible to drag and drop a leaf task from the left panel to the calendar
- add a button to the leaf task detailed view for adding the task to the calendar
- remove the "Drag on the calendar to schedule ..." from panel view
- add an entry for indicating the expected time that the task will take. next to it, it must be indicated how many of those hours are covered on the current plan.
- when a leaf task get to the "sprint done" state it must be removed from the plan view
- when the last children of a task get to the "sprint done" state it must be asked if this parent task should be removed from plan view
- allow to drag and drop task on the calendar in the same way google calendar does
- when clicking a task on the calendar its detailed view must appear
- at the sprint schedule detailed view, the time interval should be editable by day, start hour and end hour.
- it should be possible to drag and drop the task on the left panel to change their order
- is there a pattern name for the kind of interactions I'm describing?
- ctrl+z should unde actions
- the task should be time extendable with the click and drag with the moause at the calendar
- the panels at plan should be extendible to the sides
- the option to delete a task from the calendar should appear when the task is right clicked
- at task detailed view, a task can be specified as a requirement for the one being shown. Then the task can only be schedule after the required one.
- after created a new task it detailed view is shown on the detailed view panel
- Add more color options to the detailed view
- when a task has two color, the two colors must appear on the calendar task with some patter

Execute view:

- instead of asking to mark the task as done or not, when the time tracker is stop it should ask "is the definition of done fulfilled?" and write that task definition next to it. This should be shown on a window like the one used for new sub-task. (what is the name of that kind of windows?)
- at the task selection dropdown the tasks should be shown in the same order as in the left panel of plan view, and should also be expandable for hiding and showing subtasks

Evaluate view:

- the task list should be shown in the same order as in the plan left panel.
- when a root task is "done" and therefore removed from plan left panel, it should be shown at the bottom of the task at evaluate view metrics subtab.
- the task should expandable in the same way as in plan left panel, for hiding or showing the subtasks.
- at the filter by task the same order and expandable logic must be applied

development detail:

- now there is info about my tasks on the web app. what is the best way to keep developing with out modifing that information? can we create a development and deploy environments? can we configure a CI/CD pipeline for this?