import { lazy, type ComponentType } from 'react'

type Props = { bright?: number; className?: string }

// Decoration only: it loads after the page, and a failed load renders nothing.
export const FaultyScreen = lazy((): Promise<{ default: ComponentType<Props> }> =>
  import('./FaultyScreen.tsx').catch(() => ({ default: () => null })),
)
