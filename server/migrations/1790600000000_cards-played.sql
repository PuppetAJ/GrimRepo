-- Up Migration

-- How many times each card was played in a finished game, counted from its replay; null until counted.
ALTER TABLE games ADD COLUMN cards jsonb;

-- Down Migration

ALTER TABLE games DROP COLUMN cards;
