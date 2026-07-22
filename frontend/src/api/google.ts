import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL, apiFetch } from './client'

interface GoogleConnectionStatus {
  connected: boolean
}

const googleApi = {
  status: () => apiFetch<GoogleConnectionStatus>('/auth/google/status'),
  disconnect: () => apiFetch<void>('/auth/google/disconnect', { method: 'POST' }),
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

export function googleLoginUrl(): string {
  return `${API_BASE_URL}/auth/google/login`
}
