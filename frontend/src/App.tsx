import { useState, type ComponentType } from 'react'
import PlanView from './views/PlanView'
import ExecuteView from './views/ExecuteView'
import EvaluateView from './views/EvaluateView'
import GoogleConnectButton from './components/nav/GoogleConnectButton'
import ConfigButton from './components/nav/ConfigButton'
import GlobalTimerWatcher from './components/timer/GlobalTimerWatcher'
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
        <nav className="flex h-12 items-center justify-between gap-1 border-b border-border bg-surface px-4">
          <div className="flex h-full items-center gap-1">
            {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key)}
                className={`flex h-full items-center px-4 text-sm font-medium ${
                  activeView === key
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {VIEWS[key].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <GoogleConnectButton />
            <ConfigButton />
          </div>
        </nav>
        <main className="min-h-0 flex-1">
          <ActiveComponent />
        </main>
        <GlobalTimerWatcher />
      </div>
    </UndoProvider>
  )
}

export default App
