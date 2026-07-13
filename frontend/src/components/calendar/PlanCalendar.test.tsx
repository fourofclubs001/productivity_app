import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlanCalendar from './PlanCalendar'
import { renderWithClient } from '../../test/renderWithClient'
import { makeTask } from '../../test/taskFixtures'

const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const createMutateAsync = vi.fn().mockResolvedValue(undefined)
const useIntervalsForWeek = vi.fn(() => ({ data: [] as unknown[] }))

vi.mock('../../api/intervals', () => ({
  useIntervalsForWeek: () => useIntervalsForWeek(),
  useCreateInterval: () => ({ mutate: vi.fn(), mutateAsync: createMutateAsync }),
  useDeleteInterval: () => ({ mutate: deleteMutate }),
}))

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
  deleteMutate.mockClear()
  createMutateAsync.mockClear()
  useIntervalsForWeek.mockReturnValue({ data: [] })
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

  it('deletes a scheduled interval via right-click, and ctrl+z restores it', () => {
    const task = makeTask({ id: 't1', name: 'Scheduled task', is_leaf: true })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-15T10:00:00.000Z',
          end: '2026-07-15T11:00:00.000Z',
          week_start: '2026-07-13',
        },
      ],
    })

    renderWithClient(
      <PlanCalendar selectedTask={undefined} tasksById={new Map([[task.id, task]])} />,
    )

    fireEvent.contextMenu(screen.getByText('Scheduled task'))
    fireEvent.click(screen.getByText('Delete'))

    expect(deleteMutate).toHaveBeenCalledWith('iv1', expect.any(Object))

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(createMutateAsync).toHaveBeenCalledWith({
      task_id: 't1',
      start: '2026-07-15T10:00:00.000Z',
      end: '2026-07-15T11:00:00.000Z',
    })
  })
})
