import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { Task } from '../../types'
import {
  useAddParent,
  useAddRequirement,
  useDeleteTask,
  usePalette,
  useRemoveParent,
  useRemoveRequirement,
  useUpdateTask,
} from '../../api/tasks'
import { useDeleteInterval, useIntervalsForTask } from '../../api/intervals'
import { descendantIds } from '../../lib/taskTree'
import ColorSwatchPicker from './ColorSwatchPicker'
import StateBadge from './StateBadge'

export default function TaskDetailPanel({
  task,
  tasksById,
  onAddChild,
}: {
  task: Task
  tasksById: Map<string, Task>
  onAddChild: (parentId: string) => void
}) {
  const { data: palette = [] } = usePalette()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const resetDeleteTask = deleteTask.reset
  const addParent = useAddParent()
  const removeParent = useRemoveParent()
  const addRequirement = useAddRequirement()
  const removeRequirement = useRemoveRequirement()
  const { data: intervals = [] } = useIntervalsForTask(task.id)
  const deleteInterval = useDeleteInterval()

  const [name, setName] = useState(task.name)
  const [dod, setDod] = useState(task.definition_of_done)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [addParentId, setAddParentId] = useState('')
  const [addRequiredId, setAddRequiredId] = useState('')

  useEffect(() => {
    setName(task.name)
    setDod(task.definition_of_done)
    setConfirmingDelete(false)
    setAddParentId('')
    setAddRequiredId('')
    resetDeleteTask()
  }, [task.id, task.name, task.definition_of_done, resetDeleteTask])

  const isDirty = name !== task.name || dod !== task.definition_of_done

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

  const requirementCandidates = useMemo(() => {
    const excluded = new Set(task.requires_ids)
    excluded.add(task.id)
    return Array.from(tasksById.values())
      .filter((candidate) => !excluded.has(candidate.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [task, tasksById])

  function handleSave() {
    updateTask.mutate({
      id: task.id,
      input: { name: name.trim(), definition_of_done: dod },
    })
  }

  function toggleColor(color: string) {
    const next = task.colors.includes(color)
      ? task.colors.filter((c) => c !== color)
      : [...task.colors, color]
    updateTask.mutate({ id: task.id, input: { colors: next } })
  }

  return (
    <div className="h-full overflow-y-auto p-6" data-testid="task-detail-panel">
      <div className="mb-4 flex items-center gap-2">
        <StateBadge state={task.state} />
        {!task.is_leaf && (
          <span className="text-xs text-text-secondary">
            derived from {task.children_ids.length} sub-task
            {task.children_ids.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-2">
        <input
          aria-label="Task name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full border-none bg-transparent text-xl font-semibold text-text-primary focus:outline-none"
        />
        <button
          type="button"
          title="Create child task"
          onClick={() => onAddChild(task.id)}
          className="mt-1 shrink-0 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-alt hover:text-text-primary"
        >
          + Child task
        </button>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
          Definition of done
        </label>
        <textarea
          value={dod}
          onChange={(event) => setDod(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
        />
      </div>

      {isDirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={updateTask.isPending || name.trim().length === 0}
          className="mt-3 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Save changes
        </button>
      )}

      <div className="mt-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
          Colors
        </label>
        <div className="mt-2">
          <ColorSwatchPicker palette={palette} selected={task.colors} onToggle={toggleColor} />
        </div>
        {task.colors.length === 0 && task.effective_colors.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            Inherited from parent{task.parent_ids.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {task.is_leaf && (
        <div className="mt-6">
          <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
            Sprint schedule
          </label>
          {intervals.length === 0 ? (
            <p className="mt-1 text-xs text-text-secondary">
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
                    className="flex items-center justify-between rounded bg-surface-alt px-2 py-1 text-xs text-text-secondary"
                  >
                    <span>
                      {format(new Date(interval.start), 'EEE MMM d, HH:mm')} –{' '}
                      {format(new Date(interval.end), 'HH:mm')}
                    </span>
                    <button
                      type="button"
                      title="Remove this time slot"
                      onClick={() => deleteInterval.mutate(interval.id)}
                      className="text-text-secondary hover:text-danger"
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
        <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
          Parents
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {task.parent_ids.length === 0 && (
            <span className="text-xs text-text-secondary">Top-level task</span>
          )}
          {task.parent_ids.map((parentId) => {
            const parent = tasksById.get(parentId)
            return (
              <span
                key={parentId}
                className="flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-xs text-text-secondary"
              >
                {parent?.name ?? parentId}
                <button
                  type="button"
                  onClick={() => removeParent.mutate({ id: task.id, parentId })}
                  className="text-text-secondary hover:text-danger"
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
              aria-label="Add parent"
              value={addParentId}
              onChange={(event) => setAddParentId(event.target.value)}
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
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
              title="Add parent"
              disabled={!addParentId || addParent.isPending}
              onClick={() => {
                addParent.mutate({ id: task.id, parentId: addParentId })
                setAddParentId('')
              }}
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-alt disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary">
          Requires
        </label>
        <p className="mt-1 text-xs text-text-secondary">
          Prerequisite tasks — this task can't be scheduled until they're done.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {task.requires_ids.length === 0 && (
            <span className="text-xs text-text-secondary">No prerequisites</span>
          )}
          {task.requires_ids.map((requiredId) => {
            const required = tasksById.get(requiredId)
            return (
              <span
                key={requiredId}
                className="flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-xs text-text-secondary"
              >
                {required?.name ?? requiredId}
                <button
                  type="button"
                  onClick={() => removeRequirement.mutate({ id: task.id, requiredId })}
                  className="text-text-secondary hover:text-danger"
                  title="Remove requirement"
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
        {requirementCandidates.length > 0 && (
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Add requirement"
              value={addRequiredId}
              onChange={(event) => setAddRequiredId(event.target.value)}
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary"
            >
              <option value="">Add requirement…</option>
              {requirementCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Add requirement"
              disabled={!addRequiredId || addRequirement.isPending}
              onClick={() => {
                addRequirement.mutate(
                  { id: task.id, requiredId: addRequiredId },
                  { onSuccess: () => setAddRequiredId('') },
                )
              }}
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-alt disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
        {addRequirement.isError && (
          <p className="mt-2 text-xs text-danger">{(addRequirement.error as Error).message}</p>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-4">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-danger hover:text-danger-hover"
          >
            Delete task
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Delete this task permanently?</span>
            <button
              type="button"
              onClick={() => deleteTask.mutate(task.id)}
              className="rounded bg-danger px-2 py-1 text-xs font-medium text-white hover:bg-danger-hover"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
        {deleteTask.isError && (
          <p className="mt-2 text-xs text-danger">{(deleteTask.error as Error).message}</p>
        )}
      </div>
    </div>
  )
}
