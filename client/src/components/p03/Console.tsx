import { useEffect, useRef, useState } from 'react'
import { useP03Lines } from './says.ts'

const OPEN_KEY = 'grimrepo:console'
const TYPE_MS = 28

function startsOpen(): boolean {
  try {
    const saved = localStorage.getItem(OPEN_KEY)
    if (saved) return saved === 'open'
  } catch {
    // Storage refused in a private window; fall back to the screen size.
  }
  // Open on a laptop, tucked away on a phone, where it would take a fifth of the screen.
  return window.matchMedia('(min-width: 640px)').matches
}

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** P03's console docked under the page: it types each page's lines once, and folds down to a button. */
export function Console({ onHeight }: { onHeight: (height: number) => void }) {
  const lines = useP03Lines()
  const key = lines.join('\n')
  const [open, setOpen] = useState(startsOpen)
  const [seen, setSeen] = useState(open ? key : '')
  const [typed, setTyped] = useState(0)
  const box = useRef<HTMLElement>(null)

  // Read once it has been shown open.
  useEffect(() => {
    if (open) setSeen(key)
  }, [open, key])

  // Types the lines out once when they change; reduced motion shows them whole.
  useEffect(() => {
    if (!open || still()) return setTyped(key.length)
    setTyped(0)
    const timer = window.setInterval(
      () =>
        setTyped((count) => {
          if (count >= key.length) window.clearInterval(timer)
          return Math.min(key.length, count + 2)
        }),
      TYPE_MS,
    )
    return () => window.clearInterval(timer)
    // Only new lines start the typing again; reopening shows them whole.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const silent = lines.length === 0
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(() => onHeight(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [onHeight, open, silent])

  const toggle = (next: boolean) => {
    setOpen(next)
    if (next) setTyped(key.length)
    try {
      localStorage.setItem(OPEN_KEY, next ? 'open' : 'closed')
    } catch {
      // Remembered until the page closes.
    }
  }

  if (silent) return null
  const unread = key !== seen ? lines.length : 0

  if (!open)
    return (
      <aside ref={box} aria-label="P03's console" className="fixed right-4 bottom-4 z-30 sm:right-8 sm:bottom-6">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => toggle(true)}
          className="p03-screen border border-[#2f6b3d] px-4 py-2 font-terminal text-xl text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
        >
          P03 &gt; {unread ? `${unread} new ${unread === 1 ? 'message' : 'messages'}` : 'console'}
        </button>
      </aside>
    )

  // Each line shows as much as has been typed so far.
  let left = typed
  return (
    <aside
      ref={box}
      aria-label="P03's console"
      className="p03-screen fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1 border-t border-[#2f6b3d] px-4 py-3 font-terminal text-xl leading-tight sm:px-12 sm:text-2xl"
    >
      <div className="flex items-center justify-between">
        <span className="text-p03">P03 console</span>
        <button
          type="button"
          aria-expanded
          aria-label="Fold P03's console away"
          onClick={() => toggle(false)}
          className="border border-[#2f6b3d] px-3 leading-none text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
        >
          _
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {lines.map((line, index) => {
          const shown = line.slice(0, Math.max(0, left))
          left -= line.length + 1
          return (
            <li key={index}>
              <span className="text-p03-dim">P03&gt;</span> <span className="sr-only">{line}</span>
              <span aria-hidden>{shown}</span>
            </li>
          )
        })}
        <li aria-hidden className="text-p03-dim">
          P03&gt; <span className="animate-pulse text-p03 motion-reduce:animate-none">▌</span>
        </li>
      </ul>
    </aside>
  )
}
