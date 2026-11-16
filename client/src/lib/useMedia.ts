import { useSyncExternalStore } from 'react'

export function useMedia(media: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(media)
      query.addEventListener('change', changed)
      return () => query.removeEventListener('change', changed)
    },
    () => window.matchMedia(media).matches,
    () => false,
  )
}
