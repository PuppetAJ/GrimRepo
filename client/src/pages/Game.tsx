import { useSearch } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { LoadFailed } from '../components/LoadFailed.tsx'
import { Failure, Loading } from '../components/States.tsx'
import type { Seat } from '../game/controls.tsx'
import { Boot } from '../game/table/Boot.tsx'
import { TerminalTable } from '../game/TerminalTable.tsx'
import type { Layout } from '../game/text/useTextTable.ts'
import { useGame } from '../game/useGame.ts'
import { authClient, DEMO } from '../lib/auth.ts'
import { useMedia } from '../lib/useMedia.ts'

// three.js is most of the table's weight, so it loads only when the 3D table is shown.
const Table3D = lazy(() => import('../game/table/Table3D.tsx'))

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

const UPRIGHT_PHONE = '(orientation: portrait) and (max-width: 767px)'
// The wide layout's three columns need this much width.
const WIDE = '(min-width: 1100px)'
const MID = '(min-width: 560px)'
// Matches the `short` variant that puts the 3D table full screen.
const SIDEWAYS_PHONE = '(orientation: landscape) and (max-height: 32rem)'

/** Shown when a model fails to load or the WebGL context is lost. */
function TableFailed({ onText }: { onText: () => void }) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-terminal text-2xl text-p03">The 3D table could not be set.</p>
      <p className="text-sm text-muted-foreground">The game is saved; the text table plays the same one.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}

function TurnSideways({ onText }: { onText: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <RotateCw className="size-10 text-p03" aria-hidden />
      <p className="font-terminal text-2xl text-p03">The 3D table needs your phone on its side.</p>
      <p className="text-sm text-muted-foreground">Or play the same game as text, held upright.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}

export function Game() {
  const game = useGame()
  const user = authClient.useSession().data?.user as { username?: string; isAnonymous?: boolean } | undefined
  const seat: Seat = user?.username === DEMO.username ? 'demo' : user?.isAnonymous ? 'guest' : null
  // ?text picks the text table; ?layout overrides the layout, for comparing them.
  const search = useSearch({ from: '/game' })
  const [mode, setMode] = useState<Mode>(() => savedMode(search.text !== undefined))
  const upright = useMedia(UPRIGHT_PHONE)
  const wide = useMedia(WIDE)
  const mid = useMedia(MID)
  const sideways = useMedia(SIDEWAYS_PHONE)

  const choose = (next: Mode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // Private windows can refuse storage; the choice then lasts until the page closes.
    }
  }

  if (game.status === 'loading') return <Loading label="Dealing" />
  if (game.status === 'error') return <Failure title="The table is not ready" detail={game.message} />

  const layout: Layout = search.layout ?? (sideways || upright || !mid ? 'phone' : wide ? 'wide' : 'mid')
  if (mode === 'text')
    return (
      // Negative margins give the table most of the gutter; on phones, all of it.
      <div className={layout === 'phone' ? '-mx-(--gutter)' : '-mx-[calc(var(--gutter)-0.75rem)]'}>
        <h1 className="sr-only">Play against P03</h1>
        {/* Remount on a new deal or reload so playback never shows the last game. */}
        <TerminalTable key={game.generation} game={game} seat={seat} on3d={() => choose('3d')} layout={layout} />
      </div>
    )

  return (
    <div className="relative -mx-(--gutter) -my-8 h-[calc(100dvh-7rem)] min-h-[24rem] bg-[#050403] short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0">
      <h1 className="sr-only">Play against P03</h1>
      {/* The 3D table is drawn, not read, so the first stop offers the text table; it shows once focused, like a skip link. */}
      <Button
        onClick={() => choose('text')}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-50"
      >
        Play the text table, which a screen reader can follow
      </Button>
      {upright ? (
        <TurnSideways onText={() => choose('text')} />
      ) : (
        <LoadFailed fallback={<TableFailed onText={() => choose('text')} />}>
          <Suspense fallback={<Boot stage="code" />}>
            {/* Remount on a new deal or reload so the table rebuilds from the current state. */}
            <Table3D key={game.generation} game={game} seat={seat} onText={() => choose('text')} />
          </Suspense>
        </LoadFailed>
      )}
    </div>
  )
}
