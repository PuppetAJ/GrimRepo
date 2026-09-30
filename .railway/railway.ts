import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac'

/** List every service under its dashboard name: an omission reads as a deletion. */
export default defineRailway(() => {
  // Deploy only once GitHub's checks have passed.
  const repository = github('PuppetAJ/GrimRepo', { checkSuites: true })

  const database = postgres('Postgres')

  const app = service('GrimRepo', {
    source: repository,
    build: 'pnpm build',
    // Migrations are idempotent and the seed only fills an empty database, so a fresh environment comes up populated.
    start: 'pnpm db:migrate && pnpm db:seed:empty && pnpm start',
    deploy: {
      healthcheckPath: '/health',
      healthcheckTimeout: 100,
      // Sleeps after ten idle minutes, so idle hours aren't billed.
      sleepApplication: true,
      numReplicas: 1,
    },
    env: {
      NODE_ENV: 'production',
      PORT: '8080',
      // Railway resolves this reference to the database's connection string.
      DATABASE_URL: '${{Postgres.DATABASE_URL}}',
      APP_URL: 'https://grimrepo.up.railway.app',
      // Set with the Railway CLI, never here; listed so applying doesn't delete it.
      BETTER_AUTH_SECRET: preserve(),
    },
  })

  const cleanup = service('Cleanup', {
    source: repository,
    build: 'pnpm install --frozen-lockfile',
    start: 'pnpm db:cleanup',
    deploy: {
      cronSchedule: '0 4 * * *',
      // A failed run waits for the next schedule rather than looping.
      restartPolicyType: 'NEVER',
    },
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: '${{Postgres.DATABASE_URL}}',
      // The clean-up loads the app's env check, which refuses to start without it.
      BETTER_AUTH_SECRET: '${{GrimRepo.BETTER_AUTH_SECRET}}',
    },
  })

  return project('grimrepo', { resources: [database, app, cleanup] })
})
