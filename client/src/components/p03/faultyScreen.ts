import { lazy, type ComponentType } from 'react'

type Props = { bright?: number; className?: string }

// P03's screen is decoration: it loads after the page, and if it cannot, the page simply goes without it.
export const FaultyScreen = lazy((): Promise<{ default: ComponentType<Props> }> =>
  import('./FaultyScreen.tsx').catch(() => ({ default: () => null })),
)
