import { useEffect, useRef, useState } from 'react'

export type Async<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T }

export function useAsync<T>(load: () => Promise<T>, key: unknown): Async<T> {
  const [settled, setSettled] = useState<{ key: unknown; result: Async<T> } | null>(null)
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

  return settled && settled.key === key ? settled.result : { status: 'loading' }
}
