import { cn } from 'cn'
import { Choices, P03Dialogue } from '../game/P03Dialogue.tsx'

// A mockup: the end box's ledge as a stick of RAM, in the boxes' outline style. Laid out with CSS, not drawn; if it
// stays, its chips and contacts would be redrawn as art on /art.

const LINE = 'Fine. You know the rules. Now a real game, where it actually counts.'
const CHOICES = [
  { label: 'Start a run', onChoose: () => {} },
  { label: 'Play tutorial again', onChoose: () => {} },
]

// The stick's outline: a side notch low on each end and the key notch off-center in the bottom, as on a real one.
const SHAPE =
  'polygon(0 0,100% 0,100% 52%,calc(100% - 6px) 52%,calc(100% - 6px) 74%,100% 74%,100% 100%,58% 100%,58% calc(100% - 7px),54% calc(100% - 7px),54% 100%,0 100%,0 74%,6px 74%,6px 52%,0 52%)'

/** The stick: an outline cut to its shape, chips along the top, gold contacts along the bottom, the choices on it. */
function RamStick({ className = '' }: { className?: string }) {
  return (
    <div className={cn('relative px-6 pt-5 pb-5', className)}>
      {/* The edge's color behind, and the fill two pixels in, both cut to the stick's shape. */}
      <span aria-hidden className="absolute inset-0 bg-p03-edge" style={{ clipPath: SHAPE }} />
      <span aria-hidden className="absolute inset-0.5 bg-p03-ground" style={{ clipPath: SHAPE }} />
      {/* Its small chips along the top. */}
      <span aria-hidden className="absolute top-1.5 left-6 flex gap-2">
        {[0, 1, 2].map((chip) => (
          <span key={chip} className="h-2 w-4 rounded-[1px] border border-p03-edge" />
        ))}
      </span>
      <span aria-hidden className="absolute top-1.5 right-6 flex gap-2">
        {[0, 1, 2].map((chip) => (
          <span key={chip} className="h-2 w-4 rounded-[1px] border border-p03-edge" />
        ))}
      </span>
      {/* The gold contacts: short ticks along the bottom edge, broken by the key notch. */}
      <span
        aria-hidden
        className="absolute bottom-1 left-2 h-2 w-[calc(54%-0.75rem)] bg-[repeating-linear-gradient(90deg,#c9a640_0_2px,transparent_2px_6px)] opacity-80"
      />
      <span
        aria-hidden
        className="absolute right-2 bottom-1 h-2 w-[calc(42%-0.75rem)] bg-[repeating-linear-gradient(90deg,#c9a640_0_2px,transparent_2px_6px)] opacity-80"
      />
      <div className="relative leading-snug [text-shadow:0_0_4px_#000]">
        <Choices choices={CHOICES} />
      </div>
    </div>
  )
}

function Option({ wide }: { wide: boolean }) {
  return (
    <div className="@container flex flex-col items-end font-terminal text-p03 [filter:drop-shadow(0_0_4px_rgb(125_255_154/0.3))_drop-shadow(0_0_14px_rgb(125_255_154/0.12))]">
      <P03Dialogue face="whiteflag" className="w-full bg-p03-ground/95">
        <p>{LINE}</p>
      </P03Dialogue>
      <RamStick className={cn('text-xl @max-[28rem]:text-base', wide ? 'mt-1 w-full' : 'mt-1')} />
    </div>
  )
}

/** The end box with a RAM stick under it, hung right like the ledge or as wide as the box, at a desktop and a phone. */
export function RamOptions() {
  return (
    <div className="flex flex-col gap-8">
      {[
        { key: 'right', title: 'A RAM stick hung right, as the ledge is', wide: false },
        { key: 'wide', title: 'A RAM stick as wide as the box', wide: true },
      ].map(({ key, title, wide }) => (
        <section key={key} className="flex flex-col gap-2">
          <h3 className="font-semibold">{title}</h3>
          <div className="flex flex-wrap items-start gap-6 rounded-md bg-[#07130b] p-6">
            <div className="w-[28rem] max-w-full">
              <Option wide={wide} />
            </div>
            <div className="w-[21rem] max-w-full">
              <Option wide={wide} />
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
