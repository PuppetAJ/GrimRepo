import { card } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The Package Registry: cards for bytes, as many as the player can afford, each once. */
export function Shop({ run }: { run: RunReady }) {
  const visit = run.state.visit
  if (visit?.kind !== 'shop') return null
  const bytes = run.state.bytes
  return (
    <div data-center className="flex flex-col gap-4">
      <LeaveButton label="Leave the registry" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          Packages for your overkill. You have <span className="text-p03">{bytes}</span>{' '}
          {bytes === 1 ? 'byte' : 'bytes'}.
        </p>
      </ScreenBar>
      <ul className="flex flex-wrap justify-center gap-6 pt-3">
        {visit.offer.map((item, index) => {
          const sold = visit.sold.includes(index)
          const short = item.price > bytes
          const name = card(item.card).name
          return (
            <li key={index} className="flex w-36 shrink-0 flex-col gap-2 sm:w-44">
              <div className={`p-1 ${sold ? 'opacity-40' : ''}`}>
                <PixelCard unit={asUnit(item.card, index + 1)} />
              </div>
              <span className="truncate text-lg text-p03" title={name}>
                {name}
              </span>
              <button
                type="button"
                data-action="buy"
                data-index={index}
                disabled={sold || short}
                onClick={() => run.act({ type: 'buy', index })}
                className="rounded-md border-2 border-p03-edge bg-[#07130b] px-3 py-1.5 text-lg text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:border-p03 enabled:hover:bg-[#13261a] disabled:opacity-50"
              >
                {sold ? 'Bought' : `Buy for ${item.price} ${item.price === 1 ? 'byte' : 'bytes'}`}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
