import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlanCalendar from './PlanCalendar'
import { renderWithClient } from '../../test/renderWithClient'
import { makeTask } from '../../test/taskFixtures'
import type { Task } from '../../types'

const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const createMutateAsync = vi.fn().mockResolvedValue(undefined)
const updateMutate = vi.fn()
const updateMutateAsync = vi.fn().mockResolvedValue(undefined)
const useIntervalsForWeek = vi.fn(() => ({ data: [] as unknown[] }))

vi.mock('../../api/intervals', () => ({
  useIntervalsForWeek: () => useIntervalsForWeek(),
  useCreateInterval: () => ({ mutate: vi.fn(), mutateAsync: createMutateAsync }),
  useUpdateInterval: () => ({ mutate: updateMutate, mutateAsync: updateMutateAsync }),
  useDeleteInterval: () => ({ mutate: deleteMutate }),
}))

function renderCalendar(tasksById: Map<string, Task>, onOpenTask: (taskId: string) => void = vi.fn()) {
  return renderWithClient(<PlanCalendar tasksById={tasksById} onOpenTask={onOpenTask} />)
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
  deleteMutate.mockClear()
  createMutateAsync.mockClear()
  updateMutate.mockClear()
  updateMutateAsync.mockClear()
  useIntervalsForWeek.mockReturnValue({ data: [] })
})

describe('PlanCalendar', () => {
  it('shows a hint to drag a task here to schedule it', () => {
    renderCalendar(new Map())
    expect(screen.getByText(/drag a task here to schedule it/i)).toBeInTheDocument()
  })

  it('disables Prev on the current week and enables it after navigating forward', () => {
    renderCalendar(new Map())

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
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
          week_start: '2026-07-13',
        },
      ],
    })

    renderCalendar(new Map([[task.id, task]]))

    fireEvent.contextMenu(screen.getByText('Scheduled task'))
    fireEvent.click(screen.getByText('Delete'))

    expect(deleteMutate).toHaveBeenCalledWith('iv1', expect.any(Object))

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(createMutateAsync).toHaveBeenCalledWith({
      task_id: 't1',
      start: '2026-07-15T14:00:00.000Z',
      end: '2026-07-15T15:00:00.000Z',
    })
  })

  it('blocks right-click deleting a past interval, showing a dialog instead', () => {
    const task = makeTask({ id: 't1', name: 'Past task', is_leaf: true })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-15T09:00:00.000Z',
          end: '2026-07-15T10:00:00.000Z',
          week_start: '2026-07-13',
        },
      ],
    })

    renderCalendar(new Map([[task.id, task]]))

    fireEvent.contextMenu(screen.getByText('Past task'))
    fireEvent.click(screen.getByText('Delete'))

    expect(screen.getByText(/can no longer be deleted/i)).toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()
  })

  it('opens the task detail view when a scheduled event is left-clicked', () => {
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
    const onOpenTask = vi.fn()

    renderCalendar(new Map([[task.id, task]]), onOpenTask)

    fireEvent.click(screen.getByText('Scheduled task'))
    expect(onOpenTask).toHaveBeenCalledWith('t1')
  })
})
