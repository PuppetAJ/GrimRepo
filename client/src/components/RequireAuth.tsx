import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { authClient } from '../lib/auth.ts'
import { Loading } from './States.tsx'

/** Sends someone signed out to the sign-in page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  if (session.isPending) return <Loading label="Checking your session" />
  if (!session.data) return <Navigate to="/login" replace />
  return children
}
