import type { ReactNode, Ref } from 'react'

export const SIDE_BUTTON =
  'rounded-md border-2 border-p03-edge bg-[#07130b] p-2 font-terminal text-lg text-p03 hover:bg-[#13261a] hover:text-p03 aria-expanded:bg-[#13261a] aria-expanded:text-p03 dark:hover:bg-[#13261a] dark:aria-expanded:bg-[#13261a]'

export const MENU_BUTTON = `${SIDE_BUTTON} flex items-center justify-center gap-2`

export function Panel({
  children,
  className = '',
  ref,
}: {
  children: ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={ref} className={`rounded-md border-2 border-p03-edge bg-[#07130b] p-3 ${className}`}>
      {children}
    </div>
  )
}
