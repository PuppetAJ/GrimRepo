/** The nightly clean-up; Railway runs it on a schedule, and pnpm db:cleanup runs it by hand. */
import { nightlyCleanup } from '../admin/cleanup.ts'
import { pool } from '../config/db.ts'

try {
  const removed = await nightlyCleanup()
  console.log(
    Object.entries(removed)
      .map(([what, count]) => `${what}: ${count}`)
      .join(', '),
  )
} finally {
  await pool.end()
}
