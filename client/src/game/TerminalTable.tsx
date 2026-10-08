import type { Seat } from './controls.tsx'
import { TableContext } from './text/context.ts'
import { MidLayout } from './text/MidLayout.tsx'
import { PhoneLayout } from './text/PhoneLayout.tsx'
import { Announcer } from './text/Reading.tsx'
import { useTextTable, type Layout, type RunControls } from './text/useTextTable.ts'
import { WideLayout } from './text/WideLayout.tsx'
import type { Ready } from './useGame.ts'

export function TerminalTable({
  game,
  seat,
  on3d,
  run,
  layout = 'wide',
}: {
  game: Ready
  seat: Seat
  /** Absent where the 3D table can't play this yet. */
  on3d?: () => void
  /** Set in a run, which adds its menu, deck and map. */
  run?: RunControls
  layout?: Layout
}) {
  const table = useTextTable({ game, seat, on3d, run, layout })
  return (
    <TableContext value={table}>
      {layout === 'phone' ? <PhoneLayout /> : layout === 'mid' ? <MidLayout /> : <WideLayout />}
      <Announcer />
    </TableContext>
  )
}
