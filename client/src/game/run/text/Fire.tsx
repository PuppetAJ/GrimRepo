import { Sigil } from '../../CardReader.tsx'
import { Sprite } from '../../Sprite.tsx'

/** The fire's color and the logs', in P03's greens, the logs the darker. */
export const FIRE = '#7dff9a'
export const LOGS = '#1f5a34'

/** The campfire burning on its logs, eight screen pixels to each of theirs; the logs sit three rows lower, over its base. */
export function FireOnLogs() {
  return (
    <span aria-hidden className="relative block h-[152px] w-32 shrink-0">
      <span className="absolute inset-x-0 top-0 flex justify-center">
        <Sprite id="fire" size={128} color={FIRE} />
      </span>
      <span className="absolute inset-x-0 top-6 flex justify-center">
        <Sigil id="logs" size={128} color={LOGS} />
      </span>
    </span>
  )
}
