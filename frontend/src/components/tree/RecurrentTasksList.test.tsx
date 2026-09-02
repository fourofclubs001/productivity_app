import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecurrentTasksList from './RecurrentTasksList'
import { makeTask } from '../../test/taskFixtures'

const deleteMutate = vi.fn()
const createGroupMutate = vi.fn((_input?: unknown, options?: { onSuccess?: (task: unknown) => void }) => {
  options?.onSuccess?.({ id: 'new-group' })
})
const deleteGroupMutate = vi.fn((_vars?: unknown, options?: { onSettled?: () => void }) => {
  options?.onSettled?.()
})

vi.mock('../../api/tasks', () => ({
  useDeleteTask: () => ({ mutate: deleteMutate }),
}))

vi.mock('../../api/recurrentTasks', () => ({
  useCreateRecurrentGroup: () => ({ mutate: createGroupMutate, isPending: false, isError: false }),
  useDeleteRecurrentGroup: () => ({ mutate: deleteGroupMutate, isPending: false }),
  useMoveRecurrentItem: () => ({ mutate: vi.fn() }),
  useReorderRecurrentItem: () => ({ mutate: vi.fn() }),
}))

beforeEach(() => {
  deleteMutate.mockReset()
  createGroupMutate.mockClear()
  deleteGroupMutate.mockClear()
})

describe('RecurrentTasksList', () => {
  it('shows only recurrent tasks/groups, sorted by name, and never leaks a normal task in', () => {
    const recurrentA = makeTask({ id: 'r1', name: 'Zebra recurrent', is_recurrent_task: true })
    const recurrentB = makeTask({ id: 'r2', name: 'Alpha recurrent', is_recurrent_task: true })
    const normalTask = makeTask({ id: 't1', name: 'Normal task', is_recurrent_task: false })

    render(
      <RecurrentTasksList
        tasks={[recurrentA, normalTask, recurrentB]}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    const rows = screen.getAllByText(/recurrent$/)
    expect(rows.map((row) => row.textContent)).toEqual(['Alpha recurrent', 'Zebra recurrent'])
    expect(screen.queryByText('Normal task')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when there are no recurrent tasks', () => {
    render(
      <RecurrentTasksList
        tasks={[]}
        selectedId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText(/no recurrent tasks yet/i)).toBeInTheDocument()
  })

  // The "+ -> chooser -> Recurrent task / group" creation flow moved to
  // PlanView's merged tab strip in v08; it's covered end-to-end by
  // e2e/recurrent-tasks.spec.ts.

  it('right-click deletes a recurrent task via the same confirm flow as a normal task row', () => {
    const recurrentTask = makeTask({ id: 'r1', name: 'Water plants', is_recurrent_task: true })
    const onSelect = vi.fn()
    render(
      <RecurrentTasksList
        tasks={[recurrentTask]}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByText('Water plants'))
    expect(onSelect).toHaveBeenCalledWith('r1')

    fireEvent.contextMenu(screen.getByText('Water plants'))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteMutate).toHaveBeenCalledWith({ id: 'r1' }, expect.anything())
  })

  it('a group nests its recurrent-task children, expandable/collapsible, and is not itself selectable', () => {
    const group = makeTask({ id: 'g1', name: 'Chores', is_recurrent_group: true })
    const child = makeTask({
      id: 'c1',
      name: 'Water plants',
      is_recurrent_task: true,
      recurrent_parent_id: 'g1',
    })
    const onSelect = vi.fn()
    render(
      <RecurrentTasksList
        tasks={[group, child]}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    // Collapsed by default -- child not visible until expanded.
    expect(screen.queryByText('Water plants')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Chores'))
    expect(screen.getByText('Water plants')).toBeInTheDocument()

    // Clicking the group toggles expand/collapse rather than selecting it.
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Chores'))
    expect(screen.queryByText('Water plants')).not.toBeInTheDocument()
  })

  it('right-click delete on a group opens the 3-way dialog, and "Ungroup" calls deleteChildren=false', () => {
    const group = makeTask({ id: 'g1', name: 'Chores', is_recurrent_group: true })
    render(
      <RecurrentTasksList
        tasks={[group]}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    fireEvent.contextMenu(screen.getByText('Chores'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText(/Choose what happens to anything inside it/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }))
    expect(deleteGroupMutate).toHaveBeenCalledWith(
      { id: 'g1', deleteChildren: false },
      expect.anything(),
    )
  })

  it('"Delete children too" on the group dialog calls deleteChildren=true', () => {
    const group = makeTask({ id: 'g1', name: 'Chores', is_recurrent_group: true })
    render(
      <RecurrentTasksList
        tasks={[group]}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    fireEvent.contextMenu(screen.getByText('Chores'))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete children too' }))
    expect(deleteGroupMutate).toHaveBeenCalledWith(
      { id: 'g1', deleteChildren: true },
      expect.anything(),
    )
  })
})
