import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConfigDialog from './ConfigDialog'

describe('ConfigDialog', () => {
  it('renders an empty shell with a heading and a Close button', () => {
    render(<ConfigDialog onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('calls onClose when Close is clicked', () => {
    let closed = false
    render(<ConfigDialog onClose={() => (closed = true)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toBe(true)
  })
})
