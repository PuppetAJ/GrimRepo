import FaultyScreen from '../../components/p03/FaultyScreen.tsx'
import { ScaleBar, SeatNote } from '../controls.tsx'
import { Board } from './Board.tsx'
import { CancelButton, Controls, ExecuteButton, SaveStatus } from './Buttons.tsx'
import { useTable } from './context.ts'
import { Hand, Piles } from './Hand.tsx'
import { ConsolePanel } from './Log.tsx'
import { Magnifier, PromptLine, ReaderPanel } from './Reading.tsx'

/** A strip over the board, the reader and console beside it, and the hand below, all sized to fit the window. */
export function MidLayout() {
  const { frameProps, fullScreen, seat, setArea, setHandSection, view } = useTable()
  return (
    <div
      {...frameProps}
      className={`p03-screen crt mx-auto flex w-full max-w-[1792px] flex-col gap-2 overflow-hidden border border-[#2f6b3d] p-2 font-terminal text-xl sm:gap-3 sm:p-3 ${fullScreen.on ? 'fixed inset-0 z-50 overflow-y-auto' : 'relative rounded-lg'}`}
    >
      <FaultyScreen />
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
      {/* The turn, the scale as a bar, and the button, in one strip over the board. */}
      <div className="relative z-10 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] px-2 py-1">
          <p className="flex items-baseline justify-between gap-2 text-lg">
            <span className="text-p03">Turn {view.turn}</span>
            <SaveStatus className="text-sm text-p03-dim" />
          </p>
          <ScaleBar scale={view.scale} fluid className="gap-1 text-base" />
        </div>
        <ExecuteButton />
      </div>
      <div ref={setArea} className="relative z-10 flex justify-center gap-3">
        <section aria-label="The table" className="flex flex-none flex-col items-center gap-2">
          <Board />
        </section>
        {/* Pinned to the board's height so the column never makes the row taller; it takes the width left over. */}
        <div className="relative max-w-[32rem] min-w-52 flex-1">
          <div className="absolute inset-0 flex flex-col gap-3 overflow-hidden">
            {/* Here rather than over the board, where it would take the board's height. */}
            {seat ? <SeatNote seat={seat} /> : null}
            <ReaderPanel />
            <ConsolePanel />
          </div>
        </div>
      </div>
      {/* The prompt over the hand and Cancel over the piles, in two columns so their edges line up. */}
      <section
        ref={setHandSection}
        aria-label="Your hand"
        className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2"
      >
        <div className="@container flex min-w-0 items-center">
          <PromptLine />
        </div>
        <CancelButton />
        <Hand />
        <Piles />
      </section>
      <div className="relative z-10">
        <Controls />
      </div>
      <Magnifier />
    </div>
  )
}
