import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTreeNode from './TaskTreeNode'
import type { DropPreview } from '../../lib/taskTree'
import { makeTask } from '../../test/taskFixtures'
import { UndoProvider } from '../../undo/UndoProvider'

const deleteMutate = vi.fn()
const keepAsBacklogMutate = vi.fn()
const markSubtreeDoneMutate = vi.fn()
const markDoneMutateAsync = vi.fn()
const revertDoneMutateAsync = vi.fn()

vi.mock('../../api/tasks', () => ({
  useDeleteTask: () => ({ mutate: deleteMutate, isPending: false }),
  useKeepAsBacklog: () => ({ mutate: keepAsBacklogMutate }),
}))

vi.mock('../../api/timer', () => ({
  useMarkSubtreeDone: () => ({ mutate: markSubtreeDoneMutate }),
  useMarkDone: () => ({ mutateAsync: markDoneMutateAsync }),
  useRevertDone: () => ({ mutateAsync: revertDoneMutateAsync }),
}))

beforeEach(() => {
  deleteMutate.mockReset()
  keepAsBacklogMutate.mockReset()
  markSubtreeDoneMutate.mockReset()
  markDoneMutateAsync.mockReset()
  revertDoneMutateAsync.mockReset()
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
  it('right-click "Mark as done" calls the bulk mutation and pushes one undo entry when leaves changed', () => {
    markSubtreeDoneMutate.mockImplementation(
      (_id: unknown, options?: { onSuccess?: (affectedIds: string[]) => void }) =>
        options?.onSuccess?.(['c1', 'c2']),
    )
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task)

    fireEvent.contextMenu(screen.getByText('Row task'))
    expect(screen.getByText('Mark as done')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Mark as done'))
    expect(markSubtreeDoneMutate).toHaveBeenCalledWith('t1', expect.any(Object))
  })

  it('does not push an undo entry when nothing was affected (already all done)', () => {
    markSubtreeDoneMutate.mockImplementation(
      (_id: unknown, options?: { onSuccess?: (affectedIds: string[]) => void }) =>
        options?.onSuccess?.([]),
    )
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task)

    fireEvent.contextMenu(screen.getByText('Row task'))
    fireEvent.click(screen.getByText('Mark as done'))

    // No undo entry was pushed -- Ctrl+Z has nothing of this action's to undo.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(revertDoneMutateAsync).not.toHaveBeenCalled()
  })

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
    expect(deleteMutate).toHaveBeenCalledWith({ id: 't1' }, expect.anything())
  })

  it('offers a just-this-task vs whole-subtree choice for a non-leaf task', () => {
    const task = makeTask({ id: 't1', name: 'Goal task', is_leaf: false, children_ids: ['c1'] })
    render(
      <UndoProvider activeView="plan">
        <TaskTreeNode
          taskId={task.id}
          tasksById={new Map([[task.id, task], ['c1', makeTask({ id: 'c1', parent_ids: ['t1'] })]])}
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
          dropPreview={null}
        />
      </UndoProvider>,
    )

    fireEvent.contextMenu(screen.getByText('Goal task'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.queryByText('Delete "Goal task" permanently?')).not.toBeInTheDocument()
    expect(screen.getByText(/It has sub-tasks/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Just this task' }))
    expect(deleteMutate).toHaveBeenCalledWith({ id: 't1', deleteChildren: false }, expect.anything())
  })

  it('"Delete whole subtree" passes deleteChildren: true', () => {
    const task = makeTask({ id: 't1', name: 'Goal task', is_leaf: false, children_ids: ['c1'] })
    render(
      <UndoProvider activeView="plan">
        <TaskTreeNode
          taskId={task.id}
          tasksById={new Map([[task.id, task], ['c1', makeTask({ id: 'c1', parent_ids: ['t1'] })]])}
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
          dropPreview={null}
        />
      </UndoProvider>,
    )

    fireEvent.contextMenu(screen.getByText('Goal task'))
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete whole subtree' }))
    expect(deleteMutate).toHaveBeenCalledWith({ id: 't1', deleteChildren: true }, expect.anything())
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
    expect(row).not.toHaveClass('ring-accent')
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
    expect(row).toHaveClass('ring-accent')
    expect(screen.queryByTestId('drop-reorder-line')).not.toBeInTheDocument()
  })

  it('shows neither the outline nor the line when this row is not the preview target', () => {
    const task = makeTask({ id: 't1', name: 'Row task' })
    renderNode(task, { overId: 'other', action: { kind: 'reparent', parentId: 'other' } })

    const row = screen.getByText('Row task').closest('.group')!
    expect(row).not.toHaveClass('ring-accent')
    expect(screen.queryByTestId('drop-reorder-line')).not.toBeInTheDocument()
  })
})
