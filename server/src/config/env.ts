import { z } from 'zod'

// CI tests without a .env file, so anything required here must also be set in CI.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'DATABASE_URL must be a postgres:// connection string' }),
  // Better Auth checks request origins against this and scopes cookies to it.
  APP_URL: z.url().default('http://localhost:3000'),
  // `openssl rand -base64 32`. Signs session cookies, so changing it signs everyone out.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
    // The .env.example placeholder is long enough to pass, so refuse it by name.
    .refine((value) => !/replace-me/i.test(value), 'BETTER_AUTH_SECRET is still the placeholder from .env.example'),
})

export type Env = z.infer<typeof schema>

export function parseEnv(source: NodeJS.ProcessEnv): { env: Env } | { problems: string[] } {
  const result = schema.safeParse(source)
  if (!result.success)
    return { problems: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) }

  // A Railway deploy without NODE_ENV=production would skip the CSP and serve no client.
  if (source.RAILWAY_ENVIRONMENT && result.data.NODE_ENV !== 'production') {
    return { problems: [`NODE_ENV: is "${result.data.NODE_ENV}" on Railway; set it to production on the service`] }
  }
  return { env: result.data }
}

function loadEnv(): Env {
  const parsed = parseEnv(process.env)
  if ('env' in parsed) return parsed.env

  console.error(
    `\nCannot start: the environment is not configured correctly.\n\n  - ${parsed.problems.join('\n  - ')}\n`,
  )
  console.error('Copy .env.example to .env at the repo root and fill it in.\n')
  process.exit(1)
}

export const env = loadEnv()

export const isProduction = env.NODE_ENV === 'production'
