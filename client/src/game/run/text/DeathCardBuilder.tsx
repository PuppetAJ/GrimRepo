import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  buildDeathCard,
  card,
  DEATH_NAME_LIMIT,
  deathCardId,
  deathCost,
  DEATH_STAT_MOST,
  deathCostHand,
  deathNameProblem,
  deathSigilHand,
  deathStatsHand,
} from 'shared'
import { api, ApiError, type BuiltDeathCard } from '../../../lib/api.ts'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** What the card is called before the player names it. */
const UNNAMED = 'Death Card'

/**
 * After a lost run, a card built a step at a time beside the card taking shape: its cost from one hand, its stats and
 * art from cards near that cost, its sigils from a third card, then its name.
 */
export function DeathCardBuilder({ run }: { run: RunReady }) {
  const [cost, setCost] = useState<number | null>(null)
  const [stats, setStats] = useState<number | null>(null)
  const [sigils, setSigils] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [built, setBuilt] = useState<BuiltDeathCard | null>(null)
  // Where the card being built sat, so the finished one can glide from there to the middle.
  const cardAt = useRef<HTMLDivElement>(null)
  const [from, setFrom] = useState<DOMRect | null>(null)
  const finish = (done: BuiltDeathCard) => {
    setFrom(cardAt.current?.getBoundingClientRect() ?? null)
    setBuilt(done)
  }
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(false)

  const state = run.state
  const costs = deathCostHand(state)
  const costCard = costs.find((entry) => entry.id === cost)
  const statsHand = cost === null ? [] : deathStatsHand(state, cost)
  const statsCard = statsHand.find((entry) => entry.id === stats)
  const sigilHand = cost !== null && stats !== null ? deathSigilHand(state, cost, stats) : []
  const sigilCard = sigilHand.find((entry) => entry.id === sigils)
  const problem = deathNameProblem(name)
  const choice = (named: string) => ({ cost: cost ?? -1, stats: stats ?? -1, sigils: sigils ?? -1, name: named })
  const preview = sigilCard ? buildDeathCard(state, choice(problem ? UNNAMED : name)) : null
  // Until every part is picked, a stand-in shows what is known so far.
  const shown = preview?.ok
    ? preview.id
    : deathCardId({
        name: UNNAMED,
        cost: costCard && statsCard ? deathCost(costCard, statsCard) : costCard ? card(costCard.card).cost : 0,
        // Capped as the built card is, or a huge buffed card couldn't be shown.
        attack: Math.min(statsCard?.attack ?? 0, DEATH_STAT_MOST),
        health: Math.min(statsCard?.health ?? 0, DEATH_STAT_MOST),
        art: statsCard?.card ?? 'Boilerplate',
        sigils: [],
      })
  // The server's record must be saved before it can build from it; a mockup builds here and keeps nothing.
  const mockup = run.id === -1
  const ready = mockup || run.over !== null

  if (built) return <Built built={built} mockup={mockup} from={from} />
  if (skipped)
    return (
      <p role="status" className="text-center text-lg text-p03-dim">
        No death card this time.{state.death ? ` ${card(state.death.card).name} is still yours.` : ''}
      </p>
    )

  const submit = async () => {
    setTouched(true)
    if (problem || !preview?.ok) return
    if (mockup) return finish({ card: preview.id, saved: false })
    setSending(true)
    setError(null)
    try {
      finish(await api.buildDeathCard(run.id, choice(name)))
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'The death card could not be saved. Try again.')
    } finally {
      setSending(false)
    }
  }

  // One page at a time: each pick turns to the next, and Back undoes the last.
  const page = !costCard ? 0 : !statsCard ? 1 : !sigilCard ? 2 : 3
  const back = () => {
    if (page === 3) setSigils(null)
    else if (page === 2) setStats(null)
    else if (page === 1) setCost(null)
  }
  const pages = [
    {
      title: 'Its cost',
      body: (
        <CardList
          units={costs.map((entry) => asUnit(entry))}
          onPick={(unit) => setCost(unit.uid)}
          picked={cost}
          data={(unit) => ({ 'data-action': 'death-cost', 'data-card': unit.uid })}
          size="w-20 sm:w-24"
        />
      ),
    },
    {
      title: 'Its attack, health and art',
      body: (
        <CardList
          units={statsHand.map((entry) => asUnit(entry))}
          onPick={(unit) => setStats(unit.uid)}
          picked={stats}
          data={(unit) => ({ 'data-action': 'death-stats', 'data-card': unit.uid })}
          size="w-20 sm:w-24"
        />
      ),
    },
    {
      title: 'Its sigils, every one this card has',
      body: (
        <CardList
          units={sigilHand.map((entry) => asUnit(entry))}
          onPick={(unit) => setSigils(unit.uid)}
          picked={sigils}
          data={(unit) => ({ 'data-action': 'death-sigils', 'data-card': unit.uid })}
          size="w-20 sm:w-24"
        />
      ),
    },
    {
      title: 'Its name',
      body: (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
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
              className="max-w-xs min-w-0 flex-1 rounded-md border-2 border-p03-edge bg-[#07130b] px-2 py-1 font-terminal text-lg text-p03"
            />
            <button
              type="button"
              data-action="build-death-card"
              disabled={sending || !ready}
              onClick={submit}
              className={`${SIDE_BUTTON} border-p03 px-4 disabled:opacity-50`}
            >
              {sending ? 'Building…' : ready ? 'Build it' : 'Saving the run first…'}
            </button>
          </div>
          <p id="death-name-help" className={`text-base ${touched && problem ? 'text-death' : 'text-p03-dim'}`}>
            {touched && problem ? problem : `Up to ${DEATH_NAME_LIMIT} characters.`}
          </p>
        </div>
      ),
    },
  ]
  const current = pages[page] as (typeof pages)[number]
  const skip = (
    <button
      type="button"
      data-action="skip-death-card"
      disabled={sending}
      onClick={() => setSkipped(true)}
      className={`${SIDE_BUTTON} px-4 disabled:opacity-50`}
    >
      Skip
    </button>
  )

  return (
    <section aria-labelledby="death-card" className="@container flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="death-card" className="text-2xl text-p03">
            Build a death card
          </h3>
          <p className="font-sans text-base">
            <Sentences text="Something from this run comes back to haunt the repo. What unforeseen consequences could this hold?" />
          </p>
        </div>
        <div className="hidden shrink-0 sm:block">{skip}</div>
      </div>
      <div className="grid gap-4 @2xl:grid-cols-[9rem_minmax(0,1fr)]">
        {/* The card taking shape, filled in as each part is chosen. */}
        <div className="flex flex-col items-center gap-2 self-start">
          <div ref={cardAt} className="w-36">
            <ReadableCard
              unit={asUnit(shown)}
              blank={{ cost: !costCard, art: !statsCard, stats: !statsCard, sigils: !sigilCard }}
              label="Read the card being built"
            />
          </div>
          <p className="max-w-36 truncate text-lg text-p03">{tidy(name) || UNNAMED}</p>
        </div>
        <Box className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-p03">
              {page + 1}. {current.title} <span className="text-p03-dim">· {page + 1} of 4</span>
            </h4>
            {page > 0 ? (
              <button
                type="button"
                onClick={back}
                className="text-lg text-p03-dim underline-offset-2 hover:text-p03 hover:underline"
              >
                Back
              </button>
            ) : null}
          </div>
          {/* Keyed on the page, so each one slides in as the last is locked in. */}
          {/* Slides in as a step is locked in; the first page just appears with the screen's fade. */}
          <div key={page} className={page > 0 ? 'motion-safe:animate-[page-in_180ms_ease-out]' : ''}>
            {current.body}
          </div>
        </Box>
      </div>
      {error ? (
        <p role="alert" className="text-death">
          {error}
        </p>
      ) : null}
      {/* At the bottom only when narrow; wider, it sits at the top right. */}
      <div className="flex justify-end sm:hidden">{skip}</div>
    </section>
  )
}

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ')

