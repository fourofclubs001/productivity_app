import { COLOR_HEX } from './colors'

export default function ColorDots({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null
  return (
    <span className="flex shrink-0 gap-0.5">
      {colors.map((color) => (
        <span
          key={color}
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: COLOR_HEX[color] ?? '#666' }}
          title={color}
        />
      ))}
    </span>
  )
}
