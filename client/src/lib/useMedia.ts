import { useSyncExternalStore } from 'react'

const prerenderSnapshot = () => false

export function useMedia(media: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(media)
      query.addEventListener('change', changed)
      return () => query.removeEventListener('change', changed)
    },
    () => window.matchMedia(media).matches,
    prerenderSnapshot,
  )
}
