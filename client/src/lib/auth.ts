import { anonymousClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Same origin in development (through Vite's proxy) and in production, so no base URL is needed.
export const authClient = createAuthClient({ plugins: [usernameClient(), anonymousClient()] })

export const DEMO = { username: 'demo', password: 'demo-password' }

export const authError = (error: { message?: string } | null | undefined, fallback: string): string =>
  error?.message || fallback

/** A refusal comes back as `{ error }`, but a network failure rejects; this turns the second into the first. */
export const settled = <T>(request: Promise<T>) =>
  request.catch((failure: unknown) => ({
    data: null,
    error: {
      status: 0,
      message: `Could not reach the server: ${failure instanceof Error ? failure.message : String(failure)}`,
    },
  }))
