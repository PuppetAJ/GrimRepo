import type { ReactNode } from 'react'
import { Glass } from './Glass.tsx'

export function P03Line({ children }: { children: ReactNode }) {
  return (
    <p className="p03-screen p03-glow-soft relative overflow-hidden border border-[#2f6b3d] px-4 py-2.5 font-terminal text-xl leading-snug">
      <Glass flat />
      <span className="text-p03">P03&gt;</span> {children}
    </p>
  )
}
