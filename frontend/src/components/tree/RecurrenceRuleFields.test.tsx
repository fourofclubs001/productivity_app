import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RecurrenceRuleFields, { defaultRecurrenceRuleValue } from './RecurrenceRuleFields'

describe('RecurrenceRuleFields', () => {
  it('only shows the day-of-week toggles when the unit is week', () => {
    const value = { ...defaultRecurrenceRuleValue(), unit: 'day' as const }
    const { rerender } = render(<RecurrenceRuleFields value={value} onChange={() => {}} />)
    expect(screen.queryByText('Repeat on')).not.toBeInTheDocument()

    rerender(
      <RecurrenceRuleFields
        value={{ ...value, unit: 'week' }}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Repeat on')).toBeInTheDocument()
  })

  it('toggles a day of week on click', () => {
    const onChange = vi.fn()
    const value = { ...defaultRecurrenceRuleValue(), unit: 'week' as const }
    render(<RecurrenceRuleFields value={value} onChange={onChange} />)

    fireEvent.click(screen.getByText('W'))
    expect(onChange).toHaveBeenCalledWith({ ...value, daysOfWeek: [2] })
  })

  it('the end-condition inputs are disabled unless their own radio is selected', () => {
    const value = defaultRecurrenceRuleValue()
    render(<RecurrenceRuleFields value={value} onChange={() => {}} />)

    expect(screen.getByLabelText('Ends on date')).toBeDisabled()
    expect(screen.getByLabelText('Ends after occurrences')).toBeDisabled()
  })

  it('selecting "After" enables the occurrence-count input', () => {
    const onChange = vi.fn()
    const value = defaultRecurrenceRuleValue()
    render(<RecurrenceRuleFields value={value} onChange={onChange} />)

    // Never / On / After, in that order -- the radios sit inside a label
    // shared with another input each, so their accessible names aren't
    // reliably just "After" (see the M12 gotcha in PROJECT_STATUS.md).
    const [, , afterRadio] = screen.getAllByRole('radio')
    fireEvent.click(afterRadio)
    expect(onChange).toHaveBeenCalledWith({ ...value, endType: 'after_count' })
  })
})
