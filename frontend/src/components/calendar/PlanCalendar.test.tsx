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
const useGoogleConnectionStatus = vi.fn(() => ({ data: { connected: false } }))
const useGoogleEventsForWeek = vi.fn(() => ({ data: [] as unknown[] }))
const pushIntervalToGoogleMutate = vi.fn()

vi.mock('../../api/intervals', () => ({
  useIntervalsForWeek: () => useIntervalsForWeek(),
  useCreateInterval: () => ({ mutate: vi.fn(), mutateAsync: createMutateAsync }),
  useUpdateInterval: () => ({ mutate: updateMutate, mutateAsync: updateMutateAsync }),
  useDeleteInterval: () => ({ mutate: deleteMutate }),
}))

vi.mock('../../api/google', () => ({
  useGoogleConnectionStatus: () => useGoogleConnectionStatus(),
  usePushIntervalToGoogle: () => ({ mutate: pushIntervalToGoogleMutate }),
}))

vi.mock('../../api/googleEvents', () => ({
  useGoogleEventsForWeek: () => useGoogleEventsForWeek(),
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
  pushIntervalToGoogleMutate.mockClear()
  useIntervalsForWeek.mockReturnValue({ data: [] })
  useGoogleConnectionStatus.mockReturnValue({ data: { connected: false } })
  useGoogleEventsForWeek.mockReturnValue({ data: [] })
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

  it('offers "Add to Google Calendar" for an unsynced interval once connected, and pushes it', () => {
    const task = makeTask({ id: 't1', name: 'Unsynced task', is_leaf: true })
    useGoogleConnectionStatus.mockReturnValue({ data: { connected: true } })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
          week_start: '2026-07-13',
          google_event_id: null,
        },
      ],
    })

    renderCalendar(new Map([[task.id, task]]))

    fireEvent.contextMenu(screen.getByText('Unsynced task'))
    fireEvent.click(screen.getByText('Add to Google Calendar'))

    expect(pushIntervalToGoogleMutate).toHaveBeenCalledWith('iv1', expect.any(Object))
  })

  it('does not offer "Add to Google Calendar" when disconnected', () => {
    const task = makeTask({ id: 't1', name: 'Disconnected task', is_leaf: true })
    useGoogleConnectionStatus.mockReturnValue({ data: { connected: false } })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
          week_start: '2026-07-13',
          google_event_id: null,
        },
      ],
    })

    renderCalendar(new Map([[task.id, task]]))

    fireEvent.contextMenu(screen.getByText('Disconnected task'))
    expect(screen.queryByText('Add to Google Calendar')).not.toBeInTheDocument()
  })

  it('does not offer "Add to Google Calendar" for an already-synced interval', () => {
    const task = makeTask({ id: 't1', name: 'Synced task', is_leaf: true })
    useGoogleConnectionStatus.mockReturnValue({ data: { connected: true } })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
          week_start: '2026-07-13',
          google_event_id: 'fake-event-1',
        },
      ],
    })

    renderCalendar(new Map([[task.id, task]]))

    fireEvent.contextMenu(screen.getByText('Synced task'))
    expect(screen.queryByText('Add to Google Calendar')).not.toBeInTheDocument()
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

  it('renders a cross-midnight interval as one chip per day, both wired to the same interval', () => {
    const task = makeTask({ id: 't1', name: 'Overnight task', is_leaf: true })
    useIntervalsForWeek.mockReturnValue({
      data: [
        {
          id: 'iv1',
          task_id: 't1',
          // A 30h span, fully after the fixed "now" below, guarantees
          // crossing a local midnight regardless of the test runner's
          // timezone offset while staying unlocked (fully future).
          start: '2026-07-16T10:00:00.000Z',
          end: '2026-07-17T16:00:00.000Z',
          week_start: '2026-07-13',
        },
      ],
    })
    const onOpenTask = vi.fn()

    renderCalendar(new Map([[task.id, task]]), onOpenTask)

    const chips = screen.getAllByText('Overnight task')
    expect(chips).toHaveLength(2)

    fireEvent.click(chips[0])
    expect(onOpenTask).toHaveBeenCalledWith('t1')

    fireEvent.contextMenu(chips[1])
    fireEvent.click(screen.getByText('Delete'))
    expect(deleteMutate).toHaveBeenCalledWith('iv1', expect.any(Object))
  })

  it('renders a pulled Google Calendar event read-only, with no context menu or open-task click', () => {
    useGoogleConnectionStatus.mockReturnValue({ data: { connected: true } })
    useGoogleEventsForWeek.mockReturnValue({
      data: [
        {
          id: 'ext-1',
          title: 'Dentist',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
        },
      ],
    })
    const onOpenTask = vi.fn()

    renderCalendar(new Map(), onOpenTask)

    const chip = screen.getByText('Dentist')
    fireEvent.click(chip)
    expect(onOpenTask).not.toHaveBeenCalled()

    fireEvent.contextMenu(chip)
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit time')).not.toBeInTheDocument()
  })
})
