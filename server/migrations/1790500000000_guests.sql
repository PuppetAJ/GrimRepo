-- Up Migration

-- Guests play under a throwaway account until they sign up; Better Auth's anonymous plugin marks them.
ALTER TABLE users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE users DROP COLUMN is_anonymous;
