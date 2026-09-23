import { Navigate } from 'react-router'
import { authClient } from '../lib/auth.ts'

/** /stats is the signed-in player's own page. */
export function MyStats() {
  const user = authClient.useSession().data?.user as { displayUsername?: string } | undefined
  return <Navigate to={`/players/${user?.displayUsername ?? ''}`} replace />
}
