import { isRunNote, type RunNote } from 'shared'
import { pool } from '../config/db.ts'

export type Notes = { seen: RunNote[]; off: boolean }

export type NotesChange = { seen?: RunNote[]; off?: boolean; reset?: boolean }

const shaped = (row: { notes_seen: string[]; notes_off: boolean } | undefined): Notes => ({
  // A note dropped from the game since it was seen is left out.
  seen: (row?.notes_seen ?? []).filter(isRunNote),
  off: row?.notes_off ?? false,
})

export async function playerNotes(userId: string): Promise<Notes> {
  const { rows } = await pool.query('SELECT notes_seen, notes_off FROM users WHERE id = $1', [userId])
  return shaped(rows[0])
}

/** A reset clears the notes seen before `seen` adds to them, so both can come in one change. */
export async function changeNotes(userId: string, change: NotesChange): Promise<Notes> {
  const { rows } = await pool.query(
    `UPDATE users SET
       notes_seen = ARRAY(SELECT DISTINCT unnest(CASE WHEN $2 THEN '{}'::text[] ELSE notes_seen END || $3::text[])),
       notes_off = COALESCE($4, notes_off)
     WHERE id = $1
     RETURNING notes_seen, notes_off`,
    [userId, change.reset ?? false, change.seen ?? [], change.off ?? null],
  )
  return shaped(rows[0])
}
