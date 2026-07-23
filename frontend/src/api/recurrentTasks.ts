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

const recurrentTasksApi = {
  create: (input: CreateRecurrentTaskInput) =>
    apiFetch<Task>('/recurrent-tasks', { method: 'POST', body: JSON.stringify(input) }),
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
