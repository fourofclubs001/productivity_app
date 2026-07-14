import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AlertDialog from './AlertDialog'

describe('AlertDialog', () => {
  it('renders the message', () => {
    render(<AlertDialog message="Something went wrong" onClose={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('calls onClose when OK is clicked', () => {
    const onClose = vi.fn()
    render(<AlertDialog message="Blocked" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
