import { RotateCw } from 'lucide-react'
import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { Failure, Loading } from '../components/States.tsx'
import type { Seat } from '../game/controls.tsx'
import { Boot } from '../game/table/Boot.tsx'
import { TerminalTable } from '../game/TerminalTable.tsx'
import type { Layout } from '../game/text/useTextTable.ts'
import { useGame } from '../game/useGame.ts'
import { authClient, DEMO } from '../lib/auth.ts'
import { useMedia } from '../lib/useMedia.ts'

// three.js is most of the table's weight, so it loads only when someone sits down at it.
const Table3D = lazy(() => import('../game/table/Table3D.tsx'))

type Mode = '3d' | 'text'
const MODE_KEY = 'grimrepo:table'

function savedMode(): Mode {
  try {
    // Asking for a text layout in the address asks for the text table too.
    if (new URLSearchParams(window.location.search).has('text')) localStorage.setItem(MODE_KEY, 'text')
    return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : '3d'
  } catch {
    return '3d'
  }
}

const UPRIGHT_PHONE = '(orientation: portrait) and (max-width: 767px)'
// The Act 2 layout's three columns need this much width; narrower, the board sits beside the card reader.
const WIDE = '(min-width: 1100px)'
// Down to this width; narrower still, the phone layout.
const MID = '(min-width: 560px)'
// A phone on its side, as short as the 3D table's full-screen switch; it gets the phone layout, as an upright one does.
const SIDEWAYS_PHONE = '(orientation: landscape) and (max-height: 32rem)'

// ?layout=wide, mid or phone forces one, to compare them.
function askedLayout(): Layout | null {
  const asked = new URLSearchParams(window.location.search).get('layout')
  return asked === 'wide' || asked === 'mid' || asked === 'phone' ? asked : null
}

/** A model that fails to load, or a lost WebGL context, offers the text table rather than a broken page. */
class TableFailed extends Component<{ onText: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-terminal text-2xl text-p03">The 3D table could not be set.</p>
        <p className="text-sm text-muted-foreground">The game is saved; the text table plays the same one.</p>
        <Button onClick={this.props.onText}>Play the text version</Button>
      </div>
    )
  }
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
  const [mode, setMode] = useState<Mode>(savedMode)
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

  const layout: Layout = askedLayout() ?? (sideways || upright || !mid ? 'phone' : wide ? 'wide' : 'mid')
  if (mode === 'text')
    return (
      // Into most of the page's side padding, so the table has the width and only thin gutters remain; a phone's
      // table goes edge to edge.
      <div className={layout === 'phone' ? '-mx-4 sm:-mx-12' : '-mx-2 sm:-mx-9'}>
        <TerminalTable game={game} seat={seat} on3d={() => choose('3d')} layout={layout} />
      </div>
    )

  return (
    // The table fills the page under the header, edge to edge, and the whole screen on a phone held sideways.
    <div className="relative -mx-4 -my-8 h-[calc(100dvh-7rem)] min-h-[24rem] bg-[#050403] sm:-mx-12 short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0">
      {upright ? (
        <TurnSideways onText={() => choose('text')} />
      ) : (
        <TableFailed onText={() => choose('text')}>
          <Suspense fallback={<Boot stage="code" />}>
            {/* A new deal or a reload sets the table again from the state as it is. */}
            <Table3D key={game.generation} game={game} seat={seat} onText={() => choose('text')} />
          </Suspense>
        </TableFailed>
      )}
    </div>
  )
}
