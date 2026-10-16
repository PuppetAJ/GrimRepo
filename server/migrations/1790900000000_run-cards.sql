-- Up Migration

-- The cards played across a finished run's battles, for the profile's favorite card. Null until counted.
ALTER TABLE runs ADD COLUMN cards jsonb;

-- Down Migration

ALTER TABLE runs DROP COLUMN IF EXISTS cards;
