import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoutinesList from './RoutinesList'
import { makeTask } from '../../test/taskFixtures'

const deleteMutate = vi.fn()

vi.mock('../../api/tasks', () => ({
  useDeleteTask: () => ({ mutate: deleteMutate }),
}))

beforeEach(() => {
  deleteMutate.mockReset()
})

describe('RoutinesList', () => {
  it('shows only routine tasks, sorted by name, and never leaks a normal task in', () => {
    const routineA = makeTask({ id: 'r1', name: 'Zebra routine', is_routine: true })
    const routineB = makeTask({ id: 'r2', name: 'Alpha routine', is_routine: true })
    const normalTask = makeTask({ id: 't1', name: 'Normal task', is_routine: false })

    render(
      <RoutinesList
        tasks={[routineA, normalTask, routineB]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewRoutine={() => {}}
      />,
    )

    const rows = screen.getAllByText(/routine$/)
    expect(rows.map((row) => row.textContent)).toEqual(['Alpha routine', 'Zebra routine'])
    expect(screen.queryByText('Normal task')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when there are no routines', () => {
    render(
      <RoutinesList tasks={[]} selectedId={null} onSelect={() => {}} onOpenNewRoutine={() => {}} />,
    )
    expect(screen.getByText(/no routines yet/i)).toBeInTheDocument()
  })

  it('the + button opens the new-routine flow', () => {
    const onOpenNewRoutine = vi.fn()
    render(
      <RoutinesList
        tasks={[]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewRoutine={onOpenNewRoutine}
      />,
    )
    fireEvent.click(screen.getByTitle('New routine'))
    expect(onOpenNewRoutine).toHaveBeenCalled()
  })

  it('right-click deletes a routine via the same confirm flow as a normal task row', () => {
    const routine = makeTask({ id: 'r1', name: 'Water plants', is_routine: true })
    const onSelect = vi.fn()
    render(
      <RoutinesList
        tasks={[routine]}
        selectedId={null}
        onSelect={onSelect}
        onOpenNewRoutine={() => {}}
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
