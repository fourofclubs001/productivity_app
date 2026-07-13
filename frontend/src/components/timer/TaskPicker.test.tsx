import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskPicker from './TaskPicker'
import { makeTask } from '../../test/taskFixtures'

describe('TaskPicker', () => {
  it('shows a placeholder until a task is selected, then shows its name', () => {
    const leaf = makeTask({ id: 'leaf', name: 'Leaf task' })
    const onSelect = vi.fn()
    const { rerender } = render(<TaskPicker tasks={[leaf]} selectedId="" onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Select a task…' })).toBeInTheDocument()

    rerender(<TaskPicker tasks={[leaf]} selectedId="leaf" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Leaf task' })).toBeInTheDocument()
  })

  it('lists leaves in Plan panel order and selects one on click', () => {
    const b = makeTask({ id: 'b', name: 'B task', order: 2000 })
    const a = makeTask({ id: 'a', name: 'A task', order: 1000 })
    const onSelect = vi.fn()
    render(<TaskPicker tasks={[b, a]} selectedId="" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    const options = screen.getAllByRole('button', { name: /task$/ })
    expect(options.map((el) => el.textContent)).toEqual(['A task', 'B task'])

    fireEvent.click(screen.getByRole('button', { name: 'A task' }))
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('falls back to the placeholder once the selected task is no longer selectable', () => {
    const leaf = makeTask({ id: 'leaf', name: 'Leaf task', state: 'sprint_done' })
    render(<TaskPicker tasks={[leaf]} selectedId="leaf" onSelect={() => {}} />)

    expect(screen.getByRole('button', { name: 'Select a task…' })).toBeInTheDocument()
  })

  it('excludes sprint_done and done leaves entirely', () => {
    const active = makeTask({ id: 'active', name: 'Active leaf', state: 'backlog' })
    const sprintDone = makeTask({ id: 'sd', name: 'Sprint done leaf', state: 'sprint_done' })
    const done = makeTask({ id: 'done', name: 'Done leaf', state: 'done' })
    render(<TaskPicker tasks={[active, sprintDone, done]} selectedId="" onSelect={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByText('Active leaf')).toBeInTheDocument()
    expect(screen.queryByText('Sprint done leaf')).not.toBeInTheDocument()
    expect(screen.queryByText('Done leaf')).not.toBeInTheDocument()
  })

  it('shows parent rows for navigation but they are not selectable, and expand reveals children', () => {
    const parent = makeTask({ id: 'p', name: 'Parent goal', is_leaf: false, children_ids: ['leaf'] })
    const leaf = makeTask({ id: 'leaf', name: 'Child leaf', parent_ids: ['p'] })
    const onSelect = vi.fn()
    render(<TaskPicker tasks={[parent, leaf]} selectedId="" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByText('Parent goal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Parent goal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Child leaf')).not.toBeInTheDocument()

    // Expand the parent via its chevron toggle to reveal the leaf.
    const toggles = screen.getAllByRole('button')
    const expandToggle = toggles.find((btn) => btn.textContent === '▸')
    expect(expandToggle).toBeDefined()
    fireEvent.click(expandToggle!)

    expect(screen.getByText('Child leaf')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Child leaf' }))
    expect(onSelect).toHaveBeenCalledWith('leaf')
  })
})
