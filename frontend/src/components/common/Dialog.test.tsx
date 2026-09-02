import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Dialog from './Dialog'
import Button from './Button'

describe('Dialog', () => {
  it('renders title, body and footer with dialog semantics', () => {
    render(
      <Dialog onClose={vi.fn()} title="Delete task" footer={<Button>OK</Button>}>
        <p>Are you sure?</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Delete task')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })

  it('closes on Escape when dismissible', () => {
    const onClose = vi.fn()
    render(
      <Dialog onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on Escape when not dismissible', () => {
    const onClose = vi.fn()
    render(
      <Dialog onClose={onClose} dismissible={false}>
        <p>body</p>
      </Dialog>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on scrim mousedown but not on panel mousedown', () => {
    const onClose = vi.fn()
    render(
      <Dialog onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )
    fireEvent.mouseDown(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
