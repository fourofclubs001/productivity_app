import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExplainGapDialog from './ExplainGapDialog'

const attachMutate = vi.fn()
const useExcuses = vi.fn(() => ({ data: [] as { id: string; text: string }[] }))

vi.mock('../../api/excuses', () => ({
  useExcuses: () => useExcuses(),
  useAttachExcuse: () => ({ mutate: attachMutate, isPending: false }),
}))

const START = new Date('2026-07-20T10:00:00Z')
const END = new Date('2026-07-20T11:00:00Z')

function renderDialog(onClose = vi.fn()) {
  render(
    <ExplainGapDialog
      taskId="t1"
      taskName="Solo task"
      intervalId="iv1"
      start={START}
      end={END}
      onClose={onClose}
    />,
  )
  return onClose
}

beforeEach(() => {
  attachMutate.mockReset()
  useExcuses.mockReturnValue({ data: [] })
})

describe('ExplainGapDialog', () => {
  it('disables Save until an excuse is picked or typed', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Or type a new one'), {
      target: { value: 'Got distracted' },
    })
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('submits new_excuse_text when a new excuse is typed', () => {
    const onClose = renderDialog()
    fireEvent.change(screen.getByLabelText('Or type a new one'), {
      target: { value: 'Got distracted' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(attachMutate).toHaveBeenCalledWith(
      {
        task_id: 't1',
        interval_id: 'iv1',
        start: START.toISOString(),
        end: END.toISOString(),
        excuse_id: undefined,
        new_excuse_text: 'Got distracted',
      },
      expect.any(Object),
    )

    const options = attachMutate.mock.calls[0][1]
    options.onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('submits excuse_id when an existing excuse is picked, clearing the typed text', () => {
    useExcuses.mockReturnValue({ data: [{ id: 'ex1', text: 'Meeting ran over' }] })
    renderDialog()

    fireEvent.change(screen.getByLabelText('Or type a new one'), { target: { value: 'draft' } })
    fireEvent.change(screen.getByLabelText('Pick an existing excuse'), {
      target: { value: 'ex1' },
    })
    expect(screen.getByLabelText('Or type a new one')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(attachMutate).toHaveBeenCalledWith(
      expect.objectContaining({ excuse_id: 'ex1', new_excuse_text: undefined }),
      expect.any(Object),
    )
  })

  it('shows an AlertDialog with the error message on failure', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Or type a new one'), {
      target: { value: 'Got distracted' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const options = attachMutate.mock.calls[0][1]
    act(() => options.onError(new Error('Task not found')))

    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })
})
