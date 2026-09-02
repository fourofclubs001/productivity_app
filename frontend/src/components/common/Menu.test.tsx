import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Menu from './Menu'

const items = [
  { label: 'Edit', onSelect: vi.fn() },
  { label: 'Delete', onSelect: vi.fn(), danger: true },
]

describe('Menu', () => {
  it('renders a menu and fires onSelect + onClose on click', () => {
    const onClose = vi.fn()
    render(<Menu x={10} y={10} items={items} onClose={onClose} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(items[0].onSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Menu x={10} y={10} items={items} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the danger item', () => {
    render(<Menu x={10} y={10} items={items} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('text-danger')
  })
})
