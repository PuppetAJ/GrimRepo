import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  buildDeathCard,
  card,
  DEATH_NAME_LIMIT,
  deathCardId,
  deathCostHand,
  deathNameProblem,
  deathParts,
  deathSigilCard,
  deathStatsHand,
  SIGILS,
} from 'shared'
import { api, ApiError, type BuiltDeathCard } from '../../../lib/api.ts'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { PixelCard } from '../../CardReader.tsx'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'

/** What the card is called before the player names it. */
const UNNAMED = 'Death Card'

/**
 * After a lost run, a card built a step at a time beside the card taking shape: its cost from one hand, its stats and
 * art from cards near that cost, its sigils from a card chance picks, then its name.
 */
export function DeathCardBuilder({ run }: { run: RunReady }) {
  const [cost, setCost] = useState<number | null>(null)
  const [stats, setStats] = useState<number | null>(null)
  const [rolled, setRolled] = useState(false)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [built, setBuilt] = useState<BuiltDeathCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(false)

  const state = run.state
  const costs = deathCostHand(state)
  const costCard = costs.find((entry) => entry.id === cost)
  const statsHand = cost === null ? [] : deathStatsHand(state, cost)
  const statsCard = statsHand.find((entry) => entry.id === stats)
  const chance = cost !== null && stats !== null ? deathSigilCard(state, cost, stats) : null
  const problem = deathNameProblem(name)
  const choice = (named: string) => ({ cost: cost ?? -1, stats: stats ?? -1, name: named })
  const preview = costCard && statsCard ? buildDeathCard(state, choice(problem ? UNNAMED : name)) : null
  // Until the stats are picked, a stand-in shows what is known so far.
  const shown = preview?.ok
    ? preview.id
    : deathCardId({
        name: UNNAMED,
        cost: costCard ? card(costCard.card).cost : 0,
        attack: 0,
        health: 0,
        art: 'Boilerplate',
        sigils: [],
      })
  // The server's record must be saved before it can build from it; a mockup builds here and keeps nothing.
  const mockup = run.id === -1
  const ready = mockup || run.over !== null

  if (built) return <Built built={built} mockup={mockup} />
  if (skipped)
    return (
      <p role="status" className="text-center text-lg text-p03-dim">
        No death card this time.{state.death ? ` ${card(state.death.card).name} is still yours.` : ''}
      </p>
    )

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
    <section aria-labelledby="death-card" className="@container flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="death-card" className="text-2xl text-p03">
          Build a death card
        </h3>
        <p className="font-sans text-base">Something of this run comes back. P03 brings it to the final boss.</p>
      </div>
      <div className="grid gap-4 @2xl:grid-cols-[9rem_minmax(0,1fr)]">
        {/* The card taking shape, filled in as each part is chosen. */}
        <div className="flex flex-col items-center gap-2 self-start @2xl:sticky @2xl:top-0">
          <div className="w-36">
            <ReadableCard
              unit={asUnit(shown)}
              blank={{ cost: !costCard, art: !statsCard, stats: !statsCard, sigils: !rolled }}
              label="Read the card being built"
            />
          </div>
          <p className="max-w-36 truncate text-lg text-p03">{tidy(name) || UNNAMED}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Step number={1} title="Its cost">
            <CardList
              units={costs.map((entry) => asUnit(entry))}
              onPick={(unit) => {
                setCost(unit.uid === cost ? null : unit.uid)
                setStats(null)
                setRolled(false)
              }}
              picked={cost}
              data={(unit) => ({ 'data-action': 'death-cost', 'data-card': unit.uid })}
              size="w-20 sm:w-24"
            />
          </Step>
          {costCard ? (
            <Step number={2} title="Its attack, health and art">
              <CardList
                units={statsHand.map((entry) => asUnit(entry))}
                onPick={(unit) => {
                  setStats(unit.uid === stats ? null : unit.uid)
                  setRolled(false)
                }}
                picked={stats}
                data={(unit) => ({ 'data-action': 'death-stats', 'data-card': unit.uid })}
                size="w-20 sm:w-24"
              />
            </Step>
          ) : null}
          {costCard && statsCard ? (
            <Step number={3} title="Its sigils, left to chance">
              <Roll key={`${cost}-${stats}`} run={run} landsOn={chance} onDone={() => setRolled(true)} />
            </Step>
          ) : null}
          {rolled ? (
            <Step number={4} title="Its name">
              <div className="flex flex-col gap-1">
                <input
                  id="death-name"
                  aria-label="Its name"
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
            </Step>
          ) : null}
          {error ? (
            <p role="alert" className="text-death">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {rolled ? (
              <button
                type="button"
                data-action="build-death-card"
                disabled={sending || !ready}
                onClick={submit}
                className={`${SIDE_BUTTON} border-p03 px-4 disabled:opacity-50`}
              >
                {sending ? 'Building…' : ready ? 'Build it' : 'Saving the run first…'}
              </button>
            ) : null}
            <button
              type="button"
              data-action="skip-death-card"
              disabled={sending}
              onClick={() => setSkipped(true)}
              className={`${SIDE_BUTTON} px-4 disabled:opacity-50`}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ')

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <Box className="flex flex-col gap-2 motion-safe:animate-[fade-in_250ms_ease-out]">
      <h4 className="text-p03">
        {number}. {title}
      </h4>
      {children}
    </Box>
  )
}

/** How long chance takes to settle on a card, and how fast the cards flick past before it does. */
const ROLL_MS = 1400
const FLICK_MS = 90

/** Flicks through the deck and lands on the card chance picked, then says what it gives. */
function Roll({
  run,
  landsOn,
  onDone,
}: {
  run: RunReady
  landsOn: ReturnType<typeof deathSigilCard>
  onDone: () => void
}) {
  const parts = deathParts(run.state.deck)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(() => prefersReducedMotion() || parts.length < 2)
  // The latest callback, so a new one each render doesn't restart the roll.
  const finished = useRef(onDone)
  useEffect(() => {
    finished.current = onDone
  })
  useEffect(() => {
    if (done) return void finished.current()
    const flick = setInterval(() => setIndex((now) => (now + 1) % parts.length), FLICK_MS)
    const settle = setTimeout(() => setDone(true), ROLL_MS)
    return () => {
      clearInterval(flick)
      clearTimeout(settle)
    }
  }, [done, parts.length])
  const showing = done ? landsOn : parts[index]
  if (!showing) return <p className="text-p03-dim">No card to take sigils from.</p>
  return (
    <div className="flex items-center gap-4">
      <div className={`w-20 shrink-0 sm:w-24 ${done ? 'motion-safe:animate-[warm-pop_650ms_ease-out]' : ''}`}>
        <PixelCard unit={asUnit(showing)} />
      </div>
      <p role={done ? 'status' : undefined} className="text-lg">
        {!done
          ? 'Shuffling…'
          : showing.sigils.length
            ? `${card(showing.card).name} gives ${showing.sigils.map((sigil) => SIGILS[sigil].name).join(' and ')}.`
            : `${card(showing.card).name} has no sigils to give.`}
      </p>
    </div>
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
          <ReadableCard unit={asUnit(built.card)} />
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
