import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConfigButton from './ConfigButton'

describe('ConfigButton', () => {
  it('opens the Configuration dialog on click and closes it on Close', () => {
    render(<ConfigButton />)

    expect(screen.queryByText('Configuration')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Configuration' }))
    expect(screen.getByText('Configuration')).toBeInTheDocument()
    expect(screen.getByText('No settings yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument()
  })
})
