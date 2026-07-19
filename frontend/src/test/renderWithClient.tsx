import type { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import { render } from '@testing-library/react'
import { UndoProvider } from '../undo/UndoProvider'
import type { ViewKey } from '../lib/views'

export function renderWithClient(ui: ReactElement, activeView: ViewKey = 'plan') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <UndoProvider activeView={activeView}>
        <DndContext>{ui}</DndContext>
      </UndoProvider>
    </QueryClientProvider>,
  )
}
