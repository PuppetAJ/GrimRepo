import { createApp } from './app.ts'
import { checkDatabase } from './config/db.ts'
import { backfillRunCardCounts } from './db/players.ts'
import { env, isProduction } from './config/env.ts'

async function start(): Promise<void> {
  await checkDatabase()
  const counted = await backfillRunCardCounts()
  if (counted) console.log(`Counted the cards played in ${counted} earlier runs.`)

  // Railway's edge sets X-Forwarded-For, so its first entry is the real client there.
  createApp({ production: isProduction, firstForwarded: Boolean(process.env['RAILWAY_ENVIRONMENT']) }).listen(
    env.PORT,
    () => {
      console.log(`API ready at http://localhost:${env.PORT}`)
    },
  )
}

start().catch((error: unknown) => {
  console.error('Failed to start the server:', error)
  process.exit(1)
})
