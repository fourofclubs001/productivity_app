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

  function sortSiblings(list: Task[]): Task[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }

  function toNode(item: Task): RecurrentNode {
    return { task: item, children: sortSiblings(childrenOf.get(item.id) ?? []).map(toNode) }
  }

  return sortSiblings(roots).map(toNode)
}
