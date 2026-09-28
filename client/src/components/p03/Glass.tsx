/** The glass over a P03 screen: scanlines, a green band rolling down, dark corners and a rare flicker. */
export function Glass({ flat = false }: { flat?: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Flat drops the dark corners, which would swallow something as small as a badge. */}
      <span className={`crt-glass absolute inset-0 ${flat ? 'flat' : ''}`} />
    </span>
  )
}
