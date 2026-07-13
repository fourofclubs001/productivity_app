import { COLOR_HEX } from './colors'

export default function ColorSwatchPicker({
  palette,
  selected,
  onToggle,
}: {
  palette: string[]
  selected: string[]
  onToggle: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => {
        const active = selected.includes(color)
        return (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onToggle(color)}
            className={`h-6 w-6 rounded-full border-2 ${
              active ? 'border-text-primary' : 'border-transparent opacity-60'
            }`}
            style={{ backgroundColor: COLOR_HEX[color] }}
          />
        )
      })}
    </div>
  )
}
