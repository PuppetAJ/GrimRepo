-- Up Migration

-- The rules a game began under. A change to the engine can make an old record replay differently,
-- so an unfinished game from older rules is dropped and re-dealt; finished games keep their scores.
ALTER TABLE games ADD COLUMN rules_version integer NOT NULL DEFAULT 1;

-- Down Migration

ALTER TABLE games DROP COLUMN rules_version;
