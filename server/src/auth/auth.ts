import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import { pool } from '../config/db.ts'
import { env } from '../config/env.ts'
import { demoAccount } from './demo.ts'
import { isOffensive, isReserved, NAME_REFUSED } from './names.ts'

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export const CLIENT_IP_HEADER = 'x-grimrepo-client-ip'

export const DEMO_IS_READ_ONLY =
  'Everyone shares the demo account, so it cannot be renamed, deleted or given a new password. Make an account of your own to change these.'

// Anything that would change or remove the shared account for every other visitor.
const DEMO_LOCKED = new Set(['/update-user', '/delete-user', '/change-password', '/change-email', '/set-password'])

export const authOptions = {
  appName: 'Grim Repo',
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,

  // The same pool as the game queries, so there is one connection budget.
  database: pool,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      // Letters, digits and underscores only, so a name is safe in a URL and on the leaderboard.
      usernameValidator: (value) => USERNAME_PATTERN.test(value) && !isOffensive(value),
      displayUsernameValidator: (value) => USERNAME_PATTERN.test(value),
      schema: { user: { fields: { displayUsername: 'display_username' } } },
    }),
  ],

  hooks: {
    // The shown name is always the username as typed; otherwise a player could display as someone else.
    before: createAuthMiddleware(async (ctx) => {
      if (DEMO_LOCKED.has(ctx.path)) {
        const session = await getSessionFromCtx(ctx)
        const user = session?.user as { username?: string } | undefined
        if (user?.username === demoAccount.username) throw new APIError('FORBIDDEN', { message: DEMO_IS_READ_ONLY })
      }
      if (ctx.path !== '/sign-up/email' && ctx.path !== '/update-user') return
      const body = (ctx.body ?? {}) as Record<string, unknown>
      const username = body['username']
      if (typeof username === 'string') {
        // Reserved names only bind requests from outside; the seed makes the demo account through the same API.
        if (isOffensive(username) || (ctx.request && isReserved(username))) {
          throw new APIError('BAD_REQUEST', { message: NAME_REFUSED })
        }
        if (ctx.path === '/update-user') {
          const session = await getSessionFromCtx(ctx)
          if ((session?.user as { nameLocked?: boolean } | undefined)?.nameLocked) {
            throw new APIError('FORBIDDEN', { message: 'A moderator set this name, so it cannot be changed.' })
          }
        }
      }
      // The shown name, and Better Auth's unused name field, only ever follow the username.
      delete body['displayUsername']
      delete body['name']
      if (typeof username === 'string') {
        body['displayUsername'] = username
        body['name'] = username
      }
    }),
  },

  session: {
    modelName: 'sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Deleting an account needs the password, or a sign-in from the last ten minutes.
    freshAge: 60 * 10,
  },
  user: {
    modelName: 'users',
    fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
    additionalFields: {
      // input: false, or a player could unlock a name a moderator had set.
      nameLocked: { type: 'boolean', fieldName: 'name_locked', required: false, input: false, defaultValue: false },
    },
    // A player can remove themselves; their games go with them through the foreign key.
    deleteUser: { enabled: true },
  },
  account: {
    modelName: 'accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
  },

  advanced: {
    // app.ts always overwrites this with the address it resolved, so a client cannot choose it.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },

  rateLimit: {
    // Better Auth only limits in production by default; on everywhere so the tests exercise it.
    enabled: true,
    storage: 'database',
    modelName: 'rate_limits',
    fields: { lastRequest: 'last_request' },
    window: 60,
    max: 100,
    customRules: {
      // Every page load asks for the session; it reveals nothing and guesses nothing.
      '/get-session': false,
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-in/username': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
} satisfies BetterAuthOptions

export const auth = betterAuth(authOptions)
