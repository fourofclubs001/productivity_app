import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimerControl from './TimerControl'
import { makeTask } from '../../test/taskFixtures'

const activeTimerMock = vi.fn()
const startMutate = vi.fn()
const stopMutate = vi.fn()

vi.mock('../../api/timer', () => ({
  useActiveTimer: () => activeTimerMock(),
  useStartTimer: () => ({ mutate: startMutate, isPending: false }),
  useStopTimer: () => ({ mutate: stopMutate, isPending: false }),
}))

beforeEach(() => {
  activeTimerMock.mockReset()
  startMutate.mockReset()
  stopMutate.mockReset()
})

describe('TimerControl (idle)', () => {
  beforeEach(() => {
    activeTimerMock.mockReturnValue({ data: null })
  })

  it('only offers leaf, not-done tasks in the picker', () => {
    const tasks = [
      makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true, state: 'backlog' }),
      makeTask({ id: 'node', name: 'Node task', is_leaf: false, state: 'backlog' }),
      makeTask({ id: 'done', name: 'Done task', is_leaf: true, state: 'done' }),
    ]
    render(<TimerControl tasks={tasks} />)

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    expect(screen.queryByText('Node task')).not.toBeInTheDocument()
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
  it('shows the tracked task and requires a mark-done choice on stop', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    activeTimerMock.mockReturnValue({
      data: { id: 'e1', task_id: 'leaf', start: new Date().toISOString(), end: null },
    })
    render(<TimerControl tasks={[task]} />)

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    expect(screen.getByText('Stop')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Stop'))
    expect(stopMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Yes, done'))
    expect(stopMutate).toHaveBeenCalledWith(true)
  })

  it('keeps the task in progress when choosing not to mark it done', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    activeTimerMock.mockReturnValue({
      data: { id: 'e1', task_id: 'leaf', start: new Date().toISOString(), end: null },
    })
    render(<TimerControl tasks={[task]} />)

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('No, keep in progress'))
    expect(stopMutate).toHaveBeenCalledWith(false)
  })
})
