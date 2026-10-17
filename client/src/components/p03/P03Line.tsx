import type { HTMLAttributes, ReactNode } from 'react'
import { Glass } from './Glass.tsx'

/** `rest` takes a page's rise in, as the parts around it do. */
export function P03Line({ children, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...rest}
      className="p03-screen p03-glow-soft relative overflow-hidden border border-p03-edge px-4 py-2.5 font-terminal text-xl leading-snug"
    >
      <Glass flat />
      <span className="text-p03">P03&gt;</span> {children}
    </p>
  )
}
