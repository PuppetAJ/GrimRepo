import type { SigilId } from 'shared'

// One PNG per card and per icon, black on clear; a card without its own art shows the placeholder.
const byName = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]))

const CARDS = byName(import.meta.glob<string>('./art/cards/*.png', { eager: true, import: 'default' }))
const ICONS = byName(import.meta.glob<string>('./art/icons/*.png', { eager: true, import: 'default' }))

export type IconId = SigilId | 'attack' | 'health'

export const cardArt = (id: string): string => CARDS[id] ?? (CARDS['placeholder'] as string)
export const iconArt = (id: IconId): string => ICONS[id] as string

const images = new Map<string, HTMLImageElement>()
let decoding: Promise<void> | null = null

/** Decodes every image once, for the 3D table's canvases, which can only draw what has loaded. */
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
