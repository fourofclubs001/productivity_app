import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Entry, Task } from '../types'

const timerApi = {
  active: () => apiFetch<Entry | null>('/timer/active'),
  start: (taskId: string) =>
    apiFetch<Entry>('/timer/start', { method: 'POST', body: JSON.stringify({ task_id: taskId }) }),
  stop: () => apiFetch<Entry>('/timer/stop', { method: 'POST' }),
  markDone: (taskId: string) =>
    apiFetch<Task>('/timer/mark-done', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    }),
  listForWeek: (weekStart: string) => apiFetch<Entry[]>(`/entries?week_start=${weekStart}`),
}

const TASKS_KEY = ['tasks']
const ACTIVE_KEY = ['timer', 'active']

export function useActiveTimer() {
  return useQuery({ queryKey: ACTIVE_KEY, queryFn: timerApi.active, refetchInterval: 5000 })
}

export function useEntriesForWeek(weekStart: string) {
  return useQuery({
    queryKey: ['entries', 'week', weekStart],
    queryFn: () => timerApi.listForWeek(weekStart),
  })
}

export function useStartTimer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => timerApi.start(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY })
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}

export function useStopTimer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => timerApi.stop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}

export function useMarkDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => timerApi.markDone(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
    },
  })
}
