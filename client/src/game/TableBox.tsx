import type { HTMLAttributes, ReactNode } from 'react'
import { useWideTable } from './wideTable.ts'

/**
 * The 3D table's box: the window's height under the header, and the site's width unless the player widens it to the
 * window's, at most 21:9. On a sideways phone it takes the whole screen.
 */
export function TableBox({ children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const { wide } = useWideTable()
  return (
    <div
      {...rest}
      className="relative -mx-(--gutter) -my-8 h-[calc(100dvh-7rem)] min-h-[24rem] short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0"
    >
      <div
        className={`relative mx-auto h-full w-full bg-[#050403] transition-[max-width] duration-500 ease-out motion-reduce:transition-none short:max-w-none ${wide ? 'max-w-[calc((100dvh-7rem)*21/9)]' : 'max-w-[100rem]'}`}
      >
        {children}
      </div>
    </div>
  )
}
