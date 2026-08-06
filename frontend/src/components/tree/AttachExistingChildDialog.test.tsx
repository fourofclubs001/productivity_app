import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AttachExistingChildDialog from './AttachExistingChildDialog'
import { makeTask } from '../../test/taskFixtures'
import { UndoProvider } from '../../undo/UndoProvider'

function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(<UndoProvider activeView="plan">{ui}</UndoProvider>)
}

const addParentMutate = vi.fn()
const addParentMutateAsync = vi.fn(async () => {})
const removeParentMutateAsync = vi.fn(async () => {})

vi.mock('../../api/tasks', () => ({
  useAddParent: () => ({
    mutate: addParentMutate,
    mutateAsync: addParentMutateAsync,
    isPending: false,
  }),
  useRemoveParent: () => ({ mutateAsync: removeParentMutateAsync, isPending: false }),
}))

beforeEach(() => {
  addParentMutate.mockReset()
  addParentMutateAsync.mockClear()
  removeParentMutateAsync.mockClear()
  addParentMutate.mockImplementation(
    (_vars: unknown, options?: { onSuccess?: () => void | Promise<void> }) => {
      options?.onSuccess?.()
    },
  )
})

describe('AttachExistingChildDialog', () => {
  it('excludes the parent itself, its descendants, and already-direct children from the picker', () => {
    const parent = makeTask({ id: 'p1', name: 'Parent', children_ids: ['c1'] })
    const child = makeTask({ id: 'c1', name: 'Child', parent_ids: ['p1'], children_ids: ['g1'] })
    const grandchild = makeTask({ id: 'g1', name: 'Grandchild', parent_ids: ['c1'] })
    const other = makeTask({ id: 'o1', name: 'Other task' })

    render(
      <AttachExistingChildDialog
        parentTask={parent}
        tasksById={
          new Map([
            [parent.id, parent],
            [child.id, child],
            [grandchild.id, grandchild],
            [other.id, other],
          ])
        }
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByTestId('task-picker-trigger'))
    const options = screen.getByTestId('task-picker-options')
    expect(options.textContent).not.toMatch('Parent')
    expect(options.textContent).not.toMatch('Child')
    expect(options.textContent).not.toMatch('Grandchild')
    expect(options.textContent).toMatch('Other task')
  })

  it('excludes an ancestor of the parent task too, since attaching it would be a cycle', () => {
    const grandparent = makeTask({ id: 'gp1', name: 'Grandparent', children_ids: ['p1'] })
    const parent = makeTask({ id: 'p1', name: 'Parent', parent_ids: ['gp1'] })
    const other = makeTask({ id: 'o1', name: 'Other task' })

    render(
      <AttachExistingChildDialog
        parentTask={parent}
        tasksById={
          new Map([
            [grandparent.id, grandparent],
            [parent.id, parent],
            [other.id, other],
          ])
        }
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByTestId('task-picker-trigger'))
    const options = screen.getByTestId('task-picker-options')
    expect(options.textContent).not.toMatch('Grandparent')
    expect(options.textContent).toMatch('Other task')
  })

  it('attaching a candidate adds the new parent, then removes its previous parent(s)', async () => {
    const parent = makeTask({ id: 'p1', name: 'Parent' })
    const other = makeTask({ id: 'o1', name: 'Other task', parent_ids: ['x1'] })

    render(
      <AttachExistingChildDialog
        parentTask={parent}
        tasksById={
          new Map([
            [parent.id, parent],
            [other.id, other],
          ])
        }
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByTestId('task-picker-trigger'))
    fireEvent.click(screen.getByRole('button', { name: 'Other task' }))

    expect(addParentMutate).toHaveBeenCalledWith({ id: 'o1', parentId: 'p1' }, expect.any(Object))
    await Promise.resolve()
    expect(removeParentMutateAsync).toHaveBeenCalledWith({ id: 'o1', parentId: 'x1' })
  })
})
