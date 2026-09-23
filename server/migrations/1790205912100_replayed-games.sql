-- Up Migration

-- A game is now started by the server, which picks its seed, and finished by replaying its moves.
ALTER TABLE games
  ADD COLUMN seed bigint,
  ADD COLUMN actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN status text NOT NULL DEFAULT 'finished',
  ADD COLUMN forfeited boolean NOT NULL DEFAULT false,
  ADD COLUMN started_at timestamptz NOT NULL DEFAULT now(),
  ALTER COLUMN outcome DROP NOT NULL,
  ALTER COLUMN turns DROP NOT NULL,
  ALTER COLUMN score DROP NOT NULL,
  ADD CONSTRAINT games_status_valid CHECK (status IN ('playing', 'finished')),
  ADD CONSTRAINT games_finished_complete CHECK (
    status = 'playing' OR (outcome IS NOT NULL AND turns IS NOT NULL AND score IS NOT NULL)
  ),
  ADD CONSTRAINT games_seed_range CHECK (seed IS NULL OR seed BETWEEN 0 AND 4294967295);

-- Rows from before this migration were finished when they were played.
UPDATE games SET started_at = played_at;

-- One unfinished game per player, so starting again resumes it rather than dealing a fresh seed.
CREATE UNIQUE INDEX games_one_open_idx ON games (user_id) WHERE status = 'playing';

-- Down Migration

DROP INDEX IF EXISTS games_one_open_idx;
DELETE FROM games WHERE status = 'playing';
ALTER TABLE games
  DROP CONSTRAINT games_seed_range,
  DROP CONSTRAINT games_finished_complete,
  DROP CONSTRAINT games_status_valid,
  ALTER COLUMN score SET NOT NULL,
  ALTER COLUMN turns SET NOT NULL,
  ALTER COLUMN outcome SET NOT NULL,
  DROP COLUMN started_at,
  DROP COLUMN forfeited,
  DROP COLUMN status,
  DROP COLUMN actions,
  DROP COLUMN seed;
