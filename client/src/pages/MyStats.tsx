import { Navigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth.ts'

export function MyStats() {
  const user = authClient.useSession().data?.user as { displayUsername?: string } | undefined
  return <Navigate to="/players/$username" params={{ username: user?.displayUsername ?? '' }} replace />
}
