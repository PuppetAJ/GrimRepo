-- Up Migration

-- A player's death card, built from the deck of a lost run; its id carries the whole card.
ALTER TABLE users ADD COLUMN death_card text;
-- The death card a run was dealt, so it replays the same after the player builds a new one.
ALTER TABLE runs ADD COLUMN death_card text;
-- A lost run builds one death card at most.
ALTER TABLE runs ADD COLUMN death_built boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE runs DROP COLUMN IF EXISTS death_built;
ALTER TABLE runs DROP COLUMN IF EXISTS death_card;
ALTER TABLE users DROP COLUMN IF EXISTS death_card;
