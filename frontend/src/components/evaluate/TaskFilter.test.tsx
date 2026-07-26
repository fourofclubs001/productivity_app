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

  it('groups recurrent tasks/groups under a separate "Recurrent tasks" section, never duplicated under "Tasks"', () => {
    const plain = makeTask({ id: 'plain', name: 'Plain task' })
    const group = makeTask({ id: 'grp', name: 'Weekly stuff', is_recurrent_group: true })
    const recurrent = makeTask({
      id: 'rec',
      name: 'Recurrent leaf',
      is_recurrent_task: true,
      recurrent_parent_id: 'grp',
    })
    const onChange = vi.fn()
    render(<TaskFilter tasks={[plain, group, recurrent]} selectedIds={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Tasks:/ }))
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Recurrent tasks')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Plain task/i })).toBeInTheDocument()

    // The recurrent group has no checkbox -- selecting it would send an id
    // the backend can't roll time up against. Its child starts collapsed.
    expect(screen.getByText('Weekly stuff')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Weekly stuff/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Recurrent leaf')).not.toBeInTheDocument()

    const groupToggle = screen.getAllByRole('button').find((btn) => btn.textContent === '▸')
    fireEvent.click(groupToggle!)
    expect(screen.getByRole('checkbox', { name: /Recurrent leaf/i })).toBeInTheDocument()
    // Only ever rendered once, under Recurrent tasks -- not also under Tasks.
    expect(screen.getAllByText('Recurrent leaf')).toHaveLength(1)

    fireEvent.click(screen.getByRole('checkbox', { name: /Recurrent leaf/i }))
    expect(onChange).toHaveBeenCalledWith(['rec'])
  })

  it('collapses the Tasks and Recurrent tasks sections independently', () => {
    const plain = makeTask({ id: 'plain', name: 'Plain task' })
    const recurrent = makeTask({ id: 'rec', name: 'Recurrent leaf', is_recurrent_task: true })
    render(<TaskFilter tasks={[plain, recurrent]} selectedIds={[]} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /Tasks:/ }))
    expect(screen.getByText('Plain task')).toBeInTheDocument()
    expect(screen.getByText('Recurrent leaf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Tasks'))
    expect(screen.queryByText('Plain task')).not.toBeInTheDocument()
    expect(screen.getByText('Recurrent leaf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Recurrent tasks'))
    expect(screen.queryByText('Recurrent leaf')).not.toBeInTheDocument()
  })
})
