import { useState } from 'react'
import Button from '../common/Button'
import { Settings } from '../common/icons'
import ConfigDialog from './ConfigDialog'

export default function ConfigButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="icon"
        title="Configuration"
        aria-label="Configuration"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-[18px] w-[18px]" />
      </Button>
      {open && <ConfigDialog onClose={() => setOpen(false)} />}
    </>
  )
}
