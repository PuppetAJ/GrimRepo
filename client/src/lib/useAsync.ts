import { useEffect, useRef, useState } from 'react'

export type Async<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T }

/** Runs a request when its key changes and ignores answers that arrive after the page moved on. */
export function useAsync<T>(load: () => Promise<T>, key: unknown): Async<T> {
  const [settled, setSettled] = useState<{ key: unknown; result: Async<T> } | null>(null)
  // The newest load, read when the key changes, so a new function each render never refetches.
  const latest = useRef(load)
  useEffect(() => {
    latest.current = load
  })

  useEffect(() => {
    let current = true
    latest.current().then(
      (data) => current && setSettled({ key, result: { status: 'ready', data } }),
      (error: unknown) =>
        current &&
        setSettled({
          key,
          result: { status: 'error', error: error instanceof Error ? error : new Error(String(error)) },
        }),
    )
    return () => {
      current = false
    }
  }, [key])

  // A result for an older key is stale, so until the new one arrives the page is loading.
  return settled && settled.key === key ? settled.result : { status: 'loading' }
}
