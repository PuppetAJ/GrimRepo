import type { Seat } from './controls.tsx'
import { TableContext } from './text/context.ts'
import { MidLayout } from './text/MidLayout.tsx'
import { PhoneLayout } from './text/PhoneLayout.tsx'
import { useTextTable, type Layout } from './text/useTextTable.ts'
import { WideLayout } from './text/WideLayout.tsx'
import type { Ready } from './useGame.ts'

// The text table, in P03's green: Inscryption's Act 2 laid out for the width it has, its pieces in `text/`.

/** The text table: a whole game through its buttons, played back one move at a time. */
export function TerminalTable({
  game,
  seat,
  on3d,
  layout = 'wide',
}: {
  game: Ready
  seat: Seat
  on3d: () => void
  layout?: Layout
}) {
  const table = useTextTable({ game, seat, on3d, layout })
  return (
    <TableContext value={table}>
      {layout === 'phone' ? <PhoneLayout /> : layout === 'mid' ? <MidLayout /> : <WideLayout />}
    </TableContext>
  )
}
