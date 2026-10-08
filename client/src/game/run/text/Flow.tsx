import { ArrowDown, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { SIGILS, type SigilId } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import { Box } from './Box.tsx'

/** Steps left to right with arrows between, stacked and narrower when the frame is; the screen needs `@container`. */
export const FLOW =
  'mx-auto grid w-full max-w-md items-center gap-3 @4xl:max-w-none @4xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]'

/** One step of a flow, faded until the step before it is done. */
export function Step({ title, on = true, children }: { title: string; on?: boolean; children: ReactNode }) {
  return (
    <Box className={`flex flex-col items-center gap-2 text-center ${on ? '' : 'opacity-50'}`}>
      <h3 className="text-p03">{title}</h3>
      {children}
    </Box>
  )
}

/** Points from one step to the next: across when side by side, down when stacked. */
export function Arrow({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`grid place-items-center self-center ${on ? 'text-p03' : 'text-p03-dim opacity-50'}`}>
      <ArrowDown className="size-7 @4xl:hidden" />
      <ArrowRight className="hidden size-7 @4xl:block" />
    </span>
  )
}

/** A card's sigils to choose one from, as buttons with their icons. */
export function SigilChoice({
  sigils,
  chosen,
  onChoose,
  action,
}: {
  sigils: SigilId[]
  chosen: SigilId | null
  onChoose: (id: SigilId) => void
  /** For tests to find each choice. */
  action: string
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 @4xl:flex-col">
      {sigils.map((id) => (
        <button
          key={id}
          type="button"
          data-action={action}
          data-sigil={id}
          aria-pressed={chosen === id}
          title={SIGILS[id].text}
          onClick={() => onChoose(id)}
          className="flex items-center gap-2 rounded-md border-2 border-p03-edge bg-[#07130b] px-3 py-2 text-left text-lg text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 aria-pressed:border-p03 aria-pressed:bg-[#13261a]"
        >
          <Sigil id={id} size={28} color="currentColor" />
          {SIGILS[id].name}
        </button>
      ))}
    </div>
  )
}

/** What a step shows before the one ahead of it is done. */
export function Waiting({ children }: { children: ReactNode }) {
  return <p className="text-base text-p03-dim">{children}</p>
}
