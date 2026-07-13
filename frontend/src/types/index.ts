export type TaskState = 'backlog' | 'sprint_backlog' | 'in_progress' | 'sprint_done' | 'done'

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
}

export interface Interval {
  id: string
  task_id: string
  start: string
  end: string
  week_start: string
}

export interface Entry {
  id: string
  task_id: string
  start: string
  end: string | null
}
