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
}
