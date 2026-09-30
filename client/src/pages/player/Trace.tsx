import { Suspense } from 'react'
import { TURN_LIMIT } from 'shared'
import { Corruption } from '../../components/p03/Corruption.tsx'
import { FrameDamage } from '../../components/p03/FrameDamage.tsx'
import { Glass } from '../../components/p03/Glass.tsx'
import { number } from '../../lib/format.ts'
import { FaultyScreen } from '../../components/p03/FaultyScreen.ts'
import { hashOf, type Game } from './games.ts'

export function Trace({ game }: { game: Game }) {
  const frames = game.forfeited
    ? ['at you.forfeit()', `at factory.table (turn ${game.turns})`]
    : game.turns >= TURN_LIMIT
      ? [`at turn.limit(${TURN_LIMIT})`, 'at factory.table (ran out of time)']
      : ['at scale.tip(p03)', `at factory.table (turn ${game.turns})`, 'at deck.synergy() -> null']
  return (
    // The margins leave room for the corruption outside the frame.
    <div className="relative mx-6 mt-4 mb-5">
      <FrameDamage frame="trace" />
      <Corruption dense fast cols={12} rows={2} corner="bottom-right" seed={43} className="right-0 bottom-full" />
      <Corruption dense fast cols={10} rows={1} corner="top-left" seed={71} className="top-full left-0" />
      <Corruption dense fast cols={8} rows={1} corner="top-right" seed={89} className="top-full right-0" />
      <Corruption dense fast cols={3} rows={9} corner="top-right" seed={17} className="top-0 right-full" />
      <Corruption dense fast cols={3} rows={9} corner="bottom-left" seed={23} className="bottom-0 left-full" />
      <div className="p03-screen p03-glow-soft relative isolate overflow-hidden border border-p03-edge px-4 py-3 font-terminal text-xl leading-tight sm:text-[1.35rem]">
        <Suspense fallback={null}>
          <FaultyScreen className="-z-10" />
        </Suspense>
        <Glass />
        <Corruption dense cols={2} rows={5} corner="bottom-right" seed={29} className="right-0 bottom-0" />
        <p className="flex flex-wrap justify-between gap-x-4">
          <span className="text-[#ff7a6b]">
            {game.forfeited ? 'SIGTERM' : 'FATAL'} game {game.forfeited ? 'abandoned' : 'lost'} on turn {game.turns}
          </span>
          <span className="text-p03-dim">
            {hashOf(game)} · {number(game.score)}
          </span>
        </p>
        {frames.map((frame) => (
          <p key={frame} className="pl-6 text-p03-dim">
            {frame}
          </p>
        ))}
        <p className="mt-1">
          <span className="text-p03">P03&gt;</span>{' '}
          {game.forfeited ? 'Walking away? Typical.' : 'Weak cards. Total lack of synergy.'}
        </p>
      </div>
    </div>
  )
}
