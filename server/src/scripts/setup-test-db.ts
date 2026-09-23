import { execFileSync } from 'node:child_process'
import pg from 'pg'

const url = process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL is not set; run this through the test script')

const parsed = new URL(url)
const database = parsed.pathname.slice(1)
if (!database.endsWith('_test')) throw new Error(`Refusing to use ${database}: a test database must end in _test`)

// Connect to the maintenance database, since the target may not exist yet.
const admin = new pg.Client({ connectionString: new URL('/postgres', parsed).toString() })
await admin.connect()
const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])
if (rows.length === 0) await admin.query(`CREATE DATABASE "${database}"`)
await admin.end()

execFileSync(process.execPath, ['node_modules/node-pg-migrate/bin/node-pg-migrate.js', 'up', '-m', 'migrations'], {
  env: process.env,
  stdio: 'ignore',
})
