import { describe, expect, it, vi } from 'vitest'
import { makeMarkSubtreeDoneUndoEntry } from './taskDoneUndoEntries'

describe('makeMarkSubtreeDoneUndoEntry', () => {
  it('reverts every affected id in one undo step, not one per leaf', async () => {
    const revertDoneAsync = vi.fn(async () => {})
    const markDoneAsync = vi.fn(async () => {})
    const entry = makeMarkSubtreeDoneUndoEntry(['a', 'b', 'c'], {
      markDoneAsync,
      revertDoneAsync,
    })

    expect(entry.label).toBe('Mark subtree done')
    await entry.run()

    expect(revertDoneAsync).toHaveBeenCalledTimes(3)
    expect(revertDoneAsync).toHaveBeenCalledWith('a')
    expect(revertDoneAsync).toHaveBeenCalledWith('b')
    expect(revertDoneAsync).toHaveBeenCalledWith('c')
  })

  it('redoing re-marks every affected id done again, and is itself undoable', async () => {
    const revertDoneAsync = vi.fn(async () => {})
    const markDoneAsync = vi.fn(async () => {})
    const entry = makeMarkSubtreeDoneUndoEntry(['a', 'b'], { markDoneAsync, revertDoneAsync })

    const redoEntry = await entry.run()
    expect(redoEntry.label).toBe('Revert subtree done')

    const undoAgainEntry = await redoEntry.run()
    expect(markDoneAsync).toHaveBeenCalledTimes(2)
    expect(markDoneAsync).toHaveBeenCalledWith('a')
    expect(markDoneAsync).toHaveBeenCalledWith('b')
    expect(undoAgainEntry.label).toBe('Mark subtree done')
  })

  it('tags the plan view, matching the single-task entries', () => {
    const entry = makeMarkSubtreeDoneUndoEntry(['a'], {
      markDoneAsync: vi.fn(),
      revertDoneAsync: vi.fn(),
    })
    expect(entry.views).toEqual(['plan'])
  })
})
