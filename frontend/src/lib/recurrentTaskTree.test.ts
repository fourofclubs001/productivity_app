import { describe, expect, it } from 'vitest'
import {
  buildRecurrentTree,
  recurrentDescendantIds,
  resolveRecurrentDropAction,
} from './recurrentTaskTree'
import { makeTask } from '../test/taskFixtures'

describe('buildRecurrentTree', () => {
  it('ignores non-recurrent tasks entirely', () => {
    const normal = makeTask({ id: 'n1', name: 'Normal' })
    const tree = buildRecurrentTree([normal])
    expect(tree).toEqual([])
  })

  it('puts parentless recurrent items at root, sorted by name', () => {
    const b = makeTask({ id: 'b', name: 'Bravo', is_recurrent_task: true })
    const a = makeTask({ id: 'a', name: 'Alpha', is_recurrent_group: true })
    const tree = buildRecurrentTree([b, a])
    expect(tree.map((node) => node.task.id)).toEqual(['a', 'b'])
  })

  it('nests a task under its group', () => {
    const group = makeTask({ id: 'g1', name: 'Chores', is_recurrent_group: true })
    const task = makeTask({
      id: 't1',
      name: 'Water plants',
      is_recurrent_task: true,
      recurrent_parent_id: 'g1',
    })
    const tree = buildRecurrentTree([group, task])
    expect(tree).toHaveLength(1)
    expect(tree[0].task.id).toBe('g1')
    expect(tree[0].children.map((node) => node.task.id)).toEqual(['t1'])
  })

  it('nests a group under another group (multi-level)', () => {
    const grandparent = makeTask({ id: 'gp', name: 'Grandparent', is_recurrent_group: true })
    const parent = makeTask({
      id: 'p',
      name: 'Parent',
      is_recurrent_group: true,
      recurrent_parent_id: 'gp',
    })
    const child = makeTask({
      id: 'c',
      name: 'Child',
      is_recurrent_task: true,
      recurrent_parent_id: 'p',
    })
    const tree = buildRecurrentTree([child, parent, grandparent])
    expect(tree).toHaveLength(1)
    expect(tree[0].task.id).toBe('gp')
    expect(tree[0].children[0].task.id).toBe('p')
    expect(tree[0].children[0].children[0].task.id).toBe('c')
  })

  it('falls back to root when the declared parent is missing or not a recurrent item', () => {
    const orphan = makeTask({
      id: 'o1',
      name: 'Orphan',
      is_recurrent_task: true,
      recurrent_parent_id: 'does-not-exist',
    })
    const tree = buildRecurrentTree([orphan])
    expect(tree.map((node) => node.task.id)).toEqual(['o1'])
  })
})

describe('recurrentDescendantIds', () => {
  it('collects the full subtree, not just direct children', () => {
    const grandparent = makeTask({ id: 'gp', is_recurrent_group: true })
    const parent = makeTask({ id: 'p', is_recurrent_group: true, recurrent_parent_id: 'gp' })
    const child = makeTask({ id: 'c', is_recurrent_task: true, recurrent_parent_id: 'p' })
    const unrelated = makeTask({ id: 'u', is_recurrent_task: true })

    expect(recurrentDescendantIds('gp', [grandparent, parent, child, unrelated])).toEqual(
      new Set(['p', 'c']),
    )
  })

  it('is empty for a leaf task', () => {
    const task = makeTask({ id: 't1', is_recurrent_task: true })
    expect(recurrentDescendantIds('t1', [task])).toEqual(new Set())
  })
})

describe('resolveRecurrentDropAction', () => {
  it('dropping a task onto a group (middle third) reparents it', () => {
    const group = makeTask({ id: 'g1', is_recurrent_group: true })
    const task = makeTask({ id: 't1', is_recurrent_task: true })
    const action = resolveRecurrentDropAction('t1', 'g1', 0.5, [group, task])
    expect(action).toEqual({ kind: 'reparent', parentId: 'g1' })
  })

  it('dropping a task onto another task never reparents, even at the middle', () => {
    const taskA = makeTask({ id: 'a', name: 'A', is_recurrent_task: true })
    const taskB = makeTask({ id: 'b', name: 'B', is_recurrent_task: true })
    const action = resolveRecurrentDropAction('a', 'b', 0.5, [taskA, taskB])
    expect(action?.kind).toBe('reorder')
  })

  it('a group cannot be reparented into its own descendant', () => {
    const parent = makeTask({ id: 'p', is_recurrent_group: true })
    const child = makeTask({ id: 'c', is_recurrent_group: true, recurrent_parent_id: 'p' })
    const action = resolveRecurrentDropAction('p', 'c', 0.5, [parent, child])
    expect(action).toBeNull()
  })

  it('dropping onto the edge of a row reorders as siblings', () => {
    const a = makeTask({ id: 'a', name: 'A', is_recurrent_task: true, recurrent_order: 0 })
    const b = makeTask({ id: 'b', name: 'B', is_recurrent_task: true, recurrent_order: 10 })
    const c = makeTask({ id: 'c', name: 'C', is_recurrent_task: true, recurrent_order: 20 })
    const action = resolveRecurrentDropAction('c', 'b', 0.1, [a, b, c])
    expect(action).toEqual({ kind: 'reorder', afterId: 'a', beforeId: 'b' })
  })

  it('no-op when already directly under the target group', () => {
    const group = makeTask({ id: 'g1', is_recurrent_group: true })
    const task = makeTask({ id: 't1', is_recurrent_task: true, recurrent_parent_id: 'g1' })
    const action = resolveRecurrentDropAction('t1', 'g1', 0.5, [group, task])
    expect(action).toBeNull()
  })
})
