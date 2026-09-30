import { useLayoutEffect, useRef } from 'react'

/** The first line is a fixed heading; the rest follow new lines unless scrolled back. */
export function ScreenReadout({
  lines,
  className = '',
  label,
  onClose,
}: {
  lines: string[]
  className?: string
  label?: string
  onClose?: () => void
}) {
  const [heading, ...rest] = lines
  const box = useRef<HTMLDivElement | null>(null)
  const following = useRef(true)
  useLayoutEffect(() => {
    if (box.current && following.current) box.current.scrollTop = box.current.scrollHeight
  }, [rest.length])
  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      className={`p03-screen relative flex flex-col overflow-hidden rounded-md border-2 border-p03-edge px-3 py-2 font-terminal leading-snug ${className}`}
    >
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
      <p className="flex shrink-0 justify-between gap-2">
        {heading}
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close the readout" className="px-1 text-p03">
            ✕
          </button>
        ) : null}
      </p>
      <div
        ref={box}
        onScroll={(event) => {
          const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
          following.current = scrollTop + clientHeight >= scrollHeight - 4
        }}
        className="flex min-h-0 flex-1 touch-pan-y [scrollbar-width:none] flex-col overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem)]"
      >
        {/* Pushed to the bottom while the lines don't fill the box. */}
        <div className="mt-auto">
          {rest.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
