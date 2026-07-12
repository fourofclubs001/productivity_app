import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api/tasks', () => ({
  useTasks: () => ({ data: [], isLoading: false, isError: false, error: null }),
}))

vi.mock('./api/intervals', () => ({
  useIntervalsForWeek: () => ({ data: [] }),
  useCreateInterval: () => ({ mutate: vi.fn() }),
  useDeleteInterval: () => ({ mutate: vi.fn() }),
}))

describe('App', () => {
  it('renders the three view tabs and defaults to Plan', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Execute' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Evaluate' })).toBeInTheDocument()
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
  })
})
