import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetailPanel from './TaskDetailPanel'
import { makeTask } from '../../test/taskFixtures'
import { UndoProvider } from '../../undo/UndoProvider'

// AddToCalendarModal (opened from this panel) pushes an undo entry on
// create, so every render needs a real UndoProvider ancestor.
function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(<UndoProvider>{ui}</UndoProvider>)
}

const updateMutate = vi.fn()
const deleteMutate = vi.fn()
const deleteReset = vi.fn()
const addParentMutate = vi.fn()
const removeParentMutate = vi.fn()
const addRequirementMutate = vi.fn()
const removeRequirementMutate = vi.fn()
const deleteTaskState = vi.fn()
const addRequirementState = vi.fn()

vi.mock('../../api/tasks', () => ({
  usePalette: () => ({ data: ['red', 'blue'] }),
  useUpdateTask: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteTask: () => deleteTaskState(),
  useAddParent: () => ({ mutate: addParentMutate, isPending: false }),
  useRemoveParent: () => ({ mutate: removeParentMutate, isPending: false }),
  useAddRequirement: () => addRequirementState(),
  useRemoveRequirement: () => ({ mutate: removeRequirementMutate, isPending: false }),
}))

const updateIntervalMutate = vi.fn()
const useIntervalsForTask = vi.fn(() => ({ data: [] as unknown[] }))

vi.mock('../../api/intervals', () => ({
  useIntervalsForTask: () => useIntervalsForTask(),
  useDeleteInterval: () => ({ mutate: vi.fn() }),
  useUpdateInterval: () => ({ mutate: updateIntervalMutate, isPending: false }),
  useCreateInterval: () => ({ mutate: vi.fn(), isPending: false }),
  useTaskCoverage: () => ({ data: { covered_hours: 0 } }),
}))

beforeEach(() => {
  updateMutate.mockReset()
  deleteMutate.mockReset()
  deleteReset.mockReset()
  addParentMutate.mockReset()
  removeParentMutate.mockReset()
  addRequirementMutate.mockReset()
  removeRequirementMutate.mockReset()
  updateIntervalMutate.mockReset()
  useIntervalsForTask.mockReturnValue({ data: [] })
  deleteTaskState.mockReturnValue({
    mutate: deleteMutate,
    reset: deleteReset,
    isPending: false,
    isError: false,
    error: null,
  })
  addRequirementState.mockReturnValue({
    mutate: addRequirementMutate,
    isPending: false,
    isError: false,
    error: null,
  })
})

