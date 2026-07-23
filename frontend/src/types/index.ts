export type TaskState = 'backlog' | 'sprint_backlog' | 'in_progress' | 'sprint_done' | 'done'

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'
export type RecurrenceEndType = 'never' | 'on_date' | 'after_count'

export interface Task {
  id: string
  name: string
  description: string
  definition_of_done: string
  state: TaskState
  created_at: string
  colors: string[]
  effective_colors: string[]
  is_leaf: boolean
  parent_ids: string[]
  children_ids: string[]
  order: number
  requires_ids: string[]
  required_by_ids: string[]
  estimated_hours: number | null
  ever_had_children: boolean
  is_recurrent_task: boolean
  recurrence_interval: number | null
  recurrence_unit: RecurrenceUnit | null
  recurrence_days_of_week: number[]
  recurrence_end_type: RecurrenceEndType | null
  recurrence_end_date: string | null
  recurrence_end_count: number | null
  is_recurrent_group: boolean
  recurrent_parent_id: string | null
}

export interface Interval {
  id: string
  task_id: string
  start: string
  end: string
  week_start: string
  task_name: string | null
  google_event_id: string | null
}

export interface Entry {
  id: string
  task_id: string
  start: string
  end: string | null
  task_name: string | null
}

export interface GoogleEvent {
  id: string
  title: string
  start: string
  end: string
}
