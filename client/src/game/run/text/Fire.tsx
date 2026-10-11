import { Sigil } from '../../CardReader.tsx'
import { Sprite } from '../../Sprite.tsx'

/** The fire's color and the logs': dark, outlined in the edge green, as the map's buttons are drawn. */
export const FIRE = '#7dff9a'
export const LOGS = '#0b1f12'
export const LOGS_EDGE = '#3f8f55'

/** The logs' outline, a pixel each way, as a CSS filter. */
export const LOGS_OUTLINE = `drop-shadow(1px 0 0 ${LOGS_EDGE}) drop-shadow(-1px 0 0 ${LOGS_EDGE}) drop-shadow(0 1px 0 ${LOGS_EDGE}) drop-shadow(0 -1px 0 ${LOGS_EDGE})`

/** The campfire burning on its logs, eight screen pixels to each of theirs; the logs sit three rows lower, over its base. */
export function FireOnLogs() {
  return (
    <span aria-hidden className="relative block h-[152px] w-32 shrink-0">
      <span className="absolute inset-x-0 top-0 flex justify-center">
        <Sprite id="fire" size={128} color={FIRE} />
      </span>
      <span className="absolute inset-x-0 top-6 flex justify-center" style={{ filter: LOGS_OUTLINE }}>
        <Sigil id="logs" size={128} color={LOGS} />
      </span>
    </span>
  )
}
