import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluateCalendar from './EvaluateCalendar'
import { makeTask } from '../../test/taskFixtures'
import type { Entry, Interval, Task } from '../../types'

// Noon UTC keeps this comfortably inside the same calendar day even in a
// negative-UTC-offset local timezone (e.g. the -03:00 this suite runs
// under), avoiding a local-midnight shift that would land react-big-calendar
// on the wrong week.
const WEEK_ANCHOR = new Date('2026-07-20T12:00:00Z')

// Excuses can only be attached to fully-past gaps (v03 item 9) -- pin "now"
// to the day after INTERVAL/PARTIAL_ENTRY below so their fixed fixture
// times stay unambiguously past regardless of real wall-clock drift.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-21T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

const INTERVAL: Interval = {
  id: 'iv1',
  task_id: 't1',
  start: '2026-07-20T09:00:00.000Z',
  end: '2026-07-20T11:00:00.000Z',
  week_start: '2026-07-20',
  task_name: null,
  google_event_id: null,
}

// Covers the first half of the planned interval, leaving 10:00-11:00 uncovered.
const PARTIAL_ENTRY: Entry = {
  id: 'e1',
  task_id: 't1',
  start: '2026-07-20T09:00:00.000Z',
  end: '2026-07-20T10:00:00.000Z',
  task_name: null,
}

function renderCalendar(
  mode: 'planned' | 'real' | 'diff',
  intervals: Interval[],
  entries: Entry[],
  onExplainGap = vi.fn(),
) {
  const tasksById = new Map<string, Task>([['t1', makeTask({ id: 't1', name: 'Solo task' })]])
  render(
    <EvaluateCalendar
      mode={mode}
      weekAnchor={WEEK_ANCHOR}
      intervals={intervals}
      entries={entries}
      tasksById={tasksById}
      onExplainGap={onExplainGap}
    />,
  )
  return onExplainGap
}

describe('EvaluateCalendar diff mode', () => {
  it('prefers the snapshotted task_name over a live (or missing) task lookup', () => {
    const snapshotted: Interval = { ...INTERVAL, task_id: 'deleted-task', task_name: 'Deleted task' }
    render(
      <EvaluateCalendar
        mode="planned"
        weekAnchor={WEEK_ANCHOR}
        intervals={[snapshotted]}
        entries={[]}
        tasksById={new Map()}
      />,
    )

    expect(screen.getByText('Deleted task')).toBeInTheDocument()
    expect(screen.queryByText('Unknown task')).not.toBeInTheDocument()
  })

  it('splits a partially-covered planned interval into a covered and an uncovered segment', () => {
    renderCalendar('diff', [INTERVAL], [PARTIAL_ENTRY])

    expect(screen.getByTestId('event-covered')).toBeInTheDocument()
    expect(screen.getByTestId('event-uncovered')).toBeInTheDocument()
    expect(screen.getByTestId('event-real')).toBeInTheDocument()
  })

  it('does not call onExplainGap for a still-future uncovered segment (nothing missed yet)', () => {
    const futureInterval: Interval = {
      ...INTERVAL,
      id: 'iv-future',
      start: '2026-07-22T09:00:00.000Z',
      end: '2026-07-22T11:00:00.000Z',
    }
    const onExplainGap = renderCalendar('diff', [futureInterval], [])

    fireEvent.click(screen.getByTestId('event-uncovered'))

    expect(onExplainGap).not.toHaveBeenCalled()
  })

  it('calls onExplainGap with the right params when the uncovered segment is clicked', () => {
    const onExplainGap = renderCalendar('diff', [INTERVAL], [PARTIAL_ENTRY])

    fireEvent.click(screen.getByTestId('event-uncovered'))

    expect(onExplainGap).toHaveBeenCalledWith({
      taskId: 't1',
      intervalId: 'iv1',
      start: new Date('2026-07-20T10:00:00.000Z'),
      end: new Date('2026-07-20T11:00:00.000Z'),
    })
  })

  it('does not call onExplainGap when the covered segment is clicked', () => {
    const onExplainGap = renderCalendar('diff', [INTERVAL], [PARTIAL_ENTRY])

    fireEvent.click(screen.getByTestId('event-covered'))

    expect(onExplainGap).not.toHaveBeenCalled()
  })

  it('does not call onExplainGap when a fully-covered interval is clicked', () => {
    const fullEntry: Entry = { ...PARTIAL_ENTRY, end: '2026-07-20T11:00:00.000Z' }
    const onExplainGap = renderCalendar('diff', [INTERVAL], [fullEntry])

    expect(screen.queryByTestId('event-uncovered')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('event-covered'))
    expect(onExplainGap).not.toHaveBeenCalled()
  })
})

describe('EvaluateCalendar planned/real modes', () => {
  it('renders planned mode without crashing or firing onExplainGap on click', () => {
    const onExplainGap = renderCalendar('planned', [INTERVAL], [PARTIAL_ENTRY])

    fireEvent.click(screen.getByText('Solo task'))
    expect(onExplainGap).not.toHaveBeenCalled()
  })

  it('renders real mode without crashing or firing onExplainGap on click', () => {
    const onExplainGap = renderCalendar('real', [INTERVAL], [PARTIAL_ENTRY])

    fireEvent.click(screen.getByText('Solo task'))
    expect(onExplainGap).not.toHaveBeenCalled()
  })
})
