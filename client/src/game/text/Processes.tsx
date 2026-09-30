import { useEffect, useState } from 'react'

const PROCESSES = ['p03.core', 'scale.svc', 'sacrifice.d', 'lane.watch', 'gc.reaper', 'deck.shuf']

export function Processes() {
  const [tick, setTick] = useState(0)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 900)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!box) return
    // 4.5rem: the heading and one line at about 1.5rem each, plus padding.
    const measure = () =>
      setFits(box.clientHeight >= 4.5 * parseFloat(getComputedStyle(document.documentElement).fontSize))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  // Smooth waves instead of random noise, so the load reads as steady work.
  const load = (i: number) =>
    Math.round(4 + 4 * (1 + Math.sin(tick * 0.7 + i * 1.9)) * (0.5 + 0.5 * Math.cos(tick * 0.23 + i)))
  return (
    <div ref={setBox} aria-hidden className="min-h-0 flex-1">
      {fits ? (
        <div className="flex h-full flex-col overflow-y-auto rounded-md border-2 border-[#1f3a26] bg-[#050d07] p-2 text-base text-p03-dim">
          <p className="text-p03">// PROCESSES</p>
          {PROCESSES.map((name, i) => (
            <p key={name} className="flex justify-between gap-2 whitespace-pre">
              <span>{name}</span>
              <span className="text-p03">{'|'.repeat(load(i)).padEnd(12, '.')}</span>
            </p>
          ))}
          <p className="mt-auto pt-1">
            mem {String(40 + ((tick * 7) % 23)).padStart(2)}% · up {tick}s
            <span className={tick % 2 ? 'invisible' : ''}>_</span>
          </p>
        </div>
      ) : null}
    </div>
  )
}
