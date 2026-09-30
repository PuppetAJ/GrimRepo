export function Glass({ flat = false }: { flat?: boolean }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Flat drops the vignette, which would swallow something as small as a badge. */}
      <span className={`crt-glass absolute inset-0 ${flat ? 'flat' : ''}`} />
    </span>
  )
}
