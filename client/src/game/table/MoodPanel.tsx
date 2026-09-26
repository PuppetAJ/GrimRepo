import { useEffect, useState } from 'react'
import { TUNING, tune, useTuning, type Tuning } from './tuning.ts'

type Control = [keyof Tuning, string, number, number, number]

const GROUPS: [string, Control[]][] = [
  [
    'Light',
    [
      ['exposure', 'Exposure', 0.3, 2, 0.05],
      ['ambient', 'Ambient', 0, 1.5, 0.01],
      ['hemisphere', 'Sky and ground', 0, 2, 0.05],
      ['spot', 'Spot over the board', 0, 150, 1],
      ['lamp', 'Ceiling lamp', 0, 50, 0.5],
      ['p03Light', 'Light on P03', 0, 40, 0.5],
      ['deckLight', 'Light over the deck', 0, 30, 0.5],
      ['handLight', 'Light on the hand', 0, 20, 0.5],
      ['rackLight', 'Light on the tools', 0, 15, 0.5],
      ['lampTint', 'Lamps lean green', 0, 1, 0.05],
    ],
  ],
  [
    'Air',
    [
      ['fogNear', 'Fog starts', 0, 20, 0.5],
      ['fogFar', 'Fog is thick by', 10, 60, 1],
      ['dustCount', 'Dust motes', 0, 600, 10],
      ['dustSize', 'Dust size', 0.2, 6, 0.1],
      ['dustOpacity', 'Dust brightness', 0, 1, 0.05],
      ['dustSpeed', 'Dust speed', 0, 1, 0.05],
    ],
  ],
  [
    'Screen',
    [
      ['bloom', 'Glow', 0, 3, 0.05],
      ['bloomThreshold', 'Glow starts at', 0, 2.5, 0.01],
      ['bloomRadius', 'Glow spread', 0, 1, 0.05],
      ['vignette', 'Dark corners', 0, 1.2, 0.05],
      ['noise', 'Grain', 0, 0.2, 0.005],
      ['scanline', 'Scanlines', 0, 0.3, 0.005],
    ],
  ],
  [
    'Colour',
    [
      ['hue', 'Hue', -1, 1, 0.01],
      ['saturation', 'Saturation', -1, 1, 0.02],
      ['brightness', 'Brightness', -0.5, 0.5, 0.01],
      ['contrast', 'Contrast', -0.5, 0.5, 0.01],
    ],
  ],
  [
    'Things',
    [
      ['cardGlow', 'Card art glow', 0, 2, 0.05],
      ['cardBloom', 'Card halo', 0, 2, 0.05],
      ['trimGlow', 'Table trim glow', 0, 1, 0.02],
    ],
  ],
]

/** Opened with `?mood`: sliders for the scene's light and air, kept in this browser, and a way to send them over. */
export function MoodPanel() {
  const mood = useTuning()
  const [copied, setCopied] = useState(false)
  const changed = Object.fromEntries(
    (Object.keys(TUNING) as (keyof Tuning)[]).filter((key) => mood[key] !== TUNING[key]).map((key) => [key, mood[key]]),
  )
  const copy = () => {
    void navigator.clipboard.writeText(JSON.stringify(changed, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <details
      open
      className="absolute top-14 right-3 z-50 max-h-[calc(100%-10rem)] w-72 overflow-y-auto rounded-md border border-[#2f6b3d] bg-p03-ground/95 p-3 font-mono text-xs text-foreground"
    >
      <summary className="cursor-pointer font-terminal text-base text-p03">Mood</summary>
      {GROUPS.map(([title, controls]) => (
        <fieldset key={title} className="mt-3">
          <legend className="mb-1 text-muted-foreground uppercase">{title}</legend>
          {controls.map(([key, label, min, max, step]) => (
            <label key={key} className="grid grid-cols-[1fr_3.5rem] items-center gap-x-2">
              <span className={mood[key] === TUNING[key] ? '' : 'text-p03'}>{label}</span>
              <span className="text-right tabular-nums">{mood[key]}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={mood[key]}
                onChange={(event) => tune({ [key]: Number(event.target.value) })}
                className="col-span-2 accent-[#7dff9a]"
              />
            </label>
          ))}
        </fieldset>
      ))}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={copy} className="flex-1 rounded border border-p03 px-2 py-1 text-p03">
          {copied ? 'Copied' : 'Copy settings'}
        </button>
        <button type="button" onClick={() => tune(TUNING)} className="rounded border border-border px-2 py-1">
          Reset
        </button>
      </div>
      <p className="mt-2 text-muted-foreground">
        Resolution now: <Resolution />. Changed values show in green. Copy them and paste them to Claude to make them
        the default.
      </p>
    </details>
  )
}

/** The canvas's pixel ratio as it stands, which the table lowers on its own when frames run slow. */
function Resolution() {
  const [ratio, setRatio] = useState('')
  useEffect(() => {
    const read = () => {
      const canvas = document.querySelector('[data-table="3d"] canvas') as HTMLCanvasElement | null
      if (canvas) setRatio((canvas.width / canvas.clientWidth).toFixed(2))
    }
    read()
    const timer = setInterval(read, 500)
    return () => clearInterval(timer)
  }, [])
  return <span className="text-p03">{ratio}×</span>
}
