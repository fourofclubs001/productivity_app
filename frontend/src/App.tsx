import { useState } from 'react'
import PlanView from './views/PlanView'
import ExecuteView from './views/ExecuteView'
import EvaluateView from './views/EvaluateView'
import { UndoProvider } from './undo/UndoProvider'

const VIEWS = {
  plan: { label: 'Plan', Component: PlanView },
  execute: { label: 'Execute', Component: ExecuteView },
  evaluate: { label: 'Evaluate', Component: EvaluateView },
} as const

type ViewKey = keyof typeof VIEWS

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('plan')
  const ActiveComponent = VIEWS[activeView].Component

  return (
    <UndoProvider>
      <div className="flex h-full min-h-screen flex-col bg-surface">
        <nav className="flex gap-1 border-b border-border bg-surface px-4">
          {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeView === key
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {VIEWS[key].label}
            </button>
          ))}
        </nav>
        <main className="flex-1">
          <ActiveComponent />
        </main>
      </div>
    </UndoProvider>
  )
}

export default App
