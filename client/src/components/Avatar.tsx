import { initials } from '../lib/format.ts'

const sizes = {
  sm: 'size-6 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-20 text-4xl sm:size-24 sm:text-5xl profile:size-56 profile:text-8xl',
}

/** Initials in a circle; the only picture a player has for now. */
export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof sizes }) {
  const display = size === 'lg' ? 'font-display' : 'font-semibold'
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-foreground ${display} ${sizes[size]}`}
    >
      {size === 'lg' ? name.slice(0, 1) : initials(name)}
    </span>
  )
}
