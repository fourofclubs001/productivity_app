import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, apiFetch } from './client'
import type { Interval } from '../types'

interface GoogleConnectionStatus {
  connected: boolean
}

const googleApi = {
  status: () => apiFetch<GoogleConnectionStatus>('/auth/google/status'),
  disconnect: () => apiFetch<void>('/auth/google/disconnect', { method: 'POST' }),
  pushInterval: (intervalId: string) =>
    apiFetch<Interval>(`/intervals/${intervalId}/push-to-google`, { method: 'POST' }),
}

const STATUS_KEY = ['google', 'status']

export function useGoogleConnectionStatus() {
  return useQuery({ queryKey: STATUS_KEY, queryFn: googleApi.status, refetchInterval: 5000 })
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: googleApi.disconnect,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}

export function usePushIntervalToGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: googleApi.pushInterval,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['intervals'] }),
  })
}

export function googleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google/login`
}
