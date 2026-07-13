import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import { render } from '@testing-library/react'
import { UndoProvider } from '../undo/UndoProvider'

export function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <UndoProvider>
        <DndContext>{ui}</DndContext>
      </UndoProvider>
    </QueryClientProvider>,
  )
}
