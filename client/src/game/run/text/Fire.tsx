import { Sigil } from '../../CardReader.tsx'
import { Sprite } from '../../Sprite.tsx'

/** The campfire burning on its logs, eight screen pixels to each of theirs; the logs sit three rows lower, over its base. */
export function FireOnLogs() {
  return (
    <span aria-hidden className="relative block h-[152px] w-32 shrink-0">
      <span className="absolute inset-x-0 top-0 flex justify-center">
        <Sprite id="fire" size={128} color="#ffb454" />
      </span>
      <span className="absolute inset-x-0 top-6 flex justify-center">
        <Sigil id="logs" size={128} color="#5e3a20" />
      </span>
    </span>
  )
}
