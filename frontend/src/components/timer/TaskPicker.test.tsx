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

  it('shows a colored dot for a task with an effective color, for both selectable and non-selectable rows', () => {
    const leaf = makeTask({ id: 'leaf', name: 'Red leaf', effective_colors: ['red'] })
    const goal = makeTask({
      id: 'goal',
      name: 'Blue goal',
      is_leaf: false,
      effective_colors: ['blue'],
    })
    render(<TaskPicker tasks={[leaf, goal]} selectedId="" onSelect={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByTitle('red')).toBeInTheDocument()
    expect(screen.getByTitle('blue')).toBeInTheDocument()
  })

  it('hides a goal whose every leaf descendant is done', () => {
    const doneGoal = makeTask({ id: 'g1', name: 'Done goal', is_leaf: false, state: 'done' })
    render(<TaskPicker tasks={[doneGoal]} selectedId="" onSelect={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.queryByText('Done goal')).not.toBeInTheDocument()
  })

  it('keeps a goal visible while it still has an unfinished descendant (its state stays in_progress/backlog)', () => {
    const goal = makeTask({ id: 'g1', name: 'Active goal', is_leaf: false, state: 'in_progress' })
    render(<TaskPicker tasks={[goal]} selectedId="" onSelect={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByText('Active goal')).toBeInTheDocument()
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

  it('groups recurrent tasks/groups under a separate "Recurrent tasks" section, never duplicated under "Tasks"', () => {
    const plain = makeTask({ id: 'plain', name: 'Plain task' })
    const group = makeTask({ id: 'grp', name: 'Weekly stuff', is_recurrent_group: true })
    const recurrent = makeTask({
      id: 'rec',
      name: 'Recurrent leaf',
      is_recurrent_task: true,
      recurrent_parent_id: 'grp',
    })
    const onSelect = vi.fn()
    render(<TaskPicker tasks={[plain, group, recurrent]} selectedId="" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Recurrent tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plain task' })).toBeInTheDocument()

    // The recurrent group is a non-selectable header; its child recurrent
    // task starts collapsed until the group is expanded.
    expect(screen.getByText('Weekly stuff')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Weekly stuff' })).not.toBeInTheDocument()
    expect(screen.queryByText('Recurrent leaf')).not.toBeInTheDocument()

    const groupToggle = screen.getAllByRole('button').find((btn) => btn.textContent === '▸')
    fireEvent.click(groupToggle!)
    expect(screen.getByRole('button', { name: 'Recurrent leaf' })).toBeInTheDocument()
    // Only ever rendered once, under Recurrent tasks -- not also under Tasks.
    expect(screen.getAllByText('Recurrent leaf')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Recurrent leaf' }))
    expect(onSelect).toHaveBeenCalledWith('rec')
  })

  it('collapses the Tasks and Recurrent tasks sections independently', () => {
    const plain = makeTask({ id: 'plain', name: 'Plain task' })
    const recurrent = makeTask({ id: 'rec', name: 'Recurrent leaf', is_recurrent_task: true })
    render(<TaskPicker tasks={[plain, recurrent]} selectedId="" onSelect={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select a task…' }))
    expect(screen.getByText('Plain task')).toBeInTheDocument()
    expect(screen.getByText('Recurrent leaf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Tasks'))
    expect(screen.queryByText('Plain task')).not.toBeInTheDocument()
    expect(screen.getByText('Recurrent leaf')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Recurrent tasks'))
    expect(screen.queryByText('Recurrent leaf')).not.toBeInTheDocument()
  })

  it('keeps a selected recurrent task visible in the trigger label', () => {
    const recurrent = makeTask({ id: 'rec', name: 'Recurrent leaf', is_recurrent_task: true })
    const { rerender } = render(<TaskPicker tasks={[recurrent]} selectedId="" onSelect={() => {}} />)

    rerender(<TaskPicker tasks={[recurrent]} selectedId="rec" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Recurrent leaf' })).toBeInTheDocument()
  })
})
