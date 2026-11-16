import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { authClient, settled } from '../lib/auth.ts'
import { Failure, Loading } from './States.tsx'

export function RequireAuth({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const session = authClient.useSession()
  const [refused, setRefused] = useState<string | null>(null)
  const signedOut = !session.isPending && !session.data
  const refetchSession = useEffectEvent(() => void session.refetch())

  useEffect(() => {
    if (!guest || !signedOut) return
    let current = true
    void settled(authClient.signIn.anonymous()).then(({ error }) => {
      if (!current) return
      if (error)
        setRefused(error.status === 429 ? 'Too many guests from here at once. Wait a minute.' : (error.message ?? ''))
      else refetchSession()
    })
    return () => {
      current = false
    }
  }, [guest, signedOut])

  if (refused !== null) return <Failure title="The table is not ready" detail={refused || 'Sign in to play.'} />
  if (session.isPending || (guest && signedOut)) return <Loading label="Checking your session" />
  if (!session.data) return <Navigate to="/login" replace />
  return children
}
