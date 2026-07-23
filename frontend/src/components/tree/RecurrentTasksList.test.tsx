import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecurrentTasksList from './RecurrentTasksList'
import { makeTask } from '../../test/taskFixtures'

const deleteMutate = vi.fn()

vi.mock('../../api/tasks', () => ({
  useDeleteTask: () => ({ mutate: deleteMutate }),
}))

beforeEach(() => {
  deleteMutate.mockReset()
})

describe('RecurrentTasksList', () => {
  it('shows only recurrent tasks, sorted by name, and never leaks a normal task in', () => {
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

  it('the + button opens the new-recurrent-task flow', () => {
    const onOpenNewRecurrentTask = vi.fn()
    render(
      <RecurrentTasksList
        tasks={[]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewRecurrentTask={onOpenNewRecurrentTask}
      />,
    )
    fireEvent.click(screen.getByTitle('New recurrent task'))
    expect(onOpenNewRecurrentTask).toHaveBeenCalled()
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
})
