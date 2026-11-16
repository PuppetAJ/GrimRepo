import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { LoadFailed } from '../components/LoadFailed.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { FIXTURES_ON } from './fixtures.ts'
import { useLeaveFullScreen } from './fullScreen.ts'
import { useLayoutChoice } from './layoutChoice.ts'
import type { Game } from './ready.ts'
import { useKeepTableFocus } from './shortcuts.ts'
import { TableBox } from './TableBox.tsx'
import { Boot } from './table/Boot.tsx'
import { TableFailed, TurnSideways } from './tableNotices.tsx'
import { TerminalTable } from './TerminalTable.tsx'
import type { Layout } from './text/useTextTable.ts'

const Table3D = lazy(() => import('./table/Table3D.tsx'))

type Mode = '3d' | 'text'
const MODE_KEY = 'grimrepo:table'

function savedMode(text: boolean): Mode {
  try {
    if (text) localStorage.setItem(MODE_KEY, 'text')
    return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : '3d'
  } catch {
    return '3d'
  }
}

export function PlayTable({
  game,
  text,
  layout: forced,
  title,
}: {
  game: Game
  text: boolean
  layout?: Layout
  title: string
}) {
  useKeepTableFocus()
  useLeaveFullScreen()
  const [mode, setMode] = useState<Mode>(() => savedMode(text))
  const { layout, upright } = useLayoutChoice(FIXTURES_ON ? forced : undefined)

  const choose = (next: Mode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {}
  }

  if (game.status === 'loading') return <Loading label="Dealing" />
  if (game.status === 'error') return <Failure title="The table is not ready" detail={game.message} />

  if (mode === 'text')
    return (
      <div className={layout === 'phone' ? '-mx-(--gutter)' : '-mx-[calc(var(--gutter)-0.75rem)]'}>
        <h1 className="sr-only">{title}</h1>
        <TerminalTable key={game.generation} game={game} seat={null} on3d={() => choose('3d')} layout={layout} />
      </div>
    )

  return (
    <TableBox>
      <h1 className="sr-only">{title}</h1>
      <Button
        onClick={() => choose('text')}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-50"
      >
        Play the text table, which a screen reader can follow
      </Button>
      <LoadFailed fallback={(error) => <TableFailed error={error} onText={() => choose('text')} />}>
        <Suspense fallback={<Boot stage="code" />}>
          <Table3D key={game.generation} game={game} seat={null} onText={() => choose('text')} />
        </Suspense>
      </LoadFailed>
      {upright ? (
        <div className="fixed inset-0 z-[60] bg-background">
          <TurnSideways onText={() => choose('text')} />
        </div>
      ) : null}
    </TableBox>
  )
}
