import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac'

/** Every service must be listed and named as the dashboard names it: an omission reads as a deletion. */
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
      // Stops after ten idle minutes and wakes on the next request, so idle hours are not billed.
      sleepApplication: true,
      numReplicas: 1,
    },
    env: {
      NODE_ENV: 'production',
      PORT: '8080',
      // Railway resolves this to the database's own connection string.
      DATABASE_URL: '${{Postgres.DATABASE_URL}}',
      APP_URL: 'https://grimrepo.up.railway.app',
      // Set once with the Railway CLI and never written here; listed so applying does not delete it.
      BETTER_AUTH_SECRET: preserve(),
    },
  })

  return project('grimrepo', { resources: [database, app] })
})