describe('TaskDetailPanel', () => {
  it('renders task fields', () => {
    const task = makeTask({ id: 't1', name: 'Task one', description: 'desc', definition_of_done: 'dod' })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.getByDisplayValue('Task one')).toBeInTheDocument()
    expect(screen.getByDisplayValue('dod')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('desc')).not.toBeInTheDocument()
  })

  it('only shows Save changes once a field is edited, and saves all fields', () => {
    const task = makeTask({ id: 't1', name: 'Task one', description: 'desc', definition_of_done: 'dod' })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.queryByText('Save changes')).not.toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('Task one'), { target: { value: 'New name' } })
    fireEvent.click(screen.getByText('Save changes'))

    expect(updateMutate).toHaveBeenCalledWith({
      id: 't1',
      input: { name: 'New name', definition_of_done: 'dod' },
    })
  })

  it('toggles a color immediately without needing Save', () => {
    const task = makeTask({ id: 't1' })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    fireEvent.click(screen.getByTitle('red'))
    expect(updateMutate).toHaveBeenCalledWith({ id: 't1', input: { colors: ['red'] } })
  })

  it('requires a confirmation click before deleting', () => {
    const task = makeTask({ id: 't1' })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    fireEvent.click(screen.getByText('Delete task'))
    expect(deleteMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm'))
    expect(deleteMutate).toHaveBeenCalledWith('t1')
  })

  it('calls onAddChild with this task id when "+ Child task" is clicked', () => {
    const onAddChild = vi.fn()
    const task = makeTask({ id: 't1' })
    render(
      <TaskDetailPanel
        task={task}
        tasksById={new Map([[task.id, task]])}
        onAddChild={onAddChild}
      />,
    )

    fireEvent.click(screen.getByTitle('Create child task'))
    expect(onAddChild).toHaveBeenCalledWith('t1')
  })

  it('removes a parent when its chip is clicked', () => {
    const parent = makeTask({ id: 'p1', name: 'Parent' })
    const task = makeTask({ id: 't1', parent_ids: ['p1'] })
    render(
      <TaskDetailPanel
        task={task}
        tasksById={
          new Map([
            [task.id, task],
            [parent.id, parent],
          ])
        }
        onAddChild={() => {}}
      />,
    )

    fireEvent.click(screen.getByTitle('Remove parent'))
    expect(removeParentMutate).toHaveBeenCalledWith({ id: 't1', parentId: 'p1' })
  })

  it('adds a requirement when a candidate is selected and Add is clicked', () => {
    const other = makeTask({ id: 'r1', name: 'Required task' })
    const task = makeTask({ id: 't1' })
    render(
      <TaskDetailPanel
        task={task}
        tasksById={
          new Map([
            [task.id, task],
            [other.id, other],
          ])
        }
        onAddChild={() => {}}
      />,
    )

    const select = screen.getByDisplayValue('Add requirement…')
    fireEvent.change(select, { target: { value: 'r1' } })
    fireEvent.click(within(select.closest('div')!).getByText('Add'))
    expect(addRequirementMutate).toHaveBeenCalledWith(
      { id: 't1', requiredId: 'r1' },
      expect.any(Object),
    )
  })

  it('removes a requirement when its chip is clicked', () => {
    const required = makeTask({ id: 'r1', name: 'Required task' })
    const task = makeTask({ id: 't1', requires_ids: ['r1'] })
    render(
      <TaskDetailPanel
        task={task}
        tasksById={
          new Map([
            [task.id, task],
            [required.id, required],
          ])
        }
        onAddChild={() => {}}
      />,
    )

    fireEvent.click(screen.getByTitle('Remove requirement'))
    expect(removeRequirementMutate).toHaveBeenCalledWith({ id: 't1', requiredId: 'r1' })
  })

  it('shows the backend message in a dialog when adding a requirement is rejected (e.g. a cycle)', () => {
    addRequirementMutate.mockImplementation(
      (_vars: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new Error('Requiring this task would create a cycle of prerequisites'))
      },
    )
    const task = makeTask({ id: 't1' })
    const candidate = makeTask({ id: 'r1', name: 'Candidate task' })
    render(
      <TaskDetailPanel
        task={task}
        tasksById={
          new Map([
            [task.id, task],
            [candidate.id, candidate],
          ])
        }
        onAddChild={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Add requirement'), {
      target: { value: candidate.id },
    })
    fireEvent.click(screen.getByTitle('Add requirement'))

    expect(screen.getByText(/would create a cycle/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByText(/would create a cycle/i)).not.toBeInTheDocument()
  })

  it('opens the "Add to calendar" modal when the button is clicked', () => {
    const task = makeTask({ id: 't1', is_leaf: true })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.queryByText('Add to calendar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Add to calendar'))
    expect(screen.getByText('Add to calendar')).toBeInTheDocument()
  })

  it('edits a scheduled interval inline and saves the new time', () => {
    useIntervalsForTask.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-13T09:00:00.000Z',
          end: '2026-07-13T10:00:00.000Z',
          week_start: '2026-07-13',
        },
      ],
    })
    const task = makeTask({ id: 't1', is_leaf: true })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    // The row's button text is "<day>, HH:mm – HH:mm" -- match the dash
    // rather than hardcoding digits, since displayed time is in local TZ.
    fireEvent.click(screen.getByRole('button', { name: /–/ }))
    const dayInput = screen.getByLabelText('Day') as HTMLInputElement
    fireEvent.change(screen.getByLabelText('Start hour'), { target: { value: '15:30' } })
    fireEvent.click(screen.getByText('Save'))

    // Mirror the component's own local-time construction so this assertion
    // doesn't depend on which timezone the test happens to run in.
    const expectedStart = new Date(`${dayInput.value}T15:30`).toISOString()
    expect(updateIntervalMutate).toHaveBeenCalledWith(
      { id: 'iv1', input: expect.objectContaining({ start: expectedStart }) },
      expect.any(Object),
    )
  })

  it('lets a leaf task set an estimate, saved alongside name/DoD', () => {
    const task = makeTask({ id: 't1', is_leaf: true })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    fireEvent.change(screen.getByLabelText('Estimated hours'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByText('Save changes'))

    expect(updateMutate).toHaveBeenCalledWith({
      id: 't1',
      input: { name: task.name, definition_of_done: '', estimated_hours: 2.5 },
    })
  })

  it('shows a read-only rollup for a non-leaf task instead of an input', () => {
    const task = makeTask({ id: 't1', is_leaf: false, estimated_hours: 4.5 })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.queryByLabelText('Estimated hours')).not.toBeInTheDocument()
    expect(screen.getByText(/4\.5h/)).toBeInTheDocument()
  })

  it('shows hours covered from the coverage query', () => {
    const task = makeTask({ id: 't1', is_leaf: true })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.getByText(/0\.0h currently on the calendar/)).toBeInTheDocument()
  })
})

describe('TaskDetailPanel delete error', () => {
  it('shows the backend message when deletion is blocked', () => {
    deleteTaskState.mockReturnValue({
      mutate: deleteMutate,
      reset: deleteReset,
      isPending: false,
      isError: true,
      error: new Error(
        "This task's timer is currently running — stop it before deleting the task.",
      ),
    })
    const task = makeTask({ id: 't1' })
    render(
      <TaskDetailPanel task={task} tasksById={new Map([[task.id, task]])} onAddChild={() => {}} />,
    )

    expect(screen.getByText(/timer is currently running/i)).toBeInTheDocument()
  })
})
