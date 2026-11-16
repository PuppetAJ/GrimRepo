import { createContext, use } from 'react'

export type Mode = 'terminal' | 'floating' | 'hologram'
type Slots = {
  actions: HTMLElement | null
  bar: HTMLElement | null
  center: HTMLElement | null
  mode: Mode
}

export const SlotContext = createContext<Slots>({
  actions: null,
  bar: null,
  center: null,
  mode: 'terminal',
})

export const useScreenMode = () => use(SlotContext).mode
