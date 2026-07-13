import type { Task } from '../types'
import type { ParentDecision } from './useParentDismissal'

// Ordering is a single value shared across the whole DAG (not scoped per
// parent) -- see prompts/interpreted_app_improvements_v01.md item 14/M3.
// Ties (e.g. legacy tasks that predate this field, all defaulting to 0) fall
// back to id so the sort stays deterministic.
export function compareByOrder(a: Task, b: Task): number {
  if (a.order !== b.order) return a.order - b.order
  return a.id.localeCompare(b.id)
}

export function sortByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(compareByOrder)
}

export function rootIds(tasks: Task[]): string[] {
  return sortByOrder(tasks.filter((task) => task.parent_ids.length === 0)).map((task) => task.id)
}

export function descendantIds(taskId: string, tasksById: Map<string, Task>): Set<string> {
  const result = new Set<string>()
  const stack = [...(tasksById.get(taskId)?.children_ids ?? [])]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (result.has(current)) continue
    result.add(current)
    stack.push(...(tasksById.get(current)?.children_ids ?? []))
  }
  return result
}

// A sprint-done leaf is always hidden from the Plan tree (item 9). A parent
// is hidden only once the user has confirmed removing it (item 10) -- see
// qualifiesForRemovalPrompt below for when that's offered.
export function isHiddenFromPlan(
  task: Task,
  decisions: Record<string, ParentDecision>,
): boolean {
  if (task.is_leaf) return task.state === 'sprint_done'
  return decisions[task.id] === 'hidden'
}

/**
 * A parent qualifies for the "all its sub-tasks are done, remove it too?"
 * prompt once every one of its children is itself hidden from the Plan tree
 * (sprint-done leaves, or already-hidden parents) and the user hasn't
 * already answered for this parent (either way -- 'kept' means show the row
 * normally, don't ask again).
 */
export function qualifiesForRemovalPrompt(
  task: Task,
  tasksById: Map<string, Task>,
  decisions: Record<string, ParentDecision>,
): boolean {
  if (task.is_leaf) return false
  if (task.children_ids.length === 0) return false
  if (decisions[task.id]) return false
  return task.children_ids.every((childId) => {
    const child = tasksById.get(childId)
    return child ? isHiddenFromPlan(child, decisions) : true
  })
}

export type DropAction =
  | { kind: 'reparent'; parentId: string }
  | { kind: 'reorder'; afterId: string | null; beforeId: string | null }

/**
 * Decide what a tree-row drag-and-drop should do, given where within the
 * drop target's row the pointer landed (relativeY: 0 = top edge, 1 = bottom
 * edge). The outer thirds mean "reorder next to this row"; the middle third
 * means "reparent onto this row" (MOVE semantics -- see M5/item 4).
 *
 * Returns null for drops that are a no-op or would be invalid (dropping onto
 * self, onto a descendant -- which would create a cycle -- or onto the row's
 * only current parent).
 */
export function resolveDropAction(
  activeId: string,
  overId: string,
  relativeY: number,
  tasks: Task[],
): DropAction | null {
  if (activeId === overId) return null
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const activeTask = tasksById.get(activeId)
  const overTask = tasksById.get(overId)
  if (!activeTask || !overTask) return null

  const isEdge = relativeY < 0.25 || relativeY > 0.75
  if (isEdge) {
    const siblings = sortByOrder(tasks.filter((task) => task.id !== activeId))
    const overIndex = siblings.findIndex((task) => task.id === overId)
    if (relativeY < 0.25) {
      return { kind: 'reorder', afterId: siblings[overIndex - 1]?.id ?? null, beforeId: overId }
    }
    return { kind: 'reorder', afterId: overId, beforeId: siblings[overIndex + 1]?.id ?? null }
  }

  if (descendantIds(activeId, tasksById).has(overId)) return null
  if (activeTask.parent_ids.length === 1 && activeTask.parent_ids[0] === overId) return null
  return { kind: 'reparent', parentId: overId }
}
