import { useMemo, useState } from 'react'
import type { EvaluatePeriodResult } from '../../api/evaluate'
import type { Task } from '../../types'
import { flattenTree, sinkCompletedRoots, treeChildIds, treeRootIds } from '../../lib/taskTree'

function formatPercentage(percentage: number | null): string {
  return percentage === null ? '—' : `${percentage}%`
}

export default function StatsPanel({ result, tasks }: { result: EvaluatePeriodResult; tasks: Task[] }) {
  const { period, by_task: byTask } = result
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const statsById = useMemo(() => new Map(byTask.map((stats) => [stats.task_id, stats])), [byTask])
  // Only leaves/ancestors relevant to this period are in by_task -- the tree
  // is shaped over that subset, not the full Plan DAG (items 26/28).
  const visibleIds = useMemo(() => new Set(byTask.map((stats) => stats.task_id)), [byTask])
  const rootIds = useMemo(
    () => sinkCompletedRoots(treeRootIds(visibleIds, tasksById), tasksById),
    [visibleIds, tasksById],
  )
  const rows = useMemo(
    () => flattenTree(rootIds, visibleIds, tasksById, expanded),
    [rootIds, visibleIds, tasksById, expanded],
  )

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
              {rows.map(({ id, depth }) => {
                const stats = statsById.get(id)
                if (!stats) return null
                const hasChildren = treeChildIds(id, visibleIds, tasksById).length > 0
                const isExpanded = expanded.has(id)
                return (
                  <tr key={id} className="border-t border-border">
                    <td className="py-1.5 text-text-primary">
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ paddingLeft: depth * 16 }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpand(id)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
                            hasChildren ? '' : 'invisible'
                          }`}
                        >
                          {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
                        </button>
                        {stats.name}
                        {!stats.is_leaf && (
                          <span className="ml-1.5 rounded border border-border px-1 text-[10px] text-text-secondary">
                            goal
                          </span>
                        )}
                      </span>
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
