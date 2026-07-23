import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { GoogleEvent } from '../types'

export function useGoogleEventsForWeek(weekStart: string, enabled: boolean) {
  return useQuery({
    queryKey: ['google', 'events', weekStart],
    queryFn: () => apiFetch<GoogleEvent[]>(`/google/events?week_start=${weekStart}`),
    enabled,
    refetchInterval: 60_000,
  })
}
