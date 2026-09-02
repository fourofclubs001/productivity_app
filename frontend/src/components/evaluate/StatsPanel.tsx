import { useMemo, useState } from 'react'
import type { EvaluatePeriodResult } from '../../api/evaluate'
import type { Task } from '../../types'
import { flattenTree, sinkCompletedRoots, treeChildIds, treeRootIds } from '../../lib/taskTree'
import { ChevronRight } from '../common/icons'

function formatPercentage(percentage: number | null): string {
  return percentage === null ? '—' : `${percentage}%`
}

function percentageColor(percentage: number | null): string {
  if (percentage === null) return 'text-text-tertiary'
  if (percentage >= 80) return 'text-success'
  if (percentage >= 50) return 'text-warning-text'
  return 'text-danger'
}

const LABEL = 'mb-2 text-2xs font-semibold uppercase tracking-wider text-text-secondary'
const TILE = 'rounded-md border border-border p-4'
const NUM = 'py-2 pr-2 text-right tabular-nums text-text-secondary'

export default function StatsPanel({ result, tasks }: { result: EvaluatePeriodResult; tasks: Task[] }) {
  const { period, by_task: byTask } = result
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const statsById = useMemo(() => new Map(byTask.map((stats) => [stats.task_id, stats])), [byTask])
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
    <div className="space-y-6 p-4">
      <div>
        <h2 className={LABEL}>Totals</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={TILE}>
            <div className="text-xs text-text-secondary">Executed %</div>
            <div className={`mt-1 text-[22px] font-medium leading-7 tabular-nums ${percentageColor(period.percentage)}`}>
              {formatPercentage(period.percentage)}
            </div>
          </div>
          <div className={TILE}>
            <div className="text-xs text-text-secondary">Executed / Planned</div>
            <div className="mt-1 text-[22px] font-medium leading-7 tabular-nums text-text-primary">
              {period.executed_hours}h / {period.planned_hours}h
            </div>
          </div>
          <div className={TILE}>
            <div className="text-xs text-text-secondary">Finished</div>
            <div className="mt-1 text-[22px] font-medium leading-7 tabular-nums text-success">
              {period.finished_count}
            </div>
          </div>
          <div className={TILE}>
            <div className="text-xs text-text-secondary">Not finished</div>
            <div className="mt-1 text-[22px] font-medium leading-7 tabular-nums text-text-primary">
              {period.not_finished_count}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className={LABEL}>By task</h2>
        {byTask.length === 0 ? (
          <p className="text-xs text-text-tertiary">Nothing planned or executed in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-2xs uppercase tracking-wider text-text-secondary">
                <th className="pb-2 pl-2 font-medium">Task</th>
                <th className="pb-2 pr-2 text-right font-medium">Executed / Planned</th>
                <th className="pb-2 pr-2 text-right font-medium">%</th>
                <th className="pb-2 pr-2 text-right font-medium">Finished</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, depth }) => {
                const stats = statsById.get(id)
                if (!stats) return null
                const hasChildren = treeChildIds(id, visibleIds, tasksById).length > 0
                const isExpanded = expanded.has(id)
                return (
                  <tr key={id} className="border-t border-border-subtle hover:bg-surface-alt">
                    <td className="py-2 pl-2 text-text-primary">
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ paddingLeft: depth * 16 }}
                      >
                        <button
                          type="button"
                          aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
                          onClick={() => toggleExpand(id)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center text-text-secondary ${
                            hasChildren ? '' : 'invisible'
                          }`}
                        >
                          {hasChildren && (
                            <ChevronRight
                              className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          )}
                        </button>
                        {stats.name}
                        {!stats.is_leaf && (
                          <span className="ml-1.5 rounded-full bg-surface-alt px-1.5 text-2xs text-text-tertiary">
                            goal
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={NUM}>
                      {stats.executed_hours}h / {stats.planned_hours}h
                    </td>
                    <td className={`${NUM} ${percentageColor(stats.percentage)}`}>
                      {formatPercentage(stats.percentage)}
                    </td>
                    <td className={NUM}>
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
