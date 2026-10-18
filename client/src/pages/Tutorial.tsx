import { useSearch } from '@tanstack/react-router'
import { MotionRoot } from '../components/MotionRoot.tsx'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { useTutorial } from '../game/tutorial/useTutorial.tsx'
import { PlayTable } from './Game.tsx'

export function Tutorial() {
  // ?step opens a later step, counted from 1, outside production.
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
