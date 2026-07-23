import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./api/tasks', () => ({
  useTasks: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useAddParent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useRemoveParent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useReorderTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}))

vi.mock('./api/intervals', () => ({
  useIntervalsForWeek: () => ({ data: [] }),
  useCreateInterval: () => ({ mutate: vi.fn() }),
  useUpdateInterval: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteInterval: () => ({ mutate: vi.fn() }),
}))

vi.mock('./api/google', () => ({
  useGoogleConnectionStatus: () => ({ data: { connected: false } }),
  useDisconnectGoogle: () => ({ mutate: vi.fn() }),
  usePushIntervalToGoogle: () => ({ mutate: vi.fn() }),
  googleLoginUrl: () => 'http://localhost:8000/auth/google/login',
}))

vi.mock('./api/googleEvents', () => ({
  useGoogleEventsForWeek: () => ({ data: [] }),
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
