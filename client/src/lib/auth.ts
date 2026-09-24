import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Same origin in development (through Vite's proxy) and in production, so no base URL is needed.
export const authClient = createAuthClient({ plugins: [usernameClient()] })

export const DEMO = { username: 'demo', password: 'demo-password' }

/** Better Auth's error for a failed call, or a plain fallback. */
export const authError = (error: { message?: string } | null | undefined, fallback: string): string =>
  error?.message || fallback
