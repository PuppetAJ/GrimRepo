-- Up Migration

-- Another player's death card a run was dealt for its Staging boss, and its maker's name then, so the run replays the same.
ALTER TABLE runs ADD COLUMN rival_card text;
ALTER TABLE runs ADD COLUMN rival_by text;

-- Down Migration

ALTER TABLE runs DROP COLUMN IF EXISTS rival_by;
ALTER TABLE runs DROP COLUMN IF EXISTS rival_card;
