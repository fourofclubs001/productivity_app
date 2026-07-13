import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskTree from './TaskTree'
import { renderWithClient } from '../../test/renderWithClient'
import { makeTask } from '../../test/taskFixtures'

describe('TaskTree', () => {
  it('shows an empty state when there are no tasks', () => {
    renderWithClient(
      <TaskTree tasks={[]} selectedId={null} onSelect={() => {}} onOpenNewTask={() => {}} />,
    )
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
  })

  it('renders root tasks collapsed, expanding on chevron click', () => {
    const parent = makeTask({ id: 'p', name: 'Parent', is_leaf: false, children_ids: ['c'] })
    const child = makeTask({ id: 'c', name: 'Child', parent_ids: ['p'] })
    renderWithClient(
      <TaskTree
        tasks={[parent, child]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewTask={() => {}}
      />,
    )

    expect(screen.getByText('Parent')).toBeInTheDocument()
    expect(screen.queryByText('Child')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('▸'))
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('renders a shared child under each of its parents (DAG, not a tree)', () => {
    const parentA = makeTask({ id: 'a', name: 'A', is_leaf: false, children_ids: ['c'] })
    const parentB = makeTask({ id: 'b', name: 'B', is_leaf: false, children_ids: ['c'] })
    const child = makeTask({ id: 'c', name: 'Shared child', parent_ids: ['a', 'b'] })
    renderWithClient(
      <TaskTree
        tasks={[parentA, parentB, child]}
        selectedId={null}
        onSelect={() => {}}
        onOpenNewTask={() => {}}
      />,
    )

    fireEvent.click(screen.getAllByText('▸')[0])
    fireEvent.click(screen.getAllByText('▸')[0])

    expect(screen.getAllByText('Shared child')).toHaveLength(2)
  })

  it('calls onSelect with the task id when a row is clicked', () => {
    const onSelect = vi.fn()
    const task = makeTask({ id: 't', name: 'Solo task' })
    renderWithClient(
      <TaskTree tasks={[task]} selectedId={null} onSelect={onSelect} onOpenNewTask={() => {}} />,
    )

    fireEvent.click(screen.getByText('Solo task'))
    expect(onSelect).toHaveBeenCalledWith('t')
  })
})
