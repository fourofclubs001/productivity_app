import { useState, type ComponentType } from 'react'
import PlanView from './views/PlanView'
import ExecuteView from './views/ExecuteView'
import EvaluateView from './views/EvaluateView'
import GoogleConnectButton from './components/nav/GoogleConnectButton'
import { UndoProvider } from './undo/UndoProvider'
import type { ViewKey } from './lib/views'

const VIEWS: Record<ViewKey, { label: string; Component: ComponentType }> = {
  plan: { label: 'Plan', Component: PlanView },
  execute: { label: 'Execute', Component: ExecuteView },
  evaluate: { label: 'Evaluate', Component: EvaluateView },
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('plan')
  const ActiveComponent = VIEWS[activeView].Component

  return (
    <UndoProvider activeView={activeView}>
      <div className="flex h-full min-h-screen flex-col bg-surface">
        <nav className="flex items-center justify-between gap-1 border-b border-border bg-surface px-4">
          <div className="flex gap-1">
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
          </div>
          <GoogleConnectButton />
        </nav>
        <main className="flex-1">
          <ActiveComponent />
        </main>
      </div>
    </UndoProvider>
  )
}

export default App
