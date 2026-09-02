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
  revertDone: (taskId: string) =>
    apiFetch<Task>('/timer/revert-done', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    }),
  markSubtreeDone: (taskId: string) =>
    apiFetch<string[]>('/timer/mark-subtree-done', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    }),
  listForWeek: (weekStart: string) => apiFetch<Entry[]>(`/entries?week_start=${weekStart}`),
  listForTask: (taskId: string) => apiFetch<Entry[]>(`/entries/by-task/${taskId}`),
  createEntry: (input: { task_id: string; start: string; end: string }) =>
    apiFetch<Entry>('/entries', { method: 'POST', body: JSON.stringify(input) }),
  updateEntry: (id: string, input: { start?: string; end?: string }) =>
    apiFetch<Entry>(`/entries/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteEntry: (id: string) => apiFetch<void>(`/entries/${id}`, { method: 'DELETE' }),
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

export function useEntriesForTask(taskId: string) {
  return useQuery({
    queryKey: ['entries', 'task', taskId],
    queryFn: () => timerApi.listForTask(taskId),
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

export function useRevertDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => timerApi.revertDone(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
    },
  })
}

export function useMarkSubtreeDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => timerApi.markSubtreeDone(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
    },
  })
}

function invalidateEntries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['entries'] })
  queryClient.invalidateQueries({ queryKey: ['evaluate'] })
}

export function useCreateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { task_id: string; start: string; end: string }) =>
      timerApi.createEntry(input),
    onSuccess: () => invalidateEntries(queryClient),
  })
}

export function useUpdateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { start?: string; end?: string } }) =>
      timerApi.updateEntry(id, input),
    onSuccess: () => invalidateEntries(queryClient),
  })
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => timerApi.deleteEntry(id),
    onSuccess: () => invalidateEntries(queryClient),
  })
}
