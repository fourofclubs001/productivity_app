import type { Task } from '../types'

export interface RecurrentNode {
  task: Task
  children: RecurrentNode[]
}

/** Builds the recurrent-task/group tree from `recurrent_parent_id` edges --
 * a wholly separate hierarchy from the main task tree's parent_ids/
 * children_ids (item 7). A node whose declared parent isn't itself a
 * recurrent item still present in the list (e.g. deleted, or not a
 * recurrent task/group at all) falls back to root, rather than being
 * silently dropped.
 */
export function buildRecurrentTree(tasks: Task[]): RecurrentNode[] {
  const items = tasks.filter((task) => task.is_recurrent_task || task.is_recurrent_group)
  const byId = new Map(items.map((task) => [task.id, task]))
  const childrenOf = new Map<string, Task[]>()
  const roots: Task[] = []

  for (const item of items) {
    const parentId = item.recurrent_parent_id
    if (parentId && byId.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? []
      siblings.push(item)
      childrenOf.set(parentId, siblings)
    } else {
      roots.push(item)
    }
  }

  return sortRecurrentSiblings(roots).map(toNode)

  function toNode(item: Task): RecurrentNode {
    return {
      task: item,
      children: sortRecurrentSiblings(childrenOf.get(item.id) ?? []).map(toNode),
    }
  }
}

// A separate ordering sequence from the main tree's `order` (see the
// backend's RECURRENT_ORDER_SEQ_KEY) -- ties (e.g. legacy recurrent tasks
// that predate this field, all defaulting to 0) fall back to name so the
// sort stays deterministic.
export function compareByRecurrentOrder(a: Task, b: Task): number {
  const orderA = a.recurrent_order ?? 0
  const orderB = b.recurrent_order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return a.name.localeCompare(b.name)
}

function sortRecurrentSiblings(list: Task[]): Task[] {
  return [...list].sort(compareByRecurrentOrder)
}

/** Descendants of taskId within the recurrent-task-group hierarchy (via
 * `recurrent_parent_id`), mirroring lib/taskTree.ts's `descendantIds` for
 * the main tree's `children_ids`.
 */
export function recurrentDescendantIds(taskId: string, tasks: Task[]): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const task of tasks) {
    if (task.recurrent_parent_id) {
      const siblings = childrenOf.get(task.recurrent_parent_id) ?? []
      siblings.push(task.id)
      childrenOf.set(task.recurrent_parent_id, siblings)
    }
  }
  const result = new Set<string>()
  const stack = [...(childrenOf.get(taskId) ?? [])]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (result.has(current)) continue
    result.add(current)
    stack.push(...(childrenOf.get(current) ?? []))
  }
  return result
}

export type RecurrentDropAction =
  | { kind: 'reparent'; parentId: string | null }
  | { kind: 'reorder'; afterId: string | null; beforeId: string | null }

/** Mirrors lib/taskTree.ts's resolveDropAction, scoped to the recurrent
 * hierarchy and its own constraint (item 10): only a recurrent group may
 * ever become a parent here -- a plain recurrent task can never gain a
 * child, so dropping onto one always falls through to a sibling reorder
 * regardless of where within its row the pointer landed.
 */
export function resolveRecurrentDropAction(
  activeId: string,
  overId: string,
  relativeY: number,
  tasks: Task[],
): RecurrentDropAction | null {
  if (activeId === overId) return null
  const items = tasks.filter((task) => task.is_recurrent_task || task.is_recurrent_group)
  const byId = new Map(items.map((task) => [task.id, task]))
  const activeItem = byId.get(activeId)
  const overItem = byId.get(overId)
  if (!activeItem || !overItem) return null

  const isEdge = relativeY < 0.25 || relativeY > 0.75
  const canReparentOnto = overItem.is_recurrent_group
  if (isEdge || !canReparentOnto) {
    const siblings = sortRecurrentSiblings(items.filter((task) => task.id !== activeId))
    const overIndex = siblings.findIndex((task) => task.id === overId)
    if (overIndex === -1) return null
    if (relativeY < 0.5) {
      return { kind: 'reorder', afterId: siblings[overIndex - 1]?.id ?? null, beforeId: overId }
    }
    return { kind: 'reorder', afterId: overId, beforeId: siblings[overIndex + 1]?.id ?? null }
  }

  if (activeItem.recurrent_parent_id === overId) return null
  if (activeItem.is_recurrent_group && recurrentDescendantIds(activeId, items).has(overId)) {
    return null
  }
  return { kind: 'reparent', parentId: overId }
}
