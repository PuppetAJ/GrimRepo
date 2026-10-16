import { useEffect, useRef, type ReactNode } from 'react'
import { ago, number } from '../../lib/format.ts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { colorOf, ending, resultOf, type Run } from './chart.ts'

export function Frame({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="@container flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
      </figcaption>
      {children}
    </figure>
  )
}

/** The chart's data as a table for screen readers. */
export function AsTable({ runs, caption }: { runs: Run[]; caption: string }) {
  return (
    // Hidden by a wrapper: Firefox still draws a hidden table's caption.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Result</th>
            <th scope="col">Battles won</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, index) => (
            <tr key={run.playedAt}>
              <td>{index + 1}</td>
              <td>{resultOf(run)}</td>
              <td>{run.battles}</td>
              <td>{run.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Recharts puts a tip away when the mouse leaves the chart, which a touch never does, so a tapped chart kept its tip
 * up. A press anywhere else now tells the chart the pointer left.
 */
export function useTip() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const box = ref.current
      if (!box || box.contains(event.target as Node)) return
      box
        .querySelector('.recharts-wrapper')
        ?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    }
    document.addEventListener('pointerdown', press)
    return () => document.removeEventListener('pointerdown', press)
  }, [])
  return ref
}

export function Tip({
  count,
  active,
  payload,
  activeIndex,
  detail = (run) => `${number(run.score)} points`,
}: Pick<TooltipContentProps<ValueType, NameType>, 'active' | 'payload' | 'activeIndex'> & {
  count: number
  /** The tip's last line, the run's score unless a chart says otherwise. */
  detail?: (run: Run) => string
}) {
  const point = payload?.[0]
  const run = point?.payload as Run | undefined
  // The battles chart's empty slots have no run to tell of.
  if (!active || !run?.playedAt) return null
  const index = Number(activeIndex)
  return (
    <div className="w-max rounded-md border bg-popover px-3 py-2 text-sm whitespace-nowrap shadow-lg">
      <p className="text-muted-foreground">
        Run {index + 1} of {count} · {ago(run.playedAt)}
      </p>
      <p className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(run) }} />
        {ending(run)}
      </p>
      <p className="font-mono text-base">{detail(run)}</p>
    </div>
  )
}

export function Legend() {
  return (
    <p aria-hidden className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" /> won
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-death" /> lost
      </span>
    </p>
  )
}
