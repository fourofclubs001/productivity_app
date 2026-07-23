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
    requires_ids: [],
    required_by_ids: [],
    estimated_hours: null,
    ever_had_children: false,
    is_recurrent_task: false,
    recurrence_interval: null,
    recurrence_unit: null,
    recurrence_days_of_week: [],
    recurrence_end_type: null,
    recurrence_end_date: null,
    recurrence_end_count: null,
    is_recurrent_group: false,
    recurrent_parent_id: null,
    ...overrides,
  }
}
