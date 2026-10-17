import { useEffect, useState } from 'react'
import { outcomeOf } from '../controls.tsx'
import { FACE_WORDS, useP03Face } from '../mood.ts'
import { P03Face } from '../P03Dialogue.tsx'
import { useSettled } from '../tutorial/TutorialBlurb.tsx'
import { useTable } from './context.ts'

// Below this height his face sits small in one line with its word, rather than above it.
const STACKED_REM = 7.5

/** P03's face on the text table, as the 3D table shows it on his head: what he makes of the battle, in a word too. */
export function P03Monitor() {
  const { view, game, busy } = useTable()
  const felt = useP03Face(view, busy ? undefined : outcomeOf(game))
  // The tutorial's script sets his face, as on the 3D table, and only once the table has caught up.
  const scripted = useSettled(game.tutorial?.face, busy)
  const face = scripted ?? felt
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [stacked, setStacked] = useState(true)
  useEffect(() => {
    if (!box) return
    const measure = () =>
      setStacked(box.clientHeight >= STACKED_REM * parseFloat(getComputedStyle(document.documentElement).fontSize))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  const word = (
    <span>
      <span className="sr-only">P03 is </span>
      {FACE_WORDS[face]}
    </span>
  )
  return (
    <div
      ref={setBox}
      className={`flex min-h-0 flex-1 rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2 text-base text-p03-dim ${stacked ? 'flex-col' : 'items-center gap-3'}`}
    >
      <p aria-hidden className="text-p03">
        // P03
      </p>
      {stacked ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center py-1">
            <P03Face face={face} className="h-full max-h-28 w-auto max-w-full" />
          </div>
          <p className="text-center">{word}</p>
        </>
      ) : (
        <>
          <P03Face face={face} className="h-[min(2.5rem,100%)] w-auto" />
          {word}
        </>
      )}
    </div>
  )
}
