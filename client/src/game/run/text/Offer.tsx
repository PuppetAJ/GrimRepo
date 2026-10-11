import { useState } from 'react'
import { card, isDeathCard } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { choiceRarity, PackReveal, RarityBadge, SealedPack } from './Packs.tsx'
import { ScreenBar } from './Screen.tsx'

/** A card choice or a boss's reward: a pack, plain or holographic, torn open on three cards to take one. */
export function Offer({ run }: { run: RunReady }) {
  const visit = run.state.visit
  // Torn per offer, so the next card choice comes sealed.
  const [torn, setTorn] = useState<{ key: string; open: boolean } | null>(null)
  if (visit?.kind !== 'card' && visit?.kind !== 'reward') return null
  const reward = visit.kind === 'reward'
  const key = `${run.state.stage}:${visit.kind === 'card' ? visit.node : 'reward'}`
  const current = torn?.key === key ? torn : null
  const death = visit.offer.find(isDeathCard)
  return (
    <div data-center className="flex flex-col items-center gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">
          {reward
            ? 'P03 grudgingly hands over a rare pack for beating the boss. Take one card.'
            : 'A pack of three. Take one of them into your deck.'}
          {death ? ` ${card(death).name} is your death card, back from a lost run.` : null}
        </p>
      </ScreenBar>
      {current?.open ? (
        <PackReveal
          title={reward ? "The boss's rare pack" : 'Card pack'}
          description="Take one of the three into your deck."
          units={visit.offer.map((id, index) => asUnit(id, index + 1))}
          onPick={(unit) => run.act({ type: 'take', index: unit.uid - 1 })}
          badge={(unit) => <RarityBadge rarity={choiceRarity(unit.card)} />}
        />
      ) : (
        <SealedPack
          art={reward ? 'rare' : 'card'}
          label={reward ? 'Rare pack' : 'Card pack'}
          note="Tear it open"
          holo={reward}
          tearing={Boolean(current)}
          onTear={() => setTorn({ key, open: false })}
          onTorn={() => setTorn({ key, open: true })}
          data={{ 'data-action': 'open-pack' }}
          aria={reward ? 'Open the rare pack' : 'Open the card pack'}
        />
      )}
    </div>
  )
}
