import { useState } from 'react'
import { PICKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { choiceRarity, PackReveal, RarityBadge, ReopenPack, SealedPack } from './Packs.tsx'
import { ScreenBar } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** A face-down card choice: three packs, each labeled with a trait; tearing one open turns over three cards with it. */
export function BlindPick({ run }: { run: RunReady }) {
  const visit = run.state.visit
  // Which pack is tearing, before the run turns its cards over; and whether the turned-over cards' dialog is up.
  const [tearing, setTearing] = useState<{ node: string; index: number } | null>(null)
  const [showing, setShowing] = useState(true)
  if (visit?.kind !== 'blind') return null
  const revealed = visit.revealed
  return (
    <div data-center className="flex flex-col items-center gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences
            text={
              revealed
                ? `${PICKS[visit.picks[revealed.pick] ?? 'free'].label}. Take one.`
                : 'Three packs, sealed. You only get to read the label.'
            }
          />
        </p>
      </ScreenBar>
      <ul className="flex flex-wrap items-start justify-center gap-6">
        {visit.picks.map((pick, index) => {
          // The pack torn open leaves its place, or a way back to its cards once their dialog is closed.
          if (revealed?.pick === index)
            return <li key={pick}>{showing ? null : <ReopenPack onOpen={() => setShowing(true)} />}</li>
          return (
            <li key={pick}>
              <SealedPack
                art={pick}
                label={PICKS[pick].label}
                note={revealed ? 'Left sealed' : 'Tear it open'}
                tearing={tearing?.node === visit.node && tearing.index === index}
                disabled={Boolean(revealed) || Boolean(tearing && tearing.node === visit.node)}
                onTear={() => setTearing({ node: visit.node, index })}
                onTorn={() => {
                  setShowing(true)
                  run.act({ type: 'take', index })
                }}
                // Only while it can be taken, so a test's aim at a card in the dialog finds just that card.
                data={revealed ? {} : { 'data-action': 'take', 'data-index': index }}
                aria={`A pack of random cards: ${PICKS[pick].label}`}
              />
            </li>
          )
        })}
      </ul>
      {revealed ? (
        <PackReveal
          key={visit.node}
          open={showing}
          onOpenChange={setShowing}
          title={PICKS[visit.picks[revealed.pick] ?? 'free'].label}
          description="Take one of the three into your deck."
          units={revealed.offer.map((id, index) => asUnit(id, index + 1))}
          onPick={(unit) => run.act({ type: 'take', index: unit.uid - 1 })}
          badge={(unit) => <RarityBadge rarity={choiceRarity(unit.card)} />}
        />
      ) : null}
    </div>
  )
}
