import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatsPanel from './StatsPanel'
import type { EvaluatePeriodResult } from '../../api/evaluate'
import { makeTask } from '../../test/taskFixtures'

describe('StatsPanel', () => {
  it('shows an empty-state message when nothing was planned or executed', () => {
    const result: EvaluatePeriodResult = {
      period: {
        period_start: '2026-07-13',
        period_end: '2026-07-20',
        planned_hours: 0,
        executed_hours: 0,
        percentage: null,
        finished_count: 0,
        not_finished_count: 0,
      },
      by_task: [],
    }
    render(<StatsPanel result={result} tasks={[]} />)

    expect(screen.getByText(/nothing planned or executed/i)).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('renders period totals and a per-task row, marking non-leaf tasks as goals', () => {
    const parent = makeTask({ id: 'node-1', name: 'Ship Q3 goals', is_leaf: false, children_ids: ['leaf-1'] })
    const leaf = makeTask({ id: 'leaf-1', name: 'Write report', parent_ids: ['node-1'] })
    const result: EvaluatePeriodResult = {
      period: {
        period_start: '2026-07-13',
        period_end: '2026-07-20',
        planned_hours: 4,
        executed_hours: 2,
        percentage: 50,
        finished_count: 1,
        not_finished_count: 1,
      },
      by_task: [
        {
          task_id: 'leaf-1',
          name: 'Write report',
          is_leaf: true,
          planned_hours: 2,
          executed_hours: 2,
          percentage: 100,
          finished_count: 1,
          not_finished_count: 0,
        },
        {
          task_id: 'node-1',
          name: 'Ship Q3 goals',
          is_leaf: false,
          planned_hours: 4,
          executed_hours: 2,
          percentage: 50,
          finished_count: 1,
          not_finished_count: 1,
        },
      ],
    }
    render(<StatsPanel result={result} tasks={[parent, leaf]} />)

    expect(screen.getAllByText('2h / 4h').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getByText('Ship Q3 goals')).toBeInTheDocument()
    expect(screen.getByText('goal')).toBeInTheDocument()

    // The leaf is nested under its parent and starts collapsed, matching
    // the Plan left panel's default (item 26/28).
    expect(screen.queryByText('Write report')).not.toBeInTheDocument()
  })

  it('expands a parent row to reveal its children', () => {
    const parent = makeTask({ id: 'p', name: 'Parent goal', is_leaf: false, children_ids: ['leaf'] })
    const leaf = makeTask({ id: 'leaf', name: 'Leaf task', parent_ids: ['p'] })
    const result: EvaluatePeriodResult = {
      period: {
        period_start: '2026-07-13',
        period_end: '2026-07-20',
        planned_hours: 1,
        executed_hours: 1,
        percentage: 100,
        finished_count: 0,
        not_finished_count: 1,
      },
      by_task: [
        {
          task_id: 'leaf',
          name: 'Leaf task',
          is_leaf: true,
          planned_hours: 1,
          executed_hours: 1,
          percentage: 100,
          finished_count: 0,
          not_finished_count: 1,
        },
        {
          task_id: 'p',
          name: 'Parent goal',
          is_leaf: false,
          planned_hours: 1,
          executed_hours: 1,
          percentage: 100,
          finished_count: 0,
          not_finished_count: 1,
        },
      ],
    }
    render(<StatsPanel result={result} tasks={[parent, leaf]} />)

    expect(screen.queryByText('Leaf task')).not.toBeInTheDocument()
    const toggles = screen.getAllByRole('button')
    fireEvent.click(toggles.find((btn) => btn.textContent === '▸')!)
    expect(screen.getByText('Leaf task')).toBeInTheDocument()
  })

  it('sinks a completed root task below the still-active roots', () => {
    const doneRoot = makeTask({ id: 'done-root', name: 'Finished goal', order: 1000, state: 'done' })
    const activeRoot = makeTask({ id: 'active-root', name: 'Active goal', order: 2000, state: 'backlog' })
    const stats = {
      is_leaf: true,
      planned_hours: 1,
      executed_hours: 1,
      percentage: 100,
      finished_count: 1,
      not_finished_count: 0,
    }
    const result: EvaluatePeriodResult = {
      period: {
        period_start: '2026-07-13',
        period_end: '2026-07-20',
        planned_hours: 2,
        executed_hours: 2,
        percentage: 100,
        finished_count: 1,
        not_finished_count: 1,
      },
      by_task: [
        { task_id: 'done-root', name: 'Finished goal', ...stats },
        { task_id: 'active-root', name: 'Active goal', ...stats },
      ],
    }
    render(<StatsPanel result={result} tasks={[doneRoot, activeRoot]} />)

    const rowNames = screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '')
    const doneIndex = rowNames.findIndex((text) => text.includes('Finished goal'))
    const activeIndex = rowNames.findIndex((text) => text.includes('Active goal'))
    expect(activeIndex).toBeLessThan(doneIndex)
  })
})
