import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatsPanel from './StatsPanel'
import type { EvaluatePeriodResult } from '../../api/evaluate'

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
    render(<StatsPanel result={result} />)

    expect(screen.getByText(/nothing planned or executed/i)).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('renders period totals and a per-task row, marking non-leaf tasks as goals', () => {
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
    render(<StatsPanel result={result} />)

    expect(screen.getAllByText('2h / 4h').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0)
    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.getByText('Ship Q3 goals')).toBeInTheDocument()
    expect(screen.getByText('goal')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
