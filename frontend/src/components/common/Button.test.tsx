import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Button from './Button'

describe('Button', () => {
  it('defaults to a primary, non-submitting button', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn.className).toContain('bg-accent')
  })

  it('applies the requested variant and size', () => {
    render(
      <Button variant="danger" size="sm">
        Delete
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-danger')
    expect(btn.className).toContain('h-7')
  })

  it('renders the icon variant as a square', () => {
    render(
      <Button variant="icon" aria-label="Options">
        x
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Options' }).className).toContain('w-8')
  })

  it('does not fire onClick while disabled', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
