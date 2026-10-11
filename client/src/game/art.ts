import { parseDeathCard, type CardType, type ItemId, type SigilId } from 'shared'

// Black-on-transparent PNGs, keyed by file name.
const byName = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]))

const CARDS = byName(import.meta.glob<string>('./art/cards/*.png', { eager: true, import: 'default' }))
const ICONS = byName(import.meta.glob<string>('./art/icons/*.png', { eager: true, import: 'default' }))
// Full-color packs from argametina's Free Card Packs, one for each starter deck.
const PACKS = byName(import.meta.glob<string>('./art/packs/*.png', { eager: true, import: 'default' }))

/** A starter deck's pack. */
export const packArt = (deck: string): string | undefined => PACKS[deck]

/** How fast an animated icon, such as the campfire's fire, plays its frames. */
export const SPRITE_FPS = 8

export type IconId = SigilId | ItemId | 'attack' | 'health' | 'fire' | 'logs' | `type-${CardType}`

/** Whether a card or icon has art of its own yet, rather than the stand-in. */
export const hasArt = (kind: 'cards' | 'icons', id: string): boolean =>
  (kind === 'cards' ? CARDS[artId(id)] : ICONS[id]) !== undefined

// A death card wears the art of the card its stats came from.
const artId = (id: string): string => parseDeathCard(id)?.art ?? id

export const cardArt = (id: string): string => CARDS[artId(id)] ?? (CARDS['placeholder'] as string)
// A sigil without its own icon yet shows the stand-in until one is drawn.
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
