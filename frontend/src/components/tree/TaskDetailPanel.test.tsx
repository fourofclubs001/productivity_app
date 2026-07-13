import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetailPanel from './TaskDetailPanel'
import { makeTask } from '../../test/taskFixtures'

const updateMutate = vi.fn()
const deleteMutate = vi.fn()
const deleteReset = vi.fn()
const addParentMutate = vi.fn()
const removeParentMutate = vi.fn()
const deleteTaskState = vi.fn()

vi.mock('../../api/tasks', () => ({
  usePalette: () => ({ data: ['red', 'blue'] }),
  useUpdateTask: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteTask: () => deleteTaskState(),
  useAddParent: () => ({ mutate: addParentMutate, isPending: false }),
  useRemoveParent: () => ({ mutate: removeParentMutate, isPending: false }),
}))

vi.mock('../../api/intervals', () => ({
  useIntervalsForTask: () => ({ data: [] }),
  useDeleteInterval: () => ({ mutate: vi.fn() }),
}))

beforeEach(() => {
  updateMutate.mockReset()
  deleteMutate.mockReset()
  deleteReset.mockReset()
  addParentMutate.mockReset()
  removeParentMutate.mockReset()
  deleteTaskState.mockReturnValue({
    mutate: deleteMutate,
    reset: deleteReset,
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
