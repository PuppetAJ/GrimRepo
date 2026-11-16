import { lazy, type ComponentType } from 'react'

type Props = { bright?: number; className?: string }

export const FaultyScreen = lazy((): Promise<{ default: ComponentType<Props> }> =>
  import('./FaultyScreenShader.tsx').catch(() => ({ default: () => null })),
)
