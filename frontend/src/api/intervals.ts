import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Interval } from '../types'

export interface CreateIntervalInput {
  task_id: string
  start: string
  end: string
}

const intervalsApi = {
  listForWeek: (weekStart: string) =>
    apiFetch<Interval[]>(`/intervals?week_start=${weekStart}`),
  listForTask: (taskId: string) => apiFetch<Interval[]>(`/intervals/by-task/${taskId}`),
  create: (input: CreateIntervalInput) =>
    apiFetch<Interval>('/intervals', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/intervals/${id}`, { method: 'DELETE' }),
}

const TASKS_KEY = ['tasks']

export function useIntervalsForWeek(weekStart: string) {
  return useQuery({
    queryKey: ['intervals', 'week', weekStart],
    queryFn: () => intervalsApi.listForWeek(weekStart),
  })
}

export function useIntervalsForTask(taskId: string) {
  return useQuery({
    queryKey: ['intervals', 'task', taskId],
    queryFn: () => intervalsApi.listForTask(taskId),
  })
}

export function useCreateInterval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: intervalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals'] })
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
    },
  })
}

export function useDeleteInterval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => intervalsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervals'] })
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
    },
  })
}
