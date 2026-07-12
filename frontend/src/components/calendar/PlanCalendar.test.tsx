import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlanCalendar from './PlanCalendar'
import { renderWithClient } from '../../test/renderWithClient'
import { makeTask } from '../../test/taskFixtures'

vi.mock('../../api/intervals', () => ({
  useIntervalsForWeek: () => ({ data: [] }),
  useCreateInterval: () => ({ mutate: vi.fn() }),
  useDeleteInterval: () => ({ mutate: vi.fn() }),
}))

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
})

describe('PlanCalendar', () => {
  it('prompts to select a leaf task when nothing is selected', () => {
    renderWithClient(<PlanCalendar selectedTask={undefined} tasksById={new Map()} />)
    expect(screen.getByText(/select a leaf task/i)).toBeInTheDocument()
  })

  it('shows a scheduling hint with the task name once a leaf task is selected', () => {
    const task = makeTask({ id: 't1', name: 'My leaf task', is_leaf: true })
    renderWithClient(
      <PlanCalendar selectedTask={task} tasksById={new Map([[task.id, task]])} />,
    )
    expect(screen.getByText('My leaf task')).toBeInTheDocument()
    expect(screen.getByText(/drag on the calendar/i)).toBeInTheDocument()
  })

  it('does not allow scheduling for a non-leaf task', () => {
    const task = makeTask({ id: 't1', name: 'A goal', is_leaf: false })
    renderWithClient(
      <PlanCalendar selectedTask={task} tasksById={new Map([[task.id, task]])} />,
    )
    expect(screen.getByText(/select a leaf task/i)).toBeInTheDocument()
  })

  it('disables Prev on the current week and enables it after navigating forward', () => {
    renderWithClient(<PlanCalendar selectedTask={undefined} tasksById={new Map()} />)

    const prevButton = screen.getByText('← Prev').closest('button')!
    expect(prevButton).toBeDisabled()

    fireEvent.click(screen.getByText('Next →'))
    expect(prevButton).not.toBeDisabled()
  })
})
