import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Granularity } from '../lib/period'

export interface Excuse {
  id: string
  text: string
}

export interface AttachExcuseInput {
  task_id: string
  interval_id: string
  start: string
  end: string
  excuse_id?: string
  new_excuse_text?: string
}

export interface ExcuseAttachment {
  id: string
  excuse_id: string
  excuse_text: string
  task_id: string
  interval_id: string | null
  start: string
  end: string
}

export interface ExcuseFrequencyRow {
  excuse_id: string
  excuse_text: string
  count: number
}

export interface ExcuseFrequencyByTask {
  task_id: string
  task_name: string
  excuse_id: string
  excuse_text: string
  count: number
}

export interface ExcuseFrequencyResult {
  period_start: string
  period_end: string
  totals: ExcuseFrequencyRow[]
  by_task: ExcuseFrequencyByTask[]
}

const excusesApi = {
  list: () => apiFetch<Excuse[]>('/excuses'),
  attach: (input: AttachExcuseInput) =>
    apiFetch<ExcuseAttachment>('/excuses/attach', { method: 'POST', body: JSON.stringify(input) }),
  frequency: (granularity: Granularity, date: string, taskIds: string[]) => {
    const params = new URLSearchParams({ granularity, date })
    taskIds.forEach((id) => params.append('task_ids', id))
    return apiFetch<ExcuseFrequencyResult>(`/excuses/frequency?${params.toString()}`)
  },
}

export function useExcuses() {
  return useQuery({ queryKey: ['excuses'], queryFn: excusesApi.list })
}

export function useAttachExcuse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: excusesApi.attach,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excuses'] })
    },
  })
}

export function useExcuseFrequency(granularity: Granularity, date: string, taskIds: string[]) {
  return useQuery({
    queryKey: ['excuses', 'frequency', granularity, date, taskIds],
    queryFn: () => excusesApi.frequency(granularity, date, taskIds),
  })
}
