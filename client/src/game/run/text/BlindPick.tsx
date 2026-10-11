import { useState } from 'react'
import { PICKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { choiceRarity, PackReveal, RarityBadge, SealedPack } from './Packs.tsx'
import { ScreenBar } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** Blind packs: three, each labeled with a trait; tearing one open turns over three cards with it, in its place. */
export function BlindPick({ run }: { run: RunReady }) {
  const visit = run.state.visit
  // Which pack is tearing, before the run turns its cards over.
  const [tearing, setTearing] = useState<{ node: string; index: number } | null>(null)
  if (visit?.kind !== 'blind') return null
  const revealed = visit.revealed
  const label = revealed ? PICKS[visit.picks[revealed.pick] ?? 'free'].label : ''
  return (
    <div data-center className="flex flex-col items-center gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences text={revealed ? `${label}. Take one.` : 'Three packs, sealed. You only get to read the label.'} />
        </p>
      </ScreenBar>
      {revealed ? (
        <PackReveal
          title={label}
          description="Take one of the three into your deck."
          units={revealed.offer.map((id, index) => asUnit(id, index + 1))}
          onPick={(unit) => run.act({ type: 'take', index: unit.uid - 1 })}
          badge={(unit) => <RarityBadge rarity={choiceRarity(unit.card)} />}
        />
      ) : (
        <ul className="flex flex-wrap items-start justify-center gap-6">
          {visit.picks.map((pick, index) => (
            <li key={pick}>
              <SealedPack
                art={pick}
                label={PICKS[pick].label}
                note="Tear it open"
                tearing={tearing?.node === visit.node && tearing.index === index}
                disabled={Boolean(tearing && tearing.node === visit.node)}
                onTear={() => setTearing({ node: visit.node, index })}
                onTorn={() => run.act({ type: 'take', index })}
                data={{ 'data-action': 'take', 'data-index': index }}
                aria={`A pack of random cards: ${PICKS[pick].label}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
