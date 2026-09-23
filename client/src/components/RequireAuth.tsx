import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { authClient } from '../lib/auth.ts'
import { Loading } from './States.tsx'

/** Sends someone signed out to the sign-in page, and back here afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const location = useLocation()
  if (session.isPending) return <Loading label="Checking your session" />
  if (!session.data)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}
