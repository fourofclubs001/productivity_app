import { useState } from 'react'
import { googleLoginUrl, useDisconnectGoogle, useGoogleConnectionStatus } from '../../api/google'
import ConfirmDialog from '../common/ConfirmDialog'

export default function GoogleConnectButton() {
  const { data: status } = useGoogleConnectionStatus()
  const disconnectGoogle = useDisconnectGoogle()
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  if (!status?.connected) {
    return (
      <a
        href={googleLoginUrl()}
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        Connect Google Calendar
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmingDisconnect(true)}
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-accent hover:text-accent-hover"
      >
        Google Calendar connected
      </button>
      {confirmingDisconnect && (
        <ConfirmDialog
          message="Disconnect Google Calendar? Already-synced events will stay on your Google Calendar, but new Plan events will stop syncing."
          confirmLabel="Disconnect"
          onCancel={() => setConfirmingDisconnect(false)}
          onConfirm={() => {
            disconnectGoogle.mutate(undefined, { onSuccess: () => setConfirmingDisconnect(false) })
          }}
        />
      )}
    </>
  )
}
