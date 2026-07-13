import { describe, expect, it } from 'vitest'
import { compareByOrder, rootIds, sortByOrder } from './taskTree'
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
