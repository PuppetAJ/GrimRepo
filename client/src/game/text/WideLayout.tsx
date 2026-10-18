import FaultyScreenShader from '../../components/p03/FaultyScreenShader.tsx'
import { IntegrityBar, SeatNote } from '../controls.tsx'
import { Balance } from './Balance.tsx'
import { Board } from './Board.tsx'
import { CancelButton, Controls, ExecuteButton, SaveStatus } from './Buttons.tsx'
import { useTable } from './context.ts'
import { TurnLabel } from './TurnLabel.tsx'
import { Hand, Piles } from './Hand.tsx'
import { ConsolePanel } from './Log.tsx'
import { Panel } from './Panel.tsx'
import { MonitorAndTools } from './P03Monitor.tsx'
import { Magnifier, PromptLine, ReaderPanel } from './Reading.tsx'
import { TutorialBlurb, useSettled } from '../tutorial/TutorialBlurb.tsx'

export function WideLayout() {
  const { frameProps, frame, size, fullScreen, seat, setArea, view, game, busy } = useTable()
  const blurb = useSettled(game.tutorial?.blurb ?? null, busy)
  return (
    <>
      {fullScreen.on ? <div aria-hidden className="fixed inset-0 z-40 bg-[#030604]" /> : null}
      <div
        {...frameProps}
        ref={frame}
        // useFit owns size and position; the classes must not set either.
        style={size}
        className={`p03-screen crt grid grid-cols-[17rem_minmax(0,1fr)_22rem] grid-rows-[minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-lg border border-p03-edge p-4 font-terminal text-2xl ${fullScreen.on ? 'fixed z-50' : 'relative mx-auto'}`}
      >
        <FaultyScreenShader />
        <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
        {/* Room inside the clip for the tutorial's outline on EXECUTE. */}
        <aside
          aria-label="Turn and scale"
          className="relative z-10 -m-2 flex min-h-0 flex-col gap-3 overflow-hidden p-2"
        >
          <Panel className="flex items-center justify-between gap-2 text-2xl">
            <TurnLabel stack />
            <SaveStatus className="text-base text-p03-dim" />
          </Panel>
          <Panel className="flex flex-col gap-2">
            <Balance scale={view.scale} />
            {view.integrity ? (
              <IntegrityBar left={view.integrity.left} max={view.integrity.max} fluid className="text-xl" />
            ) : null}
          </Panel>
          <ExecuteButton />
          <MonitorAndTools />
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
        <aside aria-label="Card and console" className="relative z-10 flex min-h-0 flex-col gap-3 overflow-hidden">
          <ReaderPanel />
          <ConsolePanel />
          <CancelButton />
        </aside>
        <section
          aria-label="Your hand"
          className="relative z-10 col-span-3 flex h-[clamp(8rem,19dvh,13rem)] items-end gap-4 border-t-2 border-p03-edge pt-3"
        >
          <Controls />
          <Hand />
          <Piles />
        </section>
        {blurb ? <TutorialBlurb blurb={blurb} busy={busy} /> : null}
        <Magnifier />
      </div>
    </>
  )
}
