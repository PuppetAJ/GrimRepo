import { useSearch } from '@tanstack/react-router'
import { MotionRoot } from '../components/MotionRoot.tsx'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { useTutorial } from '../game/tutorial/useTutorial.tsx'
import { PlayTable } from './Game.tsx'

/** The scripted first battle, played locally: nothing is saved, so no account is needed. */
export function Tutorial() {
  // ?step opens on a later step, counted from 1, for the mockups and tests.
  const search = useSearch({ from: '/tutorial' })
  const step = FIXTURES_ON ? Math.max(0, (Number(search.step) || 1) - 1) : 0
  return (
    <MotionRoot>
      <TutorialTable key={step} step={step} text={search.text !== undefined} layout={search.layout} />
    </MotionRoot>
  )
}

function TutorialTable({ step, text, layout }: { step: number; text: boolean; layout?: 'wide' | 'mid' | 'phone' }) {
  const game = useTutorial(step)
  return <PlayTable game={game} text={text} layout={layout} title="Learn to play against P03" />
}
