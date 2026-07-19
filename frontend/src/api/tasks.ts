import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { Task } from '../types'

export interface CreateTaskInput {
  name: string
  definition_of_done: string
  description?: string
  parent_ids?: string[]
  colors?: string[]
}

export interface UpdateTaskInput {
  name?: string
  description?: string
  definition_of_done?: string
  colors?: string[]
  estimated_hours?: number
}

const tasksApi = {
  list: () => apiFetch<Task[]>('/tasks'),
  palette: () => apiFetch<string[]>('/tasks/palette'),
  create: (input: CreateTaskInput) =>
    apiFetch<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateTaskInput) =>
    apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
  addParent: (id: string, parentId: string) =>
    apiFetch<Task>(`/tasks/${id}/parents`, {
      method: 'POST',
      body: JSON.stringify({ parent_id: parentId }),
    }),
  removeParent: (id: string, parentId: string) =>
    apiFetch<Task>(`/tasks/${id}/parents/${parentId}`, { method: 'DELETE' }),
  addRequirement: (id: string, requiredId: string) =>
    apiFetch<Task>(`/tasks/${id}/requires`, {
      method: 'POST',
      body: JSON.stringify({ required_id: requiredId }),
    }),
  removeRequirement: (id: string, requiredId: string) =>
    apiFetch<Task>(`/tasks/${id}/requires/${requiredId}`, { method: 'DELETE' }),
  reorder: (
    id: string,
    afterId: string | null,
    beforeId: string | null,
    order?: number,
  ) =>
    apiFetch<Task>(`/tasks/${id}/order`, {
      method: 'PATCH',
      body: JSON.stringify({ after_id: afterId, before_id: beforeId, order }),
    }),
  keepAsBacklog: (id: string) =>
    apiFetch<Task>(`/tasks/${id}/keep-as-backlog`, { method: 'POST' }),
}

const TASKS_KEY = ['tasks']
const PALETTE_KEY = ['palette']

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: tasksApi.list })
}

export function usePalette() {
  return useQuery({ queryKey: PALETTE_KEY, queryFn: tasksApi.palette, staleTime: Infinity })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      tasksApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY })
      // Deleting a task prunes its future intervals server-side (v02 item
      // 8) -- without this, the Plan calendar keeps showing a now-deleted
      // interval's chip until an unrelated refetch happens to occur.
      queryClient.invalidateQueries({ queryKey: ['intervals'] })
      queryClient.invalidateQueries({ queryKey: ['entries'] })
    },
  })
}

export function useAddParent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string }) =>
      tasksApi.addParent(id, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useRemoveParent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string }) =>
      tasksApi.removeParent(id, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useAddRequirement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, requiredId }: { id: string; requiredId: string }) =>
      tasksApi.addRequirement(id, requiredId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useRemoveRequirement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, requiredId }: { id: string; requiredId: string }) =>
      tasksApi.removeRequirement(id, requiredId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useReorderTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      afterId,
      beforeId,
      order,
    }: {
      id: string
      afterId: string | null
      beforeId: string | null
      order?: number
    }) => tasksApi.reorder(id, afterId, beforeId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

export function useKeepAsBacklog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.keepAsBacklog(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}
