import { createApp } from './app.ts'
import { checkDatabase } from './config/db.ts'
import { countCardsPlayed } from './db/games.ts'
import { env, isProduction } from './config/env.ts'

async function start(): Promise<void> {
  // Connect first, so an unreachable database fails the boot instead of every request.
  await checkDatabase()
  // A one-off backfill; later boots find nothing to count.
  const counted = await countCardsPlayed()
  if (counted) console.log(`Counted the cards played in ${counted} earlier games.`)

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
