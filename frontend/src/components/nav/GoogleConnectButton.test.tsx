import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoogleConnectButton from './GoogleConnectButton'

const statusMock = vi.fn()
const disconnectMutate = vi.fn((_vars?: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.()
})

vi.mock('../../api/google', () => ({
  useGoogleConnectionStatus: () => statusMock(),
  useDisconnectGoogle: () => ({ mutate: disconnectMutate, isPending: false }),
  googleLoginUrl: () => 'http://localhost:8000/auth/google/login',
}))

beforeEach(() => {
  statusMock.mockReset()
  disconnectMutate.mockClear()
})

describe('GoogleConnectButton (disconnected)', () => {
  it('shows a connect link pointing at the backend login endpoint', () => {
    statusMock.mockReturnValue({ data: { connected: false } })
    render(<GoogleConnectButton />)

    const link = screen.getByRole('link', { name: 'Connect Google Calendar' })
    expect(link).toHaveAttribute('href', 'http://localhost:8000/auth/google/login')
  })
})

describe('GoogleConnectButton (connected)', () => {
  beforeEach(() => {
    statusMock.mockReturnValue({ data: { connected: true } })
  })

  it('shows a connected indicator and disconnects after confirming', () => {
    render(<GoogleConnectButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Google Calendar connected' }))
    expect(screen.getByText(/Disconnect Google Calendar\?/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(disconnectMutate).toHaveBeenCalled()
  })

  it('closing the confirm dialog without confirming does not disconnect', () => {
    render(<GoogleConnectButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Google Calendar connected' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText(/Disconnect Google Calendar\?/)).not.toBeInTheDocument()
    expect(disconnectMutate).not.toHaveBeenCalled()
  })
})
