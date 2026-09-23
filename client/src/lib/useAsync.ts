import { useEffect, useState } from 'react'

export type Async<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T }

/** Runs a request when its key changes and ignores answers that arrive after the page moved on. */
export function useAsync<T>(load: () => Promise<T>, key: unknown): Async<T> {
  const [result, setResult] = useState<Async<T>>({ status: 'loading' })
  useEffect(() => {
    let current = true
    setResult({ status: 'loading' })
    load().then(
      (data) => current && setResult({ status: 'ready', data }),
      (error: unknown) =>
        current && setResult({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => {
      current = false
    }
    // The key stands in for everything load depends on.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return result
}
