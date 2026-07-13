import type { Task } from '../types'

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'id',
    name: 'name',
    description: '',
    definition_of_done: '',
    state: 'backlog',
    created_at: new Date().toISOString(),
    colors: [],
    effective_colors: [],
    is_leaf: true,
    parent_ids: [],
    children_ids: [],
    order: 0,
    ...overrides,
  }
}
