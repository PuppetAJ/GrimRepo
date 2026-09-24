/** Moderation from the command line: rename, remove, list recent accounts, or scan every name. Usage is in the README. */
import { flaggedAccounts, ModerationError, recentAccounts, removeAccount, renameAccount } from '../admin/moderation.ts'
import { pool } from '../config/db.ts'

const [command, first, second] = process.argv.slice(2)

try {
  if (command === 'rename' && first) {
    const { from, to } = await renameAccount(first, second)
    console.log(`Renamed ${from} to ${to}; the name is now locked.`)
  } else if (command === 'remove' && first) {
    console.log(`Removed ${(await removeAccount(first)).removed} and their games.`)
  } else if (command === 'recent') {
    const accounts = await recentAccounts(Number(first ?? 7))
    for (const account of accounts)
      console.log(`${account.joined.slice(0, 16)}  ${account.name}${account.locked ? '  (locked)' : ''}`)
    console.log(`${accounts.length} accounts.`)
  } else if (command === 'scan') {
    const flagged = await flaggedAccounts()
    for (const name of flagged) console.log(name)
    console.log(`${flagged.length} names the filter would refuse today.`)
  } else {
    console.log('Usage: pnpm moderate rename <username> [new-name] | remove <username> | recent [days] | scan')
    process.exitCode = 2
  }
} catch (error) {
  if (!(error instanceof ModerationError)) throw error
  console.error(error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
