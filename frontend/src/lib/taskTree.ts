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
  // A task that never had children (a fresh leaf, or an intentionally
  // empty new root) never qualifies -- only a task transitioning from "had
  // children" to "has none" (its last child deleted outright, not
  // completed) does, per ever_had_children (v03 item 10).
  if (task.children_ids.length === 0 && !task.ever_had_children) return false
  if (decisions[task.id]) return false
  return task.children_ids.every((childId) => {
    const child = tasksById.get(childId)
    return child ? isHiddenFromPlan(child, decisions) : true
  })
}

/**
 * Generic tree-shaping over an arbitrary subset of tasks (e.g. only the
 * leaves/ancestors relevant to an Evaluate period, or only the leaves
 * selectable in the Execute picker) -- rather than the full DAG like
 * `rootIds`/`descendantIds` above. A task is a "root" of the visible tree if
 * none of its parents are themselves visible; a task's visible children are
 * its children_ids intersected with the visible set. Both are order-sorted
 * to match the Plan left panel (items 25/26/28/29).
 */
export function treeRootIds(visibleIds: Set<string>, tasksById: Map<string, Task>): string[] {
  const roots = [...visibleIds]
    .map((id) => tasksById.get(id))
    .filter((task): task is Task => !!task && !task.parent_ids.some((pid) => visibleIds.has(pid)))
  return sortByOrder(roots).map((task) => task.id)
}

export function treeChildIds(
  taskId: string,
  visibleIds: Set<string>,
  tasksById: Map<string, Task>,
): string[] {
  const task = tasksById.get(taskId)
  if (!task) return []
  const children = task.children_ids
    .map((id) => tasksById.get(id))
    .filter((child): child is Task => !!child && visibleIds.has(child.id))
  return sortByOrder(children).map((child) => child.id)
}

// Item 27: a root task that has reached `done` sinks below the still-active
// roots, rather than being removed -- it and its subtree stay fully visible.
export function sinkCompletedRoots(rootIds: string[], tasksById: Map<string, Task>): string[] {
  const active = rootIds.filter((id) => tasksById.get(id)?.state !== 'done')
  const completed = rootIds.filter((id) => tasksById.get(id)?.state === 'done')
  return [...active, ...completed]
}

export interface TreeRow {
  id: string
  depth: number
}

// Flattens a visible tree into the rows that should actually be rendered
// given the current expand/collapse state -- shared by every Evaluate/
// Execute list that mirrors the Plan panel's tree shape (items 25/26/28/29).
export function flattenTree(
  rootIds: string[],
  visibleIds: Set<string>,
  tasksById: Map<string, Task>,
  expanded: Set<string>,
): TreeRow[] {
  const rows: TreeRow[] = []
  function walk(ids: string[], depth: number) {
    for (const id of ids) {
      rows.push({ id, depth })
      if (expanded.has(id)) {
        walk(treeChildIds(id, visibleIds, tasksById), depth + 1)
      }
    }
  }
  walk(rootIds, 0)
  return rows
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
