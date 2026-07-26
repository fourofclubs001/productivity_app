import { useState } from 'react'
import ConfigDialog from './ConfigDialog'

export default function ConfigButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title="Configuration"
        aria-label="Configuration"
        onClick={() => setOpen(true)}
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        ⚙
      </button>
      {open && <ConfigDialog onClose={() => setOpen(false)} />}
    </>
  )
}
