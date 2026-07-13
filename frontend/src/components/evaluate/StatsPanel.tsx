import type { EvaluatePeriodResult } from '../../api/evaluate'

function formatPercentage(percentage: number | null): string {
  return percentage === null ? '—' : `${percentage}%`
}

export default function StatsPanel({ result }: { result: EvaluatePeriodResult }) {
  const { period, by_task: byTask } = result

  return (
    <div className="space-y-6 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Totals
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-border p-3">
            <div className="text-xs text-text-secondary">Executed / Planned</div>
            <div className="mt-1 text-lg text-text-primary">
              {period.executed_hours}h / {period.planned_hours}h
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-text-secondary">Executed %</div>
            <div className="mt-1 text-lg text-text-primary">
              {formatPercentage(period.percentage)}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-text-secondary">Finished</div>
            <div className="mt-1 text-lg text-success">{period.finished_count}</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-xs text-text-secondary">Not finished</div>
            <div className="mt-1 text-lg text-text-primary">{period.not_finished_count}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          By task
        </h2>
        {byTask.length === 0 ? (
          <p className="text-xs text-text-secondary">Nothing planned or executed in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-secondary">
                <th className="pb-2 font-medium">Task</th>
                <th className="pb-2 font-medium">Executed / Planned</th>
                <th className="pb-2 font-medium">%</th>
                <th className="pb-2 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {byTask.map((stats) => (
                <tr key={stats.task_id} className="border-t border-border">
                  <td className="py-1.5 text-text-primary">
                    {stats.name}
                    {!stats.is_leaf && (
                      <span className="ml-1.5 rounded border border-border px-1 text-[10px] text-text-secondary">
                        goal
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-text-secondary">
                    {stats.executed_hours}h / {stats.planned_hours}h
                  </td>
                  <td className="py-1.5 text-text-secondary">
                    {formatPercentage(stats.percentage)}
                  </td>
                  <td className="py-1.5 text-text-secondary">
                    {stats.finished_count} / {stats.finished_count + stats.not_finished_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
