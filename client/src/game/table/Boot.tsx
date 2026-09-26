import { useEffect, useState } from 'react'

export type BootStage = 'code' | 'assets' | 'warming' | 'done'

const WIDTH = 28

/** A progress bar in text: filled to `share` (0 to 1), or a block sweeping back and forth when there is no share yet. */
function bar(share: number | null, tick: number): string {
  if (share === null) {
    const at = Math.abs((tick % (WIDTH * 2 - 2)) - (WIDTH - 1))
    return [...Array(WIDTH).keys()].map((i) => (Math.abs(i - at) < 2 ? '#' : '-')).join('')
  }
  const filled = Math.round(share * WIDTH)
  return '#'.repeat(filled) + '-'.repeat(WIDTH - filled)
}

/**
 * P03 booting the factory, over the table while it loads, so the room is never seen being put together. It fades
 * out once the models are in and every shader is built.
 */
export function Boot({ stage, progress = 0, files = [] }: { stage: BootStage; progress?: number; files?: string[] }) {
  const [tick, setTick] = useState(0)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (stage === 'done') {
      const hide = setTimeout(() => setGone(true), 450)
      return () => clearTimeout(hide)
    }
    const timer = setInterval(() => setTick((n) => n + 1), 80)
    return () => clearInterval(timer)
  }, [stage])
  if (gone) return null
  const step = (label: string, state: 'wait' | 'run' | 'ok', detail = '') =>
    `> ${label.padEnd(20, '.')} ${state === 'ok' ? 'ok' : state === 'run' ? detail || '...' : ''}`
  const loaded = stage !== 'code'
  const lines = [
    'P03> booting the factory',
    step('fetching the table', loaded ? 'ok' : 'run'),
    step('loading models', stage === 'assets' ? 'run' : loaded ? 'ok' : 'wait', `${Math.round(progress)}%`),
    ...(stage === 'assets' ? files.slice(-3).map((file) => `    ${file}`) : []),
    step('warming shaders', stage === 'warming' ? 'run' : stage === 'done' ? 'ok' : 'wait'),
  ]
  const share = stage === 'code' ? null : stage === 'assets' ? progress / 100 : 1
  const words = stage === 'assets' ? `Setting the table, ${Math.round(progress)}%` : 'Setting the table'
  return (
    <div
      role="status"
      aria-label={words}
      className={`absolute inset-0 z-30 grid place-items-center bg-p03-ground transition-opacity duration-400 ${stage === 'done' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="p03-screen w-[min(34rem,90%)] rounded-lg border border-[#2f6b3d] p-5 font-terminal text-lg leading-snug text-p03 sm:text-xl">
        {lines.map((line, i) => (
          <p key={i} className={`whitespace-pre ${line.startsWith(' ') ? 'text-p03-dim' : ''}`}>
            {line}
          </p>
        ))}
        <p className="mt-3 whitespace-pre">
          [{bar(share, tick)}] {share === null ? '' : `${Math.round(share * 100)}%`}
          <span className={tick % 8 < 4 ? '' : 'invisible'}>_</span>
        </p>
      </div>
    </div>
  )
}
