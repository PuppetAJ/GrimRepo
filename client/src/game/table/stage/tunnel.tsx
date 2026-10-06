import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'

/** Carries 3D content from wherever it's made into the one canvas that draws it, so the canvas never remounts. */
export function createTunnel() {
  let current: ReactNode = null
  const listeners = new Set<() => void>()
  const set = (node: ReactNode) => {
    current = node
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  }

  function In({ children }: { children: ReactNode }) {
    useLayoutEffect(() => set(children))
    useLayoutEffect(() => () => set(null), [])
    return null
  }

  function Out() {
    return useSyncExternalStore(subscribe, () => current)
  }

  return { In, Out }
}

export type Tunnel = ReturnType<typeof createTunnel>
