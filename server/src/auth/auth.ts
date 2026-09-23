import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import { pool } from '../config/db.ts'
import { env } from '../config/env.ts'

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export const CLIENT_IP_HEADER = 'x-grimrepo-client-ip'

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
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
      displayUsernameValidator: (value) => USERNAME_PATTERN.test(value),
      schema: { user: { fields: { displayUsername: 'display_username' } } },
    }),
  ],

  hooks: {
    // The shown name is always the username as typed; otherwise a player could display as someone else.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email' && ctx.path !== '/update-user') return
      const body = (ctx.body ?? {}) as Record<string, unknown>
      delete body['displayUsername']
      if (typeof body['username'] === 'string') body['displayUsername'] = body['username']
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
