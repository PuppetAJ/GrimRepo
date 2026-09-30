import FaultyScreenShader from '../../components/p03/FaultyScreenShader.tsx'
import { SeatNote } from '../controls.tsx'
import { Balance } from './Balance.tsx'
import { Board } from './Board.tsx'
import { CancelButton, Controls, ExecuteButton, SaveStatus } from './Buttons.tsx'
import { useTable } from './context.ts'
import { Hand, Piles } from './Hand.tsx'
import { ConsolePanel } from './Log.tsx'
import { Panel } from './Panel.tsx'
import { Processes } from './Processes.tsx'
import { Magnifier, PromptLine, ReaderPanel } from './Reading.tsx'

export function WideLayout() {
  const { frameProps, frame, size, fullScreen, seat, setArea, view } = useTable()
  return (
    <>
      {fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
      <div
        {...frameProps}
        ref={frame}
        // useFit owns size and position; the classes must not set either.
        style={size}
        className={`p03-screen crt grid grid-cols-[17rem_minmax(0,1fr)_22rem] grid-rows-[minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-lg border border-[#2f6b3d] p-4 font-terminal text-2xl ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`}
      >
        <FaultyScreenShader />
        <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
        <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
          <Panel className="flex items-center justify-between text-2xl">
            <span className="text-p03">Turn {view.turn}</span>
            <SaveStatus className="text-base text-p03-dim" />
          </Panel>
          <Panel>
            <Balance scale={view.scale} />
          </Panel>
          <ExecuteButton />
          <Processes />
        </aside>
        <section aria-label="The table" className="relative z-10 flex min-h-0 flex-col items-center gap-2">
          {seat ? <SeatNote seat={seat} /> : null}
          <div ref={setArea} className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Board />
          </div>
          <div className="@container w-full">
            <PromptLine />
          </div>
        </section>
        <aside className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
          <ReaderPanel />
          <ConsolePanel />
          <CancelButton />
        </aside>
        <section
          aria-label="Your hand"
          className="relative z-10 col-span-3 flex h-[clamp(8rem,19dvh,13rem)] items-end gap-4 border-t-2 border-[#2f6b3d] pt-3"
        >
          <Controls />
          <Hand />
          <Piles />
        </section>
        <Magnifier />
      </div>
    </>
  )
}
