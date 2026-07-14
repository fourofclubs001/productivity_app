import type { ExcuseFrequencyResult } from '../../api/excuses'

export default function ExcusesPanel({ result }: { result: ExcuseFrequencyResult }) {
  const { totals, by_task: byTask } = result

  return (
    <div className="space-y-6 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Totals
        </h2>
        {totals.length === 0 ? (
          <p className="text-xs text-text-secondary">No excuses logged in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-secondary">
                <th className="pb-2 font-medium">Excuse</th>
                <th className="pb-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((row) => (
                <tr key={row.excuse_id} className="border-t border-border">
                  <td className="py-1.5 text-text-primary">{row.excuse_text}</td>
                  <td className="py-1.5 text-text-secondary">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          By task
        </h2>
        {byTask.length === 0 ? (
          <p className="text-xs text-text-secondary">No excuses logged in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-secondary">
                <th className="pb-2 font-medium">Task</th>
                <th className="pb-2 font-medium">Excuse</th>
                <th className="pb-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {byTask.map((row) => (
                <tr key={`${row.task_id}-${row.excuse_id}`} className="border-t border-border">
                  <td className="py-1.5 text-text-primary">{row.task_name}</td>
                  <td className="py-1.5 text-text-secondary">{row.excuse_text}</td>
                  <td className="py-1.5 text-text-secondary">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
