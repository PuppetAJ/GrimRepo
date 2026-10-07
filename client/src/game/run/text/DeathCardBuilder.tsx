import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { buildDeathCard, card, DEATH_NAME_LIMIT, deathHands, deathNameProblem, type RunCard } from 'shared'
import { api, ApiError, type BuiltDeathCard } from '../../../lib/api.ts'
import { PixelCard } from '../../CardReader.tsx'
import { Panel, SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'

/** What the preview is called before the player names it. */
const UNNAMED = 'Death Card'

/** Each hand's step: what its card gives the death card. */
const STEPS = [
  { key: 'cost', label: 'Its cost, from one of these', action: 'death-cost' },
  { key: 'stats', label: 'Its attack, health and art, from one of these', action: 'death-stats' },
  { key: 'sigils', label: 'Its sigils, every one this card has', action: 'death-sigils' },
] as const

type Part = (typeof STEPS)[number]['key']

/** After a lost run: a card built from one pick in each of three hands the deck deals, kept for later runs. */
export function DeathCardBuilder({ run }: { run: RunReady }) {
  const [picked, setPicked] = useState<Record<Part, number | null>>({ cost: null, stats: null, sigils: null })
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [built, setBuilt] = useState<BuiltDeathCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hands = deathHands(run.state)
  const problem = deathNameProblem(name)
  const complete = picked.cost !== null && picked.stats !== null && picked.sigils !== null
  const choice = (named: string) => ({
    cost: picked.cost ?? -1,
    stats: picked.stats ?? -1,
    sigils: picked.sigils ?? -1,
    name: named,
  })
  const preview = complete ? buildDeathCard(run.state, choice(problem ? UNNAMED : name)) : null
  const costCard = hands[0].find((entry) => entry.id === picked.cost)
  // The server's record must be saved before it can build from it; a mockup builds here and keeps nothing.
  const mockup = run.id === -1
  const ready = mockup || run.over !== null

  if (built) return <Built built={built} mockup={mockup} />

  const submit = async () => {
    setTouched(true)
    if (problem || !preview?.ok) return
    if (mockup) return setBuilt({ card: preview.id, saved: false })
    setSending(true)
    setError(null)
    try {
      setBuilt(await api.buildDeathCard(run.id, choice(name)))
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'The death card could not be saved. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section aria-labelledby="death-card" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="death-card" className="text-2xl text-p03">
          Build a death card
        </h3>
        <p className="font-sans text-base">
          Your deck deals three hands. Pick one card from each: the first gives its cost, the second its attack, health
          and art, the third its sigils. Your next run offers it once, at its first card choice, and P03 brings it to
          the final boss either way, so build with care.
        </p>
      </div>
      {STEPS.map((step, index) => (
        <section key={step.key} aria-labelledby={`death-${step.key}`} className="flex flex-col gap-2">
          <h4 id={`death-${step.key}`} className="text-p03">
            {index + 1}. {step.label}
          </h4>
          <CardList
            units={(hands[index] as RunCard[]).map((entry) => asUnit(entry))}
            onPick={(unit) =>
              setPicked((now) => ({ ...now, [step.key]: now[step.key] === unit.uid ? null : unit.uid }))
            }
            picked={picked[step.key]}
            data={(unit) => ({ 'data-action': step.action, 'data-card': unit.uid })}
            size="w-20 sm:w-24"
          />
        </section>
      ))}
      <div className="flex flex-col gap-1">
        <label htmlFor="death-name" className="text-p03">
          4. Its name
        </label>
        <input
          id="death-name"
          value={name}
          maxLength={DEATH_NAME_LIMIT}
          autoComplete="off"
          aria-invalid={touched && problem !== null}
          aria-describedby="death-name-help"
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched(true)}
          className="max-w-xs rounded-md border-2 border-p03-edge bg-[#07130b] px-2 py-1 font-terminal text-lg text-p03"
        />
        <p id="death-name-help" className={`text-base ${touched && problem ? 'text-death' : 'text-p03-dim'}`}>
          {touched && problem ? problem : `Up to ${DEATH_NAME_LIMIT} characters.`}
        </p>
      </div>
      {preview?.ok && costCard ? (
        <Panel>
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-28 shrink-0">
              <PixelCard unit={asUnit(preview.id)} />
            </div>
            <p className="max-w-sm font-sans text-base">
              Costs {card(preview.id).cost}
              {card(preview.id).cost > card(costCard.card).cost
                ? `: a card can be at most one cheaper than the one its stats came from, and never free if that one wasn't.`
                : '.'}
            </p>
          </div>
        </Panel>
      ) : null}
      {error ? (
        <p role="alert" className="text-death">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        data-action="build-death-card"
        disabled={!complete || sending || !ready}
        onClick={submit}
        className={`${SIDE_BUTTON} self-start border-p03 px-4 disabled:opacity-50`}
      >
        {sending ? 'Building…' : ready ? 'Build it' : 'Saving the run first…'}
      </button>
    </section>
  )
}

function Built({ built, mockup }: { built: BuiltDeathCard; mockup: boolean }) {
  return (
    <section aria-labelledby="death-card" className="flex flex-col gap-3">
      <h3 id="death-card" className="text-2xl text-p03">
        {card(built.card).name} is ready
      </h3>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-28 shrink-0">
          <PixelCard unit={asUnit(built.card)} />
        </div>
        <p className="max-w-sm font-sans text-base" role="status">
          {built.saved ? (
            'Saved, and pinned to your profile. Your next run offers it at its first card choice.'
          ) : mockup ? (
            'A mockup: built here and never saved.'
          ) : (
            <>
              Guests and the demo account don't keep death cards.{' '}
              <Link to="/signup" className="text-p03 underline">
                Sign up
              </Link>{' '}
              to keep yours.
            </>
          )}
        </p>
      </div>
    </section>
  )
}
