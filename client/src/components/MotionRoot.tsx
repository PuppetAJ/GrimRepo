import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Motion for the pages that animate: `m` components only, with the smaller feature set (no layout animations), loaded
 * with the page so a stale deploy is caught by the page's own reload; reduced motion is respected.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
