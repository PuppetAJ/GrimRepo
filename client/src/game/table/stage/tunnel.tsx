import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react'

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
