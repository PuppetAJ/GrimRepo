import type { ReactNode, Ref } from 'react'

// The side columns' buttons: bordered like the panels, in the terminal's type.
export const SIDE_BUTTON =
  'rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 font-terminal text-lg text-p03 hover:bg-[#13261a] hover:text-p03 aria-expanded:bg-[#13261a] aria-expanded:text-p03 dark:hover:bg-[#13261a] dark:aria-expanded:bg-[#13261a]'

// The phone layout's menu buttons: the same, with an icon before the name.
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
    <div ref={ref} className={`rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 ${className}`}>
      {children}
    </div>
  )
}
