import { createContext, use } from 'react'

export type Mode = 'terminal' | 'floating' | 'hologram'
type Slots = { actions: HTMLElement | null; bar: HTMLElement | null; deckShown: boolean; mode: Mode }

/** Where a screen's own controls go in its frame, and which frame it is. */
export const SlotContext = createContext<Slots>({ actions: null, bar: null, deckShown: false, mode: 'terminal' })

/** Whether the screen is the text table's terminal or over the 3D table, where its parts are see-through. */
export const useScreenMode = () => use(SlotContext).mode
