I want to build a web app for planning, executing and evaluating my daily tasks. For this I want a React front end, python backend and redis DB.

### Frontend structure

There will be 3 views: Plan, Execute and Evaluate

## Plan view

The idea of this view is being able to plan the task that are going be made the following week.

### Tasks hierarchy

The tasks are going to be ordered on a DAG. The leaves are going to be the actual tasks. The nodes represent higher order goals that I will be completing by completing the nodes and leaves that are below it.

The DAG structure will be presented on the Plan view as a left panel that looks like VS Code directory structure visualization. In the same way that the top directories are visualized and can be expanded to see the directories that are its inmemdiate son nodes, in the app the highest order tasks will be visible and can be expanded to see the inmediatly lower order task. In contrast to the directory tree estructura, the tasks structure will be a DAG, which means that a task can be the son of many others.

Colors can be assigned to the tasks which will be inherited by its sub-DAG. One task can have many colors. If a task is asigned a color, it will override the color of its parents.

### Tasks life cicle

The app follows a limited scrum implementation.
A task is added in the same way a file is created at VSCode (the +file button at the top of the left panel).

When a task is created it will be in "backlog" state. A task name and definition of done are necesary to create the task. the task name will be visible in the panel in the same way as the files and directory names are visible on vscode.

When clicking a leave task, the description and definition of done will be visible like a file in vs code. There will also be a button at the bottom right called "add to sprint". When this button is clicked the task will be in state "sprint backlog" and a concrete time interval has to be reserved on a calendar for doing this task. Many time intervals can be reserved during the week.

The calendar will be a window that displays a calendar in the same way as google calendar. It will only show the following week.

## Execute view

The idea for this view is to register the time spended on a task while its happening. This view will be similar to toggl.com view. A cronometer can be started and a task can be selected for indicating that that task is being executed. When the cronometer is started the task will be in stated "in progress"

For the calendar display on this view, for the time that has passed, the registered task execution is visible, and for time that has not yet passed, the planned task are visible.

After stopping the cronometer, two options will appear, whether to mark the task as done, in which case the task will be in stated "sprint done", to no mark it as done, in which case it will be still in state "in progress".

After the week ends, everything in state "sprint done" will be in state "done", and everything in state "in progress" will be in state "backlog"

## Evaluate view

This view is for evaluating and improving the user planning skills. It will have options to show the planned weeks, the real weeks by the registered on the execute view and a diff between the two, everything on a calendar view like google calendar.

This view will also display information about number of hours executed vs the planned (in hours and percentage executed / planned) for the whole week, and by task (leaves and nodes). Also the number of task finished and not finished also by week, and by task.

## Connections

When reserving time for a task in the calendar it has to be added to the user google calendar.

## first stage

for now I will be the only user, so we will not be working on users managment.