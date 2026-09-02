interface Segment<T extends string> {
  key: T
  label: string
}

// A pill-group toggle (Google's "segmented button"). One style for every
// small mutually-exclusive choice in the app -- sub-tabs, calendar modes,
// day/week/month -- instead of the primary-button-blue active pill that
// read as a call to action (v08 UX-23).
export default function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
}: {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-8 items-center gap-0.5 rounded-sm border border-border p-0.5"
    >
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          aria-pressed={value === segment.key}
          onClick={() => onChange(segment.key)}
          className={`flex h-full items-center rounded-[3px] px-3 text-ui font-medium transition-colors ${
            value === segment.key
              ? 'bg-accent-soft text-accent'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
