import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { authClient, settled } from '../lib/auth.ts'
import { Failure, Loading } from './States.tsx'

/** Redirects signed-out visitors to sign in, or with `guest`, signs them in as a guest. */
export function RequireAuth({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const session = authClient.useSession()
  const [refused, setRefused] = useState<string | null>(null)
  const signedOut = !session.isPending && !session.data

  useEffect(() => {
    if (!guest || !signedOut) return
    let current = true
    void settled(authClient.signIn.anonymous()).then(({ error }) => {
      if (!current) return
      if (error)
        setRefused(error.status === 429 ? 'Too many guests from here at once. Wait a minute.' : (error.message ?? ''))
      else void session.refetch()
    })
    return () => {
      current = false
    }
    // Once per sign-out; session.refetch is stable enough to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest, signedOut])

  if (refused !== null) return <Failure title="The table is not ready" detail={refused || 'Sign in to play.'} />
  if (session.isPending || (guest && signedOut)) return <Loading label="Checking your session" />
  if (!session.data) return <Navigate to="/login" replace />
  return children
}
