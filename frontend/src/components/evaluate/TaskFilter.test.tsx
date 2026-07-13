import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskFilter from './TaskFilter'
import { makeTask } from '../../test/taskFixtures'

describe('TaskFilter', () => {
  it('lists root tasks in Plan panel order, nested children start collapsed', () => {
    const parent = makeTask({ id: 'p', name: 'Parent goal', is_leaf: false, order: 1000, children_ids: ['leaf'] })
    const leaf = makeTask({ id: 'leaf', name: 'Child leaf', parent_ids: ['p'] })
    const other = makeTask({ id: 'other', name: 'Other root', order: 2000 })
    render(<TaskFilter tasks={[other, leaf, parent]} selectedIds={[]} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Tasks:/ }))
    expect(screen.getByText('Parent goal')).toBeInTheDocument()
    expect(screen.getByText('Other root')).toBeInTheDocument()
    expect(screen.queryByText('Child leaf')).not.toBeInTheDocument()
  })

  it('expanding a parent reveals its children, and checking a task toggles the filter', () => {
    const parent = makeTask({ id: 'p', name: 'Parent goal', is_leaf: false, children_ids: ['leaf'] })
    const leaf = makeTask({ id: 'leaf', name: 'Child leaf', parent_ids: ['p'] })
    const onChange = vi.fn()
    render(<TaskFilter tasks={[parent, leaf]} selectedIds={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Tasks:/ }))
    const toggles = screen.getAllByRole('button').filter((btn) => btn.textContent === '▸')
    fireEvent.click(toggles[0])
    expect(screen.getByText('Child leaf')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /Child leaf/i }))
    expect(onChange).toHaveBeenCalledWith(['leaf'])
  })

  it('a parent task can be selected too (backend expands it to its descendant leaves)', () => {
    const parent = makeTask({ id: 'p', name: 'Parent goal', is_leaf: false, children_ids: [] })
    const onChange = vi.fn()
    render(<TaskFilter tasks={[parent]} selectedIds={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Tasks:/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Parent goal/i }))
    expect(onChange).toHaveBeenCalledWith(['p'])
  })
})
