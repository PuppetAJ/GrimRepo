import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  buildDeathCard,
  card,
  DEATH_NAME_LIMIT,
  deathNameProblem,
  deathParts,
  SIGILS,
  type DeathChoice,
} from 'shared'
import { api, ApiError, type BuiltDeathCard } from '../../../lib/api.ts'
import { PixelCard } from '../../CardReader.tsx'
import { Panel, SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'

type Sigil = DeathChoice['sigil']

/** What the preview is called before the player names it. */
const UNNAMED = 'Death Card'

/** After a lost run: one card built from three in the deck, kept for a later run's card choice. */
export function DeathCardBuilder({ run }: { run: RunReady }) {
  const [cost, setCost] = useState<number | null>(null)
  const [stats, setStats] = useState<number | null>(null)
  const [sigil, setSigil] = useState<Sigil>(null)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [built, setBuilt] = useState<BuiltDeathCard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parts = deathParts(run.state.deck)
  const units = parts.map((entry) => asUnit(entry))
  const costCard = parts.find((entry) => entry.id === cost)
  const statsCard = parts.find((entry) => entry.id === stats)
  // Each sigil once, from the first card holding it, since which card gives it changes nothing.
  const sigils: NonNullable<Sigil>[] = []
  for (const entry of parts)
    for (const id of entry.sigils)
      if (!sigils.some((option) => option.sigil === id)) sigils.push({ card: entry.id, sigil: id })
  const problem = deathNameProblem(name)
  const choice = (named: string) => ({ cost: cost ?? -1, stats: stats ?? -1, sigil, name: named })
  const preview = costCard && statsCard ? buildDeathCard(parts, choice(problem ? UNNAMED : name)) : null
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
          One card comes back from this run: the cost of one card, the stats of another, and a sigil from a third. Your
          next run offers it once, at its first card choice.
        </p>
      </div>
      <section aria-labelledby="death-cost" className="flex flex-col gap-2">
        <h4 id="death-cost" className="text-p03">
          1. The card whose cost it takes
        </h4>
        <CardList
          units={units}
          onPick={(unit) => setCost(unit.uid === cost ? null : unit.uid)}
          picked={cost}
          data={(unit) => ({ 'data-action': 'death-cost', 'data-card': unit.uid })}
          size="w-20 sm:w-24"
        />
      </section>
      <section aria-labelledby="death-stats" className="flex flex-col gap-2">
        <h4 id="death-stats" className="text-p03">
          2. The card whose attack and health it takes, and its art
        </h4>
        <CardList
          units={units}
          onPick={(unit) => setStats(unit.uid === stats ? null : unit.uid)}
          picked={stats}
          data={(unit) => ({ 'data-action': 'death-stats', 'data-card': unit.uid })}
          size="w-20 sm:w-24"
        />
      </section>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-p03">3. The sigil it takes, from any card in the deck</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="death-sigil"
            checked={sigil === null}
            onChange={() => setSigil(null)}
            className="mt-1.5 accent-p03"
          />
          <span>No sigil</span>
        </label>
        {sigils.map((option) => (
          <label key={option.sigil} className="flex items-start gap-2">
            <input
              type="radio"
              name="death-sigil"
              data-action="death-sigil"
              data-sigil={option.sigil}
              checked={sigil?.sigil === option.sigil}
              onChange={() => setSigil(option)}
              className="mt-1.5 accent-p03"
            />
            <span>
              <strong>{SIGILS[option.sigil].name}.</strong>{' '}
              <span className="font-sans text-base">{SIGILS[option.sigil].text}</span>
            </span>
          </label>
        ))}
      </fieldset>
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
      {preview?.ok && costCard && statsCard ? (
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
        disabled={!costCard || !statsCard || sending || !ready}
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
