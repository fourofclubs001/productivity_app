import type { Task } from '../types'

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
