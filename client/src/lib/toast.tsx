import { lazy, Suspense, useEffect, useState } from 'react'

// sonner stays out of the first load: its toaster mounts once the page is idle, and each toast waits for it.
const Toaster = lazy(() => import('@/components/ui/sonner.tsx').then((module) => ({ default: module.Toaster })))

let mounted = () => {}
const ready = new Promise<void>((resolve) => (mounted = resolve))
let want = () => {}
let wanted = false

function show(kind: 'success' | 'error' | 'warning', message: string) {
  wanted = true
  want()
  void Promise.all([import('sonner'), ready]).then(([{ toast: sonner }]) => sonner[kind](message))
}

export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  warning: (message: string) => show('warning', message),
}

function Mounted() {
  useEffect(() => mounted(), [])
  return null
}

/** Renders nothing at first, so the prerendered page hydrates; the toaster's region is in place before any toast. */
export function Toasts() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const start = () => setOn(true)
    if (wanted) return start()
    want = start
    // Safari has no requestIdleCallback before 18.
    const idle = 'requestIdleCallback' in window
    const handle = idle ? window.requestIdleCallback(start, { timeout: 3000 }) : window.setTimeout(start, 1500)
    return () => {
      want = () => {}
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [])
  return on ? (
    <Suspense fallback={null}>
      <Toaster />
      <Mounted />
    </Suspense>
  ) : null
}
