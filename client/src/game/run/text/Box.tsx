import type { ReactNode } from 'react'

export function Box({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border-2 border-p03-edge bg-[#07130b]/70 p-3 sm:p-4 ${className}`}>{children}</div>
}
