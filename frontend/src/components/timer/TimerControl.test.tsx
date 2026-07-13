import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimerControl from './TimerControl'
import { makeTask } from '../../test/taskFixtures'

const activeTimerMock = vi.fn()
const startMutate = vi.fn()
const stopMutate = vi.fn((_vars?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})
const markDoneMutate = vi.fn((_taskId?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})

vi.mock('../../api/timer', () => ({
  useActiveTimer: () => activeTimerMock(),
  useStartTimer: () => ({ mutate: startMutate, isPending: false }),
  useStopTimer: () => ({ mutate: stopMutate, isPending: false }),
  useMarkDone: () => ({ mutate: markDoneMutate, isPending: false }),
}))

beforeEach(() => {
  activeTimerMock.mockReset()
  startMutate.mockReset()
  stopMutate.mockClear()
  markDoneMutate.mockClear()
})

describe('TimerControl (idle)', () => {
  beforeEach(() => {
    activeTimerMock.mockReturnValue({ data: null })
  })

  it('only offers leaf tasks that are not sprint_done or done', () => {
    const tasks = [
      makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true, state: 'backlog' }),
      makeTask({ id: 'node', name: 'Node task', is_leaf: false, state: 'backlog' }),
      makeTask({ id: 'sprint-done', name: 'Sprint done task', is_leaf: true, state: 'sprint_done' }),
      makeTask({ id: 'done', name: 'Done task', is_leaf: true, state: 'done' }),
    ]
    render(<TimerControl tasks={tasks} />)

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    expect(screen.queryByText('Node task')).not.toBeInTheDocument()
    expect(screen.queryByText('Sprint done task')).not.toBeInTheDocument()
    expect(screen.queryByText('Done task')).not.toBeInTheDocument()
  })

  it('disables Start until a task is chosen, then starts the timer', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    render(<TimerControl tasks={[task]} />)

    const startButton = screen.getByText('Start')
    expect(startButton).toBeDisabled()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'leaf' } })
    expect(startButton).not.toBeDisabled()

    fireEvent.click(startButton)
    expect(startMutate).toHaveBeenCalledWith('leaf')
  })
})

describe('TimerControl (active)', () => {
  beforeEach(() => {
    activeTimerMock.mockReturnValue({
      data: { id: 'e1', task_id: 'leaf', start: new Date().toISOString(), end: null },
    })
  })

  it('stops the timer immediately on click, before any mark-done choice', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    render(<TimerControl tasks={[task]} />)

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Stop'))

    // The stop call itself takes no arguments - it isn't gated on the done choice.
    expect(stopMutate).toHaveBeenCalledWith(undefined, expect.anything())
    expect(screen.getByText(/stopped/i)).toBeInTheDocument()
  })

  it('marking done after stop calls the dedicated mark-done endpoint', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    render(<TimerControl tasks={[task]} />)

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('Yes, done'))

    expect(markDoneMutate).toHaveBeenCalledWith('leaf', expect.anything())
  })

  it('choosing not to mark done makes no API call', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    render(<TimerControl tasks={[task]} />)

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('No, keep in progress'))

    expect(markDoneMutate).not.toHaveBeenCalled()
  })
})