/** How long the card takes to "upload" before its check mark shows. */
const UPLOAD_MS = 1200

function Built({ built, mockup, from }: { built: BuiltDeathCard; mockup: boolean; from: DOMRect | null }) {
  // A short upload, then a check mark, so it's clear the card is made; skipped with reduced motion.
  const [uploaded, setUploaded] = useState(prefersReducedMotion)
  useEffect(() => {
    if (uploaded) return
    const done = setTimeout(() => setUploaded(true), UPLOAD_MS)
    return () => clearTimeout(done)
  }, [uploaded])
  // The card glides from where it was built to the middle, taking its new size on the way.
  const cardAt = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = cardAt.current
    if (!element || !from || prefersReducedMotion()) return
    const to = element.getBoundingClientRect()
    const glide = element.animate(
      [
        {
          transformOrigin: 'top left',
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`,
        },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      { duration: 500, easing: 'ease-out' },
    )
    // Cancelled on the way out, so a second run of this effect measures the card at rest, not mid-glide.
    return () => glide.cancel()
  }, [from])
  return (
    <section aria-labelledby="death-card" className="flex flex-col items-center gap-3 text-center">
      <h3 id="death-card" className="text-2xl text-p03">
        {uploaded ? `${card(built.card).name} is ready` : `Uploading ${card(built.card).name}…`}
      </h3>
      <div ref={cardAt} className="relative w-28">
        <ReadableCard unit={asUnit(built.card)} />
        {uploaded ? (
          <span
            aria-hidden
            className="absolute -top-2 -right-2 grid size-9 place-items-center rounded-full border-2 border-p03-ground bg-p03 text-p03-ground motion-safe:animate-[merge-out_250ms_ease-out_both]"
          >
            <Check className="size-6" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      {uploaded ? (
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
      ) : (
        // Below the card, filling over the upload's length, then giving way to the check mark.
        <div className="flex w-48 flex-col items-center gap-2">
          <span className="block h-3 w-full overflow-hidden rounded-full border-2 border-p03-edge">
            <span className="block h-full w-full origin-left bg-p03 motion-safe:animate-[upload_1.1s_ease-in-out_both]" />
          </span>
          <span className="text-base text-p03-dim">Pushing to the repo…</span>
        </div>
      )}
    </section>
  )
}
