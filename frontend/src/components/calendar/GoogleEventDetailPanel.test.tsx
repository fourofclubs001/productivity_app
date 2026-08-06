import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GoogleEventDetailPanel from './GoogleEventDetailPanel'

describe('GoogleEventDetailPanel', () => {
  it('renders title, time range, and description read-only, with no editable controls', () => {
    render(
      <GoogleEventDetailPanel
        event={{
          id: 'ext-1',
          title: 'Dentist',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
          description: 'Bring insurance card',
        }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('Bring insurance card')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows a fallback when there is no description', () => {
    render(
      <GoogleEventDetailPanel
        event={{
          id: 'ext-2',
          title: 'No description event',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
        }}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('calls onClose when Close is clicked', () => {
    let closed = false
    render(
      <GoogleEventDetailPanel
        event={{
          id: 'ext-3',
          title: 'Event',
          start: '2026-07-15T14:00:00.000Z',
          end: '2026-07-15T15:00:00.000Z',
        }}
        onClose={() => (closed = true)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(closed).toBe(true)
  })
})
