import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import {
  useAddParent,
  useDeleteTask,
  usePalette,
  useRemoveParent,
  useUpdateTask,
} from '../../api/tasks'
import { useDeleteInterval, useIntervalsForTask } from '../../api/intervals'
import { COLOR_HEX } from './colors'
import StateBadge from './StateBadge'

function descendantIds(taskId: string, tasksById: Map<string, Task>): Set<string> {
  const result = new Set<string>()
  const stack = [...(tasksById.get(taskId)?.children_ids ?? [])]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (result.has(current)) continue
    result.add(current)
    stack.push(...(tasksById.get(current)?.children_ids ?? []))
  }
  return result
}

export default function TaskDetailPanel({
  task,
  tasksById,
}: {
  task: Task
  tasksById: Map<string, Task>
}) {
  const { data: palette = [] } = usePalette()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const resetDeleteTask = deleteTask.reset
  const addParent = useAddParent()
  const removeParent = useRemoveParent()
  const { data: intervals = [] } = useIntervalsForTask(task.id)
  const deleteInterval = useDeleteInterval()

  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description)
  const [dod, setDod] = useState(task.definition_of_done)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [addParentId, setAddParentId] = useState('')

  useEffect(() => {
    setName(task.name)
    setDescription(task.description)
    setDod(task.definition_of_done)
    setConfirmingDelete(false)
    setAddParentId('')
    resetDeleteTask()
  }, [task.id, task.name, task.description, task.definition_of_done, resetDeleteTask])

  const isDirty =
    name !== task.name || description !== task.description || dod !== task.definition_of_done

  const excludedFromParentPicker = useMemo(() => {
    const excluded = descendantIds(task.id, tasksById)
    excluded.add(task.id)
    task.parent_ids.forEach((id) => excluded.add(id))
    return excluded
  }, [task, tasksById])

  const parentCandidates = useMemo(
    () =>
      Array.from(tasksById.values())
        .filter((candidate) => !excludedFromParentPicker.has(candidate.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tasksById, excludedFromParentPicker],
  )

  function handleSave() {
    updateTask.mutate({
      id: task.id,
      input: { name: name.trim(), description, definition_of_done: dod },
    })
  }

  function toggleColor(color: string) {
    const next = task.colors.includes(color)
      ? task.colors.filter((c) => c !== color)
      : [...task.colors, color]
    updateTask.mutate({ id: task.id, input: { colors: next } })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-2">
        <StateBadge state={task.state} />
        {!task.is_leaf && (
          <span className="text-xs text-neutral-500">
            derived from {task.children_ids.length} sub-task
            {task.children_ids.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full border-none bg-transparent text-xl font-semibold text-neutral-100 focus:outline-none"
      />

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Description
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Definition of done
        </label>
        <textarea
          value={dod}
          onChange={(event) => setDod(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={updateTask.isPending || name.trim().length === 0}
          className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Save changes
        </button>
      )}

      <div className="mt-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Colors
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {palette.map((color) => {
            const active = task.colors.includes(color)
            return (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => toggleColor(color)}
                className={`h-6 w-6 rounded-full border-2 ${
                  active ? 'border-neutral-100' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: COLOR_HEX[color] }}
              />
            )
          })}
        </div>
        {task.colors.length === 0 && task.effective_colors.length > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Inherited from parent{task.parent_ids.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {task.is_leaf && (
        <div className="mt-6">
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Sprint schedule
          </label>
          {intervals.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-600">
              Not scheduled. Select this task, then drag on the calendar to reserve time.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {intervals
                .slice()
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((interval) => (
                  <li
                    key={interval.id}
                    className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300"
                  >
                    <span>
                      {format(new Date(interval.start), 'EEE MMM d, HH:mm')} –{' '}
                      {format(new Date(interval.end), 'HH:mm')}
                    </span>
                    <button
                      type="button"
                      title="Remove this time slot"
                      onClick={() => deleteInterval.mutate(interval.id)}
                      className="text-neutral-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Parents
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {task.parent_ids.length === 0 && (
            <span className="text-xs text-neutral-600">Top-level task</span>
          )}
          {task.parent_ids.map((parentId) => {
            const parent = tasksById.get(parentId)
            return (
              <span
                key={parentId}
                className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
              >
                {parent?.name ?? parentId}
                <button
                  type="button"
                  onClick={() => removeParent.mutate({ id: task.id, parentId })}
                  className="text-neutral-500 hover:text-red-400"
                  title="Remove parent"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        {parentCandidates.length > 0 && (
          <div className="mt-2 flex gap-2">
            <select
              value={addParentId}
              onChange={(event) => setAddParentId(event.target.value)}
              className="flex-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
            >
              <option value="">Add parent…</option>
              {parentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addParentId || addParent.isPending}
              onClick={() => {
                addParent.mutate({ id: task.id, parentId: addParentId })
                setAddParentId('')
              }}
              className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-neutral-800 pt-4">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Delete task
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Delete this task permanently?</span>
            <button
              type="button"
              onClick={() => deleteTask.mutate(task.id)}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        )}
        {deleteTask.isError && (
          <p className="mt-2 text-xs text-red-400">{(deleteTask.error as Error).message}</p>
        )}
      </div>
    </div>
  )
}
