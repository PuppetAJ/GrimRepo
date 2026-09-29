import { useSyncExternalStore } from 'react'

/** Whether a media query matches, kept up to date as the window changes. */
export function useMedia(media: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(media)
      query.addEventListener('change', changed)
      return () => query.removeEventListener('change', changed)
    },
    () => window.matchMedia(media).matches,
    // Prerendered, no query matches; the browser's answer follows once React takes over.
    () => false,
  )
}
