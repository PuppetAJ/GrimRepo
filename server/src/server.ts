import { createApp } from './app.ts'
import { checkDatabase } from './config/db.ts'
import { countCardsPlayed } from './db/games.ts'
import { env, isProduction } from './config/env.ts'

async function start(): Promise<void> {
  // Connect first, so a database that never answers fails the boot instead of every request.
  await checkDatabase()
  // Games finished before cards were counted are counted once; after that this finds none.
  const counted = await countCardsPlayed()
  if (counted) console.log(`Counted the cards played in ${counted} earlier games.`)

  // Railway's edge controls X-Forwarded-For, so there its first entry is the client.
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
