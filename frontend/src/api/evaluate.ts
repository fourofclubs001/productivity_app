import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Granularity } from '../lib/period'

export interface TaskPeriodStats {
  task_id: string
  name: string
  is_leaf: boolean
  planned_hours: number
  executed_hours: number
  percentage: number | null
  finished_count: number
  not_finished_count: number
}

export interface PeriodStats {
  period_start: string
  period_end: string
  planned_hours: number
  executed_hours: number
  percentage: number | null
  finished_count: number
  not_finished_count: number
}

export interface EvaluatePeriodResult {
  period: PeriodStats
  by_task: TaskPeriodStats[]
}

export function useEvaluatePeriod(granularity: Granularity, date: string, taskIds: string[]) {
  return useQuery({
    queryKey: ['evaluate', 'period', granularity, date, taskIds],
    queryFn: () => {
      const params = new URLSearchParams({ granularity, date })
      taskIds.forEach((id) => params.append('task_ids', id))
      return apiFetch<EvaluatePeriodResult>(`/evaluate/period?${params.toString()}`)
    },
  })
}
