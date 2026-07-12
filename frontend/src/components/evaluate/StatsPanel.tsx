import type { EvaluateWeekResult } from '../../api/evaluate'

function formatPercentage(percentage: number | null): string {
  return percentage === null ? '—' : `${percentage}%`
}

export default function StatsPanel({ result }: { result: EvaluateWeekResult }) {
  const { week, by_task: byTask } = result

  return (
    <div className="space-y-6 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Whole week
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-xs text-neutral-500">Executed / Planned</div>
            <div className="mt-1 text-lg text-neutral-100">
              {week.executed_hours}h / {week.planned_hours}h
            </div>
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-xs text-neutral-500">Executed %</div>
            <div className="mt-1 text-lg text-neutral-100">
              {formatPercentage(week.percentage)}
            </div>
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-xs text-neutral-500">Finished</div>
            <div className="mt-1 text-lg text-emerald-400">{week.finished_count}</div>
          </div>
          <div className="rounded border border-neutral-800 p-3">
            <div className="text-xs text-neutral-500">Not finished</div>
            <div className="mt-1 text-lg text-neutral-300">{week.not_finished_count}</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          By task
        </h2>
        {byTask.length === 0 ? (
          <p className="text-xs text-neutral-600">Nothing planned or executed this week.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="pb-2 font-medium">Task</th>
                <th className="pb-2 font-medium">Executed / Planned</th>
                <th className="pb-2 font-medium">%</th>
                <th className="pb-2 font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {byTask.map((stats) => (
                <tr key={stats.task_id} className="border-t border-neutral-800">
                  <td className="py-1.5 text-neutral-200">
                    {stats.name}
                    {!stats.is_leaf && (
                      <span className="ml-1.5 rounded border border-neutral-700 px-1 text-[10px] text-neutral-500">
                        goal
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-neutral-300">
                    {stats.executed_hours}h / {stats.planned_hours}h
                  </td>
                  <td className="py-1.5 text-neutral-300">{formatPercentage(stats.percentage)}</td>
                  <td className="py-1.5 text-neutral-300">
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
