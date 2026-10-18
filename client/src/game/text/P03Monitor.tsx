import { useEffect, useState } from 'react'
import { outcomeOf } from '../controls.tsx'
import { useP03Face } from '../mood.ts'
import { P03Face } from '../P03Dialogue.tsx'
import { useSettled } from '../tutorial/TutorialBlurb.tsx'
import { useTable } from './context.ts'
import { Items } from './Items.tsx'

// His square; the most the column holds beside three tools in a row. Below this height there's no room for him.
const FITS_REM = 6

/**
 * P03's face on the wide text table, as the 3D table shows it on his head, with the tools beside it. Where the column
 * is too short for his face, as Processes was before it, only the tools show, in their usual row.
 */
export function MonitorAndTools() {
  const { view, game, busy } = useTable()
  const felt = useP03Face(view, busy ? undefined : outcomeOf(game))
  // The tutorial's script sets his face, as on the 3D table, and only once the table has caught up.
  const scripted = useSettled(game.tutorial?.face, busy)
  const face = scripted ?? felt
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [fits, setFits] = useState(true)
  useEffect(() => {
    if (!box) return
    const measure = () =>
      setFits(box.clientHeight >= FITS_REM * parseFloat(getComputedStyle(document.documentElement).fontSize))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  return (
    <div ref={setBox} className="flex min-h-0 flex-1 items-start gap-4">
      {fits ? (
        <>
          {/* A square, only a picture of what the 3D table shows; the log says what happened. */}
          <div
            aria-hidden
            className="grid size-24 shrink-0 place-items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2"
          >
            {/* Nudged so the monitor's body is what's centered, not the art with its fins and corner stub. */}
            <P03Face face={face} className="w-full translate-x-[2.9%] -translate-y-[4.8%]" />
          </div>
          {/* Beside him, left to right, level with his face. */}
          <Items className="h-24 items-center" keepSlots />
        </>
      ) : (
        <Items className="w-full justify-center self-start" />
      )}
    </div>
  )
}
