import { Ban, Plus } from 'lucide-react'
import { useState } from 'react'
import { card, ITEM_SLOTS, ITEMS, UNINSTALL_PRICE, type Unit } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { PixelCard, Sigil } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { HeldTools } from './HeldTools.tsx'
import { ReadableCard } from './CardList.tsx'
import { CardSlot } from './CardSlot.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The Package Registry: cards for bytes, as many as the player can afford, each once. */
export function Shop({ run }: { run: RunReady }) {
  const [removing, setRemoving] = useState<number | null>(null)
  // The card just uninstalled, kept to show it going.
  const [gone, setGone] = useState<Unit | null>(null)
  const visit = run.state.visit
  if (visit?.kind !== 'shop') return null
  const bytes = run.state.bytes
  const canUninstall = !visit.uninstalled && bytes >= UNINSTALL_PRICE && run.state.deck.length > 1
  const target = run.state.deck.find((entry) => entry.id === removing)
  return (
    <div data-center className="flex flex-col gap-4">
      <LeaveButton label="Leave the registry" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          Packages for your overkill. You have <span className="text-p03">{bytes}</span>{' '}
          {bytes === 1 ? 'byte' : 'bytes'}.
        </p>
      </ScreenBar>
      {/* Three sections alike: a box, a heading on the left, and what's for sale centered under it. */}
      <Box className="flex flex-col gap-3">
        <h3 className="text-p03">Packages, for your deck</h3>
        <ul className="flex flex-wrap justify-center gap-6">
          {visit.offer.map((item, index) => {
            const sold = visit.sold.includes(index)
            const short = item.price > bytes
            const name = card(item.card).name
            return (
              <li key={index} className="flex w-36 shrink-0 flex-col gap-2 sm:w-44">
                <div className={`p-1 ${sold ? 'opacity-40' : ''}`}>
                  <ReadableCard unit={asUnit(item.card, index + 1)} />
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
      </Box>
      <Box className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-p03">Tools, one use each</h3>
          <HeldTools items={run.state.items} label="You carry" />
        </div>
        <ul className="flex flex-wrap justify-center gap-4">
          {visit.tools.map((tool, index) => {
            const sold = visit.toolsSold.includes(index)
            const full = run.state.items.length >= ITEM_SLOTS
            return (
              <li key={tool.id} className="flex w-52 flex-col items-center gap-2 text-center">
                <Sigil id={tool.id} size={48} color="var(--p03)" />
                <p className="font-sans text-base text-[#b8f5c4]">
                  <strong className="font-terminal text-xl text-p03">{ITEMS[tool.id].name}.</strong>{' '}
                  {ITEMS[tool.id].text}
                </p>
                <button
                  type="button"
                  data-action="buy-item"
                  data-index={index}
                  disabled={sold || bytes < tool.price || full}
                  onClick={() => run.act({ type: 'buyItem', index })}
                  className="mt-auto rounded-md border-2 border-p03-edge bg-[#07130b] px-3 py-1.5 text-lg text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:border-p03 enabled:hover:bg-[#13261a] disabled:opacity-50"
                >
                  {sold ? 'Bought' : full ? 'Your hands are full' : `Buy for ${tool.price} bytes`}
                </button>
              </li>
            )
          })}
        </ul>
      </Box>
      <Box className="flex flex-col gap-2">
        <h3 id="uninstall" className="text-p03">
          Uninstall a package <span className="text-p03-dim">· {UNINSTALL_PRICE} bytes, once a visit</span>
        </h3>
        <p className="font-sans text-base text-[#b8f5c4]">
          {visit.uninstalled
            ? 'One uninstall a visit. Come back to the next registry.'
            : 'Pick a card to delete from your deck for good.'}
        </p>
        {visit.uninstalled ? (
          <>
            <UsedSlot gone={gone} />
            <button
              type="button"
              data-action="uninstall"
              disabled
              className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
            >
              {gone ? `${card(gone.card).name} uninstalled` : 'Uninstalled'}
            </button>
          </>
        ) : (
          <>
            <CardSlot
              slot="uninstall"
              label="The card to uninstall"
              units={run.state.deck.map((entry) => asUnit(entry))}
              can={() => canUninstall}
              picked={removing}
              onPick={(unit) => setRemoving(unit.uid)}
              data={(unit) => ({ 'data-action': 'uninstall-card', 'data-card': unit.uid })}
            />
            <button
              type="button"
              data-action="uninstall"
              disabled={!(target && canUninstall)}
              onClick={() => {
                if (!target) return
                setGone(asUnit(target))
                run.act({ type: 'uninstall', card: target.id })
                setRemoving(null)
              }}
              className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
            >
              {target
                ? `Uninstall ${card(target.card).name} for ${UNINSTALL_PRICE} bytes`
                : `Uninstall it for ${UNINSTALL_PRICE} bytes`}
            </button>
          </>
        )}
      </Box>
    </div>
  )
}

/** The uninstall's slot once used: the card it took shrinks away, then the slot turns over to a crossed-out circle. */
function UsedSlot({ gone }: { gone: Unit | null }) {
  const face = 'absolute inset-0 grid place-items-center rounded-md border-2 border-dashed border-p03-edge text-p03-dim'
  return (
    <div
      role="img"
      aria-label="Uninstalled. One a visit"
      data-uninstalled
      className="relative aspect-[5/7] w-24 self-center sm:w-28"
    >
      {/* Just used, the + turns over to the cross; on a later visit to this screen, the cross is already up. */}
      {gone ? (
        <span className={`${face} motion-safe:animate-[turn-away_450ms_ease-in-out_450ms_both] motion-reduce:hidden`}>
          <Plus aria-hidden className="size-10" />
        </span>
      ) : null}
      <span className={`${face} ${gone ? 'motion-safe:animate-[turn-up_450ms_ease-in-out_450ms_both]' : ''}`}>
        <Ban aria-hidden className="size-10" />
      </span>
      {gone ? (
        <div className="absolute inset-0 z-10 motion-safe:animate-[uninstall-away_400ms_ease-in_forwards] motion-reduce:hidden">
          <PixelCard unit={gone} />
        </div>
      ) : null}
    </div>
  )
}
