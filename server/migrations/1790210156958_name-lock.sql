-- Up Migration

-- Set when a moderator renames an account, so the player cannot change the name back.
ALTER TABLE users ADD COLUMN name_locked boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE users DROP COLUMN name_locked;
