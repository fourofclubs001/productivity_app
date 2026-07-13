import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimerControl from './TimerControl'
import { makeTask } from '../../test/taskFixtures'
import { UndoProvider } from '../../undo/UndoProvider'

const activeTimerMock = vi.fn()
const startMutate = vi.fn()
const stopMutate = vi.fn((_vars?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})
const markDoneMutate = vi.fn((_taskId?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})
const revertDoneMutateAsync = vi.fn()

vi.mock('../../api/timer', () => ({
  useActiveTimer: () => activeTimerMock(),
  useStartTimer: () => ({ mutate: startMutate, isPending: false }),
  useStopTimer: () => ({ mutate: stopMutate, isPending: false }),
  useMarkDone: () => ({ mutate: markDoneMutate, isPending: false }),
  useRevertDone: () => ({ mutateAsync: revertDoneMutateAsync, isPending: false }),
}))

function renderTimerControl(tasks: ReturnType<typeof makeTask>[]) {
  return render(
    <UndoProvider>
      <TimerControl tasks={tasks} />
    </UndoProvider>,
  )
}

beforeEach(() => {
  activeTimerMock.mockReset()
  startMutate.mockReset()
  stopMutate.mockClear()
  markDoneMutate.mockClear()
  revertDoneMutateAsync.mockReset()
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
    renderTimerControl(tasks)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    // Node task is a parent -- shown for navigation, but not offered as a leaf option.
    expect(screen.getByText('Node task')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Node task' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sprint done task')).not.toBeInTheDocument()
    expect(screen.queryByText('Done task')).not.toBeInTheDocument()
  })

  it('disables Start until a task is chosen, then starts the timer', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    renderTimerControl([task])

    const startButton = screen.getByText('Start')
    expect(startButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leaf task' }))
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
    renderTimerControl([task])

    expect(screen.getByText('Leaf task')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Stop'))

    // The stop call itself takes no arguments - it isn't gated on the done choice.
    expect(stopMutate).toHaveBeenCalledWith(undefined, expect.anything())
    expect(screen.getByText(/stopped/i)).toBeInTheDocument()
  })

  it('marking done after stop calls the dedicated mark-done endpoint', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    renderTimerControl([task])

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('Yes, done'))

    expect(markDoneMutate).toHaveBeenCalledWith('leaf', expect.anything())
  })

  it('choosing not to mark done makes no API call', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    renderTimerControl([task])

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('No, keep in progress'))

    expect(markDoneMutate).not.toHaveBeenCalled()
  })

  it('marking done pushes an undo entry that calls revert-done on ctrl+z', () => {
    const task = makeTask({ id: 'leaf', name: 'Leaf task', is_leaf: true })
    renderTimerControl([task])

    fireEvent.click(screen.getByText('Stop'))
    fireEvent.click(screen.getByText('Yes, done'))

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    expect(revertDoneMutateAsync).toHaveBeenCalledWith('leaf')
  })
})
