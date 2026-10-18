import { useParams, useSearch } from '@tanstack/react-router'
import { MotionRoot } from '../components/MotionRoot.tsx'
import { fixture } from '../game/fixtures.ts'
import { PlayTable } from '../game/PlayTable.tsx'
import { useLocalGame } from '../game/useLocalGame.ts'
import { NotFound } from './NotFound.tsx'

/** A fixed board, such as the worst case, to check a table holds it; development and test builds only. */
export function Board() {
  const { name } = useParams({ from: '/mockups/board/$name' })
  const found = fixture(name)
  if (!found) return <NotFound />
  return <BoardTable state={found.state} log={found.log} />
}

function BoardTable({ state, log }: { state: Parameters<typeof useLocalGame>[0]; log: string[] }) {
  const search = useSearch({ from: '/mockups/board/$name' })
  const game = useLocalGame(state, log)
  return (
    <MotionRoot>
      <PlayTable game={game} text={search.text !== undefined} layout={search.layout} title="A fixed board" />
    </MotionRoot>
  )
}
