import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskTreeNode from './TaskTreeNode'
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

function renderNode(task: ReturnType<typeof makeTask>) {
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
})
