import { anonymousClient, usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({ plugins: [usernameClient(), anonymousClient()] })

export const DEMO = { username: 'demo', password: 'demo-password' }

export const authError = (error: { message?: string } | null | undefined, fallback: string): string =>
  error?.message || fallback

export const settled = <T>(request: Promise<T>) =>
  request.catch((failure: unknown) => ({
    data: null,
    error: {
      status: 0,
      message: `Could not reach the server: ${failure instanceof Error ? failure.message : String(failure)}`,
    },
  }))
