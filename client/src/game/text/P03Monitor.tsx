import { useEffect, useState } from 'react'
import { outcomeOf } from '../controls.tsx'
import { useP03Face } from '../mood.ts'
import { P03Face } from '../P03Dialogue.tsx'
import { useSettled } from '../tutorial/TutorialBlurb.tsx'
import { useTable } from './context.ts'
import { Items } from './Items.tsx'

// Pixels: the face's square shrinks to the room left, down to SMALLEST; with less room, only the tools show.
const LARGEST = 96
const SMALLEST = 64

export function MonitorAndTools() {
  const { view, game, busy } = useTable()
  const felt = useP03Face(view, busy ? undefined : outcomeOf(game))
  const scripted = useSettled(game.tutorial?.face, busy)
  const face = scripted ?? felt
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState(LARGEST)
  useEffect(() => {
    if (!box) return
    const measure = () => setSize(Math.min(LARGEST, Math.floor(box.clientHeight)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  return (
    <div ref={setBox} className="flex min-h-0 flex-1 items-start gap-4">
      {size >= SMALLEST ? (
        <>
          {/* Hidden from screen readers: the log says what happened. */}
          <div
            aria-hidden
            className="grid shrink-0 place-items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2"
            style={{ width: size, height: size }}
          >
            {/* Offsets the fins, so the monitor's body is what's centered. */}
            <P03Face face={face} className="w-full translate-x-[2.9%] -translate-y-[4.8%]" />
          </div>
          <Items className="items-center" keepSlots style={{ height: size }} />
        </>
      ) : (
        <Items className="w-full justify-center self-start" />
      )}
    </div>
  )
}
