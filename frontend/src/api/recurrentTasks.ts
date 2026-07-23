import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { RecurrenceEndType, RecurrenceUnit, Task } from '../types'

export interface CreateRecurrentTaskInput {
  name: string
  definition_of_done: string
  colors: string[]
  start: string
  end: string
  recurrence_interval: number
  recurrence_unit: RecurrenceUnit
  recurrence_days_of_week: number[]
  recurrence_end_type: RecurrenceEndType
  recurrence_end_date?: string
  recurrence_end_count?: number
}

export interface CreateRecurrentGroupInput {
  name: string
}

const recurrentTasksApi = {
  create: (input: CreateRecurrentTaskInput) =>
    apiFetch<Task>('/recurrent-tasks', { method: 'POST', body: JSON.stringify(input) }),
  createGroup: (input: CreateRecurrentGroupInput) =>
    apiFetch<Task>('/recurrent-tasks/groups', { method: 'POST', body: JSON.stringify(input) }),
  deleteGroup: (id: string, deleteChildren: boolean) =>
    apiFetch<void>(`/recurrent-tasks/groups/${id}?delete_children=${deleteChildren}`, {
      method: 'DELETE',
    }),
}

export function useCreateRecurrentTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recurrentTasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['intervals'] })
    },
  })
}

export function useCreateRecurrentGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recurrentTasksApi.createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteRecurrentGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deleteChildren }: { id: string; deleteChildren: boolean }) =>
      recurrentTasksApi.deleteGroup(id, deleteChildren),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['intervals'] })
    },
  })
}
