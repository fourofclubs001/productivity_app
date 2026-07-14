import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ExcusesPanel from './ExcusesPanel'
import type { ExcuseFrequencyResult } from '../../api/excuses'

describe('ExcusesPanel', () => {
  it('shows an empty-state message when nothing was logged', () => {
    const result: ExcuseFrequencyResult = {
      period_start: '2026-07-13',
      period_end: '2026-07-20',
      totals: [],
      by_task: [],
    }
    render(<ExcusesPanel result={result} />)

    expect(screen.getAllByText(/no excuses logged/i)).toHaveLength(2)
  })

  it('renders overall totals and a by-task breakdown', () => {
    const result: ExcuseFrequencyResult = {
      period_start: '2026-07-13',
      period_end: '2026-07-20',
      totals: [{ excuse_id: 'ex1', excuse_text: 'Got distracted', count: 3 }],
      by_task: [
        {
          task_id: 't1',
          task_name: 'Write report',
          excuse_id: 'ex1',
          excuse_text: 'Got distracted',
          count: 2,
        },
        {
          task_id: 't2',
          task_name: 'Ship feature',
          excuse_id: 'ex1',
          excuse_text: 'Got distracted',
          count: 1,
        },
      ],
    }
    render(<ExcusesPanel result={result} />)

    expect(screen.getAllByRole('cell', { name: 'Got distracted' })).toHaveLength(3)
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Write report' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ship feature' })).toBeInTheDocument()
  })
})
