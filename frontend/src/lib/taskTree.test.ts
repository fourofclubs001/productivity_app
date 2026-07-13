import { describe, expect, it } from 'vitest'
import { compareByOrder, descendantIds, resolveDropAction, rootIds, sortByOrder } from './taskTree'
import { makeTask } from '../test/taskFixtures'

describe('compareByOrder', () => {
  it('sorts by order ascending', () => {
    const a = makeTask({ id: 'a', order: 2000 })
    const b = makeTask({ id: 'b', order: 1000 })
    expect(compareByOrder(a, b)).toBeGreaterThan(0)
    expect(compareByOrder(b, a)).toBeLessThan(0)
  })

  it('falls back to id when order ties (e.g. legacy tasks defaulting to 0)', () => {
    const a = makeTask({ id: 'z', order: 0 })
    const b = makeTask({ id: 'a', order: 0 })
    expect(compareByOrder(a, b)).toBeGreaterThan(0)
    expect(compareByOrder(b, a)).toBeLessThan(0)
  })
})

describe('sortByOrder', () => {
  it('returns a new array sorted by order without mutating the input', () => {
    const c = makeTask({ id: 'c', order: 3000 })
    const a = makeTask({ id: 'a', order: 1000 })
    const b = makeTask({ id: 'b', order: 2000 })
    const input = [c, a, b]

    const sorted = sortByOrder(input)

    expect(sorted.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(input.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('rootIds', () => {
  it('returns only tasks without parents, order-sorted', () => {
    const root2 = makeTask({ id: 'root2', order: 2000, parent_ids: [] })
    const root1 = makeTask({ id: 'root1', order: 1000, parent_ids: [] })
    const child = makeTask({ id: 'child', order: 500, parent_ids: ['root1'] })

    expect(rootIds([root2, root1, child])).toEqual(['root1', 'root2'])
  })
})

describe('descendantIds', () => {
  it('returns all transitive descendants, not just immediate children', () => {
    const grandchild = makeTask({ id: 'gc', parent_ids: ['c'] })
    const child = makeTask({ id: 'c', parent_ids: ['p'], children_ids: ['gc'] })
    const parent = makeTask({ id: 'p', children_ids: ['c'] })
    const tasksById = new Map(
      [parent, child, grandchild].map((task) => [task.id, task]),
    )

    expect(descendantIds('p', tasksById)).toEqual(new Set(['c', 'gc']))
  })

  it('returns an empty set for a leaf task', () => {
    const leaf = makeTask({ id: 'leaf' })
    expect(descendantIds('leaf', new Map([['leaf', leaf]]))).toEqual(new Set())
  })
})

describe('resolveDropAction', () => {
  it('returns null when dropping a task onto itself', () => {
    const a = makeTask({ id: 'a' })
    expect(resolveDropAction('a', 'a', 0.5, [a])).toBeNull()
  })

  it('resolves a drop in the middle third as a reparent onto the target', () => {
    const a = makeTask({ id: 'a', parent_ids: ['old-parent'] })
    const b = makeTask({ id: 'b' })
    expect(resolveDropAction('a', 'b', 0.5, [a, b])).toEqual({
      kind: 'reparent',
      parentId: 'b',
    })
  })

  it('returns null when reparenting onto the task\'s only current parent (no-op)', () => {
    const a = makeTask({ id: 'a', parent_ids: ['b'] })
    const b = makeTask({ id: 'b' })
    expect(resolveDropAction('a', 'b', 0.5, [a, b])).toBeNull()
  })

  it('returns null when reparenting onto a descendant (would create a cycle)', () => {
    const grandchild = makeTask({ id: 'gc', parent_ids: ['c'] })
    const child = makeTask({ id: 'c', parent_ids: ['p'], children_ids: ['gc'] })
    const parent = makeTask({ id: 'p', children_ids: ['c'] })
    expect(resolveDropAction('p', 'gc', 0.5, [parent, child, grandchild])).toBeNull()
  })

  it('resolves a drop near the top edge as "insert before" using global order neighbors', () => {
    const a = makeTask({ id: 'a', order: 1000 })
    const b = makeTask({ id: 'b', order: 2000 })
    const c = makeTask({ id: 'c', order: 3000 })
    // Drag c to just above b.
    expect(resolveDropAction('c', 'b', 0.1, [a, b, c])).toEqual({
      kind: 'reorder',
      afterId: 'a',
      beforeId: 'b',
    })
  })

  it('resolves a drop near the bottom edge as "insert after" using global order neighbors', () => {
    const a = makeTask({ id: 'a', order: 1000 })
    const b = makeTask({ id: 'b', order: 2000 })
    const c = makeTask({ id: 'c', order: 3000 })
    // Drag a to just below b.
    expect(resolveDropAction('a', 'b', 0.9, [a, b, c])).toEqual({
      kind: 'reorder',
      afterId: 'b',
      beforeId: 'c',
    })
  })

  it('uses null bounds at the very start/end of the order', () => {
    const a = makeTask({ id: 'a', order: 1000 })
    const b = makeTask({ id: 'b', order: 2000 })
    expect(resolveDropAction('b', 'a', 0.1, [a, b])).toEqual({
      kind: 'reorder',
      afterId: null,
      beforeId: 'a',
    })
    expect(resolveDropAction('a', 'b', 0.9, [a, b])).toEqual({
      kind: 'reorder',
      afterId: 'b',
      beforeId: null,
    })
  })
})
