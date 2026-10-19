-- Up Migration

-- P03's first-time notes in a run that the player has already seen, by id, and whether they want notes at all.
ALTER TABLE users ADD COLUMN notes_seen text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN notes_off boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE users DROP COLUMN IF EXISTS notes_off;
ALTER TABLE users DROP COLUMN IF EXISTS notes_seen;
