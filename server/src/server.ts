import { createApp } from './app.ts'
import { checkDatabase } from './config/db.ts'
import { env, isProduction } from './config/env.ts'

async function start(): Promise<void> {
  // Connect first, so a database that never answers fails the boot instead of every request.
  await checkDatabase()

  createApp({ production: isProduction }).listen(env.PORT, () => {
    console.log(`API ready at http://localhost:${env.PORT}`)
  })
}

start().catch((error: unknown) => {
  console.error('Failed to start the server:', error)
  process.exit(1)
})
