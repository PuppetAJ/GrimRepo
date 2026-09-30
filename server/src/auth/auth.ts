import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { anonymous, username } from 'better-auth/plugins'
import { pool } from '../config/db.ts'
import { env } from '../config/env.ts'
import { demoAccount } from './demo.ts'
import { claimGuestGames, guestName } from './guests.ts'
import { isOffensive, isReserved, NAME_REFUSED } from './names.ts'

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

export const CLIENT_IP_HEADER = 'x-grimrepo-client-ip'

export const GUEST_IS_READ_ONLY =
  "Guests can't change their name or password. Sign up to keep your games and make the account your own."

export const DEMO_IS_READ_ONLY =
  'Everyone shares the demo account, so it cannot be renamed, deleted or given a new password. Make an account of your own to change these.'

// Routes that would change the shared demo account for everyone.
const DEMO_LOCKED = new Set(['/update-user', '/delete-user', '/change-password', '/change-email', '/set-password'])

export const authOptions = {
  appName: 'Grim Repo',
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,

  // Shares the game queries' pool, so there is one connection budget.
  database: pool,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      // Keeps names safe in URLs and on the leaderboard.
      usernameValidator: (value) => USERNAME_PATTERN.test(value) && !isOffensive(value),
      displayUsernameValidator: (value) => USERNAME_PATTERN.test(value),
      schema: { user: { fields: { displayUsername: 'display_username' } } },
    }),
    // A guest's games follow it into the account it signs up or signs in to.
    anonymous({
      emailDomainName: 'guest.grimrepo.invalid',
      generateName: guestName,
      onLinkAccount: ({ anonymousUser, newUser }) => claimGuestGames(anonymousUser.user.id, newUser.user),
      schema: { user: { fields: { isAnonymous: 'is_anonymous' } } },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        // Every account needs a username, so a guest's is its generated name.
        before: async (user) => {
          if (!(user as { isAnonymous?: boolean }).isAnonymous) return
          const name = user.name.toLowerCase()
          return { data: { ...user, username: name, displayUsername: name } }
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (DEMO_LOCKED.has(ctx.path)) {
        const session = await getSessionFromCtx(ctx)
        const user = session?.user as { username?: string; isAnonymous?: boolean } | undefined
        if (user?.username === demoAccount.username) throw new APIError('FORBIDDEN', { message: DEMO_IS_READ_ONLY })
        if (user?.isAnonymous) throw new APIError('FORBIDDEN', { message: GUEST_IS_READ_ONLY })
      }
      if (ctx.path !== '/sign-up/email' && ctx.path !== '/update-user') return
      const body = (ctx.body ?? {}) as Record<string, unknown>
      const username = body['username']
      if (typeof username === 'string') {
        // Reserved names bind HTTP requests only, since the seed creates the demo account through this API.
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
      // The shown name always equals the username, so no one can display as someone else.
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
    // Deleting an account needs the password or a sign-in from the last ten minutes.
    freshAge: 60 * 10,
  },
  user: {
    modelName: 'users',
    fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
    additionalFields: {
      // input: false, or a player could unlock a name a moderator set.
      nameLocked: { type: 'boolean', fieldName: 'name_locked', required: false, input: false, defaultValue: false },
    },
    // The foreign key cascades, so a deleted player's games go too.
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
    // app.ts always overwrites this header, so a client can't spoof its address.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },

  rateLimit: {
    // Better Auth limits only in production by default; on everywhere so the tests exercise it.
    enabled: true,
    storage: 'database',
    modelName: 'rate_limits',
    fields: { lastRequest: 'last_request' },
    window: 60,
    max: 100,
    customRules: {
      // Every page load calls this, and it can't be used to guess credentials.
      '/get-session': false,
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-in/username': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
      '/sign-in/anonymous': { window: 60, max: 10 },
    },
  },
} satisfies BetterAuthOptions

export const auth = betterAuth(authOptions)
