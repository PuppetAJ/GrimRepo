import { outcomeOf } from '../controls.tsx'
import { useP03Face } from '../mood.ts'
import { P03Face } from '../P03Dialogue.tsx'
import { useSettled } from '../tutorial/TutorialBlurb.tsx'
import { useTable } from './context.ts'
import { Items } from './Items.tsx'

export function MonitorAndTools() {
  const { view, game, busy } = useTable()
  const felt = useP03Face(view, busy ? undefined : outcomeOf(game))
  const scripted = useSettled(game.tutorial?.face, busy)
  const face = scripted ?? felt
  return (
    // Taller screens give the face more room; the scale above shrinks to make it.
    <div className="flex h-12 shrink-0 gap-4 [@media(min-height:780px)]:h-18 [@media(min-height:940px)]:h-24">
      {/* Hidden from screen readers: the log says what happened. */}
      <div
        aria-hidden
        className="grid aspect-square h-full shrink-0 place-items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-1.5"
      >
        {/* Offsets the art's empty top rows and right columns, so the head is centered. */}
        <P03Face face={face} className="w-full translate-x-[2.9%] -translate-y-[4.3%]" />
      </div>
      <Items className="h-full items-center" keepSlots />
    </div>
  )
}
