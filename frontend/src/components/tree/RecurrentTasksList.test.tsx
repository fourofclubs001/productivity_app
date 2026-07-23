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
        onOpenNewRecurrentTask={() => {}}
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
        onOpenNewRecurrentTask={() => {}}
      />,
    )
    expect(screen.getByText(/no recurrent tasks yet/i)).toBeInTheDocument()
  })

  it('the + button opens a chooser, and picking "Recurrent task" delegates to the parent', () => {
    const onOpenNewRecurrentTask = vi.fn()
    render(
      <RecurrentTasksList
        tasks={[]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewRecurrentTask={onOpenNewRecurrentTask}
      />,
    )
    fireEvent.click(screen.getByTitle('New recurrent item'))
    expect(screen.getByText('New…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Recurrent task' }))
    expect(onOpenNewRecurrentTask).toHaveBeenCalled()
  })

  it('picking "Recurrent group" from the chooser opens the group-name dialog and creates it', () => {
    render(
      <RecurrentTasksList
        tasks={[]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewRecurrentTask={() => {}}
      />,
    )
    fireEvent.click(screen.getByTitle('New recurrent item'))
    fireEvent.click(screen.getByRole('button', { name: 'Recurrent group' }))
    expect(screen.getByText('New recurrent group')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Chores' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(createGroupMutate).toHaveBeenCalledWith({ name: 'Chores' }, expect.anything())
  })

  it('right-click deletes a recurrent task via the same confirm flow as a normal task row', () => {
    const recurrentTask = makeTask({ id: 'r1', name: 'Water plants', is_recurrent_task: true })
    const onSelect = vi.fn()
    render(
      <RecurrentTasksList
        tasks={[recurrentTask]}
        selectedId={null}
        onSelect={onSelect}
        onOpenNewRecurrentTask={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Water plants'))
    expect(onSelect).toHaveBeenCalledWith('r1')

    fireEvent.contextMenu(screen.getByText('Water plants'))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteMutate).toHaveBeenCalledWith('r1', expect.anything())
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
        onOpenNewRecurrentTask={() => {}}
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
        onOpenNewRecurrentTask={() => {}}
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
        onOpenNewRecurrentTask={() => {}}
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
