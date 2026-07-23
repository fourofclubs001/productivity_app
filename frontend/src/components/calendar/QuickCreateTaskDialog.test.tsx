import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuickCreateTaskDialog from './QuickCreateTaskDialog'

const createTaskMutate = vi.fn(
  (_input?: unknown, options?: { onSuccess?: (task: { id: string }) => void }) => {
    options?.onSuccess?.({ id: 'new-task-id' })
  },
)
const createIntervalMutate = vi.fn()

vi.mock('../../api/tasks', () => ({
  useCreateTask: () => ({ mutate: createTaskMutate, isPending: false }),
}))

vi.mock('../../api/intervals', () => ({
  useCreateInterval: () => ({ mutate: createIntervalMutate, isPending: false }),
}))

beforeEach(() => {
  createTaskMutate.mockClear()
  createIntervalMutate.mockClear()
})

describe('QuickCreateTaskDialog', () => {
  it('creates the task first, then schedules an interval for the dragged range with its id', () => {
    const range = { start: new Date('2027-03-01T14:00:00Z'), end: new Date('2027-03-01T15:00:00Z') }
    render(<QuickCreateTaskDialog range={range} onClose={() => {}} onCreated={() => {}} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water plants' } })
    fireEvent.change(screen.getByLabelText('Definition of done'), {
      target: { value: 'Soil is moist' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(createTaskMutate).toHaveBeenCalledWith(
      { name: 'Water plants', definition_of_done: 'Soil is moist' },
      expect.anything(),
    )
    expect(createIntervalMutate).toHaveBeenCalledWith(
      {
        task_id: 'new-task-id',
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },
      expect.anything(),
    )
  })

  it('disables Create until both name and definition of done are filled', () => {
    const range = { start: new Date(), end: new Date() }
    render(<QuickCreateTaskDialog range={range} onClose={() => {}} onCreated={() => {}} />)

    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Water plants' } })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Definition of done'), { target: { value: 'done' } })
    expect(createButton).not.toBeDisabled()
  })
})
