import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewRecurrentTaskDialog from './NewRecurrentTaskDialog'

const createMutate = vi.fn()

vi.mock('../../api/recurrentTasks', () => ({
  useCreateRecurrentTask: () => ({ mutate: createMutate, isPending: false, isError: false }),
}))

vi.mock('../../api/tasks', () => ({
  usePalette: () => ({ data: [] }),
}))

beforeEach(() => {
  createMutate.mockReset()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-23T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NewRecurrentTaskDialog', () => {
  it('auto-adjusts the end date+time to match a start moved past it, instead of a warning', () => {
    render(<NewRecurrentTaskDialog onClose={() => {}} onCreated={() => {}} />)

    // Default start/end are both on 2026-07-23 (13:00-14:00). Moving start
    // to a later date entirely puts it past the still-same-day end.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-08-10' } })
    fireEvent.change(screen.getByLabelText('Start hour'), { target: { value: '14:00' } })

    expect(screen.getByLabelText('End date')).toHaveValue('2026-08-10')
    expect(screen.getByLabelText('End hour')).toHaveValue('14:00')
    expect(screen.queryByText(/end must be after start/i)).not.toBeInTheDocument()
  })

  it('leaves the end fields alone when start is still before end', () => {
    render(<NewRecurrentTaskDialog onClose={() => {}} onCreated={() => {}} />)

    const endDateBefore = (screen.getByLabelText('End date') as HTMLInputElement).value
    const endHourBefore = (screen.getByLabelText('End hour') as HTMLInputElement).value

    // Move the start hour earlier in the same day -- still before end.
    fireEvent.change(screen.getByLabelText('Start hour'), { target: { value: '00:01' } })

    expect(screen.getByLabelText('End date')).toHaveValue(endDateBefore)
    expect(screen.getByLabelText('End hour')).toHaveValue(endHourBefore)
  })
})
