-- Up Migration

-- A run is its seed and actions; the server replays them for the deck, the stage and the score.
-- Its battles follow the battle rules, so a change to either version drops an unfinished run.
CREATE TABLE runs (
  id            integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id       text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seed          bigint NOT NULL,
  rules_version integer NOT NULL,
  run_version   integer NOT NULL,
  actions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status        text NOT NULL DEFAULT 'playing',
  forfeited     boolean NOT NULL DEFAULT false,
  stage         integer NOT NULL DEFAULT 0,
  battles       integer NOT NULL DEFAULT 0,
  bosses        integer NOT NULL DEFAULT 0,
  score         integer,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  CONSTRAINT runs_seed_range CHECK (seed BETWEEN 0 AND 4294967295),
  CONSTRAINT runs_status_valid CHECK (status IN ('playing', 'won', 'lost')),
  CONSTRAINT runs_finished_scored CHECK (status = 'playing' OR (score >= 0 AND finished_at IS NOT NULL))
);

CREATE UNIQUE INDEX runs_one_open_idx ON runs (user_id) WHERE status = 'playing';
CREATE INDEX runs_user_score_idx ON runs (user_id, score DESC) WHERE status <> 'playing';

-- Down Migration

DROP TABLE IF EXISTS runs;
