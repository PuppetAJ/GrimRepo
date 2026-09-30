import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton.tsx'

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  )
}

export function Failure({ title, detail, children }: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {detail ? <p className="text-muted-foreground">{detail}</p> : null}
      {children}
      <Link to="/" className="text-primary hover:underline">
        Back to the README
      </Link>
    </div>
  )
}
