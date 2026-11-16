import { parseDeathCard, type CardType, type ItemId, type SigilId } from 'shared'

const byName = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]))

const CARDS = byName(import.meta.glob<string>('./art/cards/*.png', { eager: true, import: 'default' }))
const ICONS = byName(import.meta.glob<string>('./art/icons/*.png', { eager: true, import: 'default' }))
const PACKS = byName(
  import.meta.glob<string>('./art/packs/*.png', { eager: true, query: '?no-inline', import: 'default' }),
)

const P03 = byName(import.meta.glob<string>('./art/p03/*.png', { eager: true, import: 'default' }))

export const p03Art = (id: string): string | undefined => P03[id]

export const packArt = (id: string): string | undefined => PACKS[id]

export const SPRITE_FPS = 8

export type IconId = SigilId | ItemId | 'attack' | 'health' | 'fire' | 'logs' | 'death' | `type-${CardType}`

export const hasArt = (kind: 'cards' | 'icons' | 'p03', id: string): boolean =>
  (kind === 'cards' ? CARDS[artId(id)] : kind === 'p03' ? P03[id] : ICONS[id]) !== undefined

const artId = (id: string): string => parseDeathCard(id)?.art ?? id

export const cardArt = (id: string): string => CARDS[artId(id)] ?? (CARDS['placeholder'] as string)
export const iconArt = (id: IconId): string => ICONS[id] ?? (ICONS['placeholder'] as string)

const images = new Map<string, HTMLImageElement>()
let decoding: Promise<void> | null = null

/** The 3D table's canvases can only draw decoded images, so it awaits this first. */
export function loadArt(): Promise<void> {
  decoding ??= Promise.all(
    [...Object.values(CARDS), ...Object.values(ICONS)].map(async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      images.set(url, image)
    }),
  ).then(() => undefined)
  return decoding
}

export const cardImage = (id: string) => images.get(cardArt(id)) as HTMLImageElement
export const iconImage = (id: IconId) => images.get(iconArt(id)) as HTMLImageElement
