import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'

export interface TaskWeekStats {
  task_id: string
  name: string
  is_leaf: boolean
  planned_hours: number
  executed_hours: number
  percentage: number | null
  finished_count: number
  not_finished_count: number
}

export interface WeekStats {
  week_start: string
  planned_hours: number
  executed_hours: number
  percentage: number | null
  finished_count: number
  not_finished_count: number
}

export interface EvaluateWeekResult {
  week: WeekStats
  by_task: TaskWeekStats[]
}

export function useEvaluateWeek(weekStart: string) {
  return useQuery({
    queryKey: ['evaluate', 'week', weekStart],
    queryFn: () => apiFetch<EvaluateWeekResult>(`/evaluate/week?week_start=${weekStart}`),
  })
}
