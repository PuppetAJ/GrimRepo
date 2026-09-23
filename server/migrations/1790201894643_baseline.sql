-- Up Migration

-- Better Auth's tables, in snake_case; src/auth/auth.ts maps its field names onto these columns.
CREATE TABLE users (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  email            text NOT NULL UNIQUE,
  email_verified   boolean NOT NULL DEFAULT false,
  image            text,
  -- Lowercased by the username plugin, so uniqueness ignores case; display_username keeps what was typed.
  username         text NOT NULL UNIQUE,
  display_username text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_shape CHECK (username ~ '^[a-z0-9_]{3,20}$')
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE accounts (
  id                       text PRIMARY KEY,
  user_id                  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id               text NOT NULL,
  provider_id              text NOT NULL,
  access_token             text,
  refresh_token            text,
  id_token                 text,
  access_token_expires_at  timestamptz,
  refresh_token_expires_at timestamptz,
  scope                    text,
  password                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX accounts_user_idx ON accounts (user_id);
CREATE UNIQUE INDEX accounts_provider_idx ON accounts (provider_id, account_id);

CREATE TABLE verifications (
  id         text PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verifications_identifier_idx ON verifications (identifier);

-- Better Auth's attempt counters for sign-in and sign-up; short-lived rows swept as they are read.
CREATE TABLE rate_limits (
  id           text PRIMARY KEY,
  key          text NOT NULL UNIQUE,
  count        integer NOT NULL,
  last_request bigint NOT NULL
);

-- One row per finished game. Best scores and stats are computed from here, never stored beside it.
CREATE TABLE games (
  id        integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  outcome   text NOT NULL,
  turns     integer NOT NULL,
  score     integer NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_outcome_valid CHECK (outcome IN ('win', 'loss')),
  CONSTRAINT games_turns_valid CHECK (turns BETWEEN 1 AND 200),
  CONSTRAINT games_score_valid CHECK (score >= 0)
);

CREATE INDEX games_user_played_idx ON games (user_id, played_at DESC);
CREATE INDEX games_user_score_idx ON games (user_id, score DESC);

-- Down Migration

DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS verifications;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
