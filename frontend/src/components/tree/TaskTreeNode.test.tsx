import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTreeNode from './TaskTreeNode'
import type { DropPreview } from '../../lib/taskTree'
import { makeTask } from '../../test/taskFixtures'
import { UndoProvider } from '../../undo/UndoProvider'

const deleteMutate = vi.fn()
const keepAsBacklogMutate = vi.fn()

vi.mock('../../api/tasks', () => ({
  useDeleteTask: () => ({ mutate: deleteMutate }),
  useKeepAsBacklog: () => ({ mutate: keepAsBacklogMutate }),
}))

beforeEach(() => {
  deleteMutate.mockReset()
  keepAsBacklogMutate.mockReset()
})

function renderNode(task: ReturnType<typeof makeTask>, dropPreview: DropPreview | null = null) {
  return render(
    <UndoProvider activeView="plan">
      <TaskTreeNode
        taskId={task.id}
        tasksById={new Map([[task.id, task]])}
        depth={0}
        selectedId={null}
        expanded={new Set()}
        ancestorPath={new Set()}
        onSelect={() => {}}
        onToggleExpand={() => {}}
        onAddChild={() => {}}
        decisions={{}}
        onDecide={() => {}}
        onUndecide={() => {}}
        dropPreview={dropPreview}
      />
    </UndoProvider>,
  )
}

describe('TaskTreeNode', () => {
  it('opens a context menu with Delete on right-click, and confirms before deleting', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task)

    expect(screen.queryByText('Delete')).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByText('Row task'))
    expect(screen.getByText('Delete')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Delete "Row task" permanently?')).toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteMutate).toHaveBeenCalledWith('t1', expect.anything())
  })

  it('dismisses the context menu on Cancel without deleting', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task)

    fireEvent.contextMenu(screen.getByText('Row task'))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Delete "Row task" permanently?')).not.toBeInTheDocument()
    expect(deleteMutate).not.toHaveBeenCalled()
  })

  it('renders a reorder-boundary line, not an outline, when the live preview resolves to reorder', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task, { overId: 't1', action: { kind: 'reorder', afterId: null, beforeId: 't1' } })

    const row = screen.getByText('Row task').closest('.group')!
    expect(row).not.toHaveClass('outline-accent')
    const line = screen.getByTestId('drop-reorder-line')
    expect(line).toHaveClass('top-0')
  })

  it('renders the boundary line at the bottom edge when reordering after this row', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task, { overId: 't1', action: { kind: 'reorder', afterId: 't1', beforeId: null } })

    expect(screen.getByTestId('drop-reorder-line')).toHaveClass('bottom-0')
  })

  it('keeps the full-row outline, with no line, when the live preview resolves to reparent', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task, { overId: 't1', action: { kind: 'reparent', parentId: 't1' } })

    const row = screen.getByText('Row task').closest('.group')!
    expect(row).toHaveClass('outline-accent')
    expect(screen.queryByTestId('drop-reorder-line')).not.toBeInTheDocument()
  })

  it('shows neither the outline nor the line when this row is not the preview target', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task, { overId: 'other', action: { kind: 'reparent', parentId: 'other' } })

    const row = screen.getByText('Row task').closest('.group')!
    expect(row).not.toHaveClass('outline-accent')
    expect(screen.queryByTestId('drop-reorder-line')).not.toBeInTheDocument()
  })
})
