import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExecuteCalendar from './ExecuteCalendar'
import { renderWithClient } from '../../test/renderWithClient'
import { makeTask } from '../../test/taskFixtures'
import type { Task } from '../../types'

const useEntriesForWeek = vi.fn(() => ({ data: [] as unknown[] }))
const useIntervalsForWeek = vi.fn(() => ({ data: [] as unknown[] }))
const useGoogleConnectionStatus = vi.fn(() => ({ data: { connected: false } }))
const useGoogleEventsForWeek = vi.fn((_weekStart: string, _enabled: boolean) => ({
  data: [] as unknown[],
}))

vi.mock('../../api/timer', () => ({
  useEntriesForWeek: () => useEntriesForWeek(),
}))

vi.mock('../../api/intervals', () => ({
  useIntervalsForWeek: () => useIntervalsForWeek(),
}))

vi.mock('../../api/google', () => ({
  useGoogleConnectionStatus: () => useGoogleConnectionStatus(),
}))

vi.mock('../../api/googleEvents', () => ({
  useGoogleEventsForWeek: (weekStart: string, enabled: boolean) =>
    useGoogleEventsForWeek(weekStart, enabled),
}))

function renderCalendar(tasksById: Map<string, Task> = new Map()) {
  return renderWithClient(<ExecuteCalendar tasksById={tasksById} />)
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))
  useEntriesForWeek.mockReturnValue({ data: [] })
  useIntervalsForWeek.mockReturnValue({ data: [] })
  useGoogleConnectionStatus.mockReturnValue({ data: { connected: false } })
  useGoogleEventsForWeek.mockReturnValue({ data: [] })
})

describe('ExecuteCalendar', () => {
  it('renders a pulled Google Calendar event alongside tracked/planned time', () => {
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

    renderCalendar()

    expect(screen.getByText('Dentist')).toBeInTheDocument()
  })

  it('does not fetch Google events while disconnected', () => {
    renderCalendar(new Map([['t1', makeTask({ id: 't1' })]]))
    expect(useGoogleEventsForWeek).toHaveBeenCalledWith(expect.any(String), false)
  })
})
