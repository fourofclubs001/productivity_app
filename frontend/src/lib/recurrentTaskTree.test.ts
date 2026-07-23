import { describe, expect, it } from 'vitest'
import { buildRecurrentTree } from './recurrentTaskTree'
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
