import { setCorruptionStyle, useCorruptionStyle, type CorruptionStyle } from './corruptionStyle.ts'

const STYLES: [CorruptionStyle, string][] = [
  ['out', 'In and out'],
  ['in', 'Inside only'],
  ['frame', 'Damaged frame'],
]

/** Development only: switches between the ways P03's corruption could look, to compare them on any page. */
export function CorruptionSwitch() {
  const style = useCorruptionStyle()
  return (
    <div
      role="group"
      aria-label="Corruption style (development)"
      className="fixed bottom-3 left-3 z-50 flex items-center gap-1 rounded-md border bg-popover p-1 text-xs shadow-lg"
    >
      <span className="px-1 text-muted-foreground">Corruption</span>
      {STYLES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={style === key}
          onClick={() => setCorruptionStyle(key)}
          className={`rounded px-2 py-1 ${style === key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
