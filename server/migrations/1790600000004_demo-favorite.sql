-- Up Migration

-- The demo account's seeded games have no moves to count cards from either; they get the card the seed now gives them.
UPDATE games g
SET cards = '{"CopyPaste": 2, "Boilerplate": 3}'::jsonb
FROM users u
WHERE u.id = g.user_id AND u.username = 'demo' AND g.seed IS NULL AND g.cards IS NULL;

-- Down Migration

UPDATE games g SET cards = NULL
FROM users u
WHERE u.id = g.user_id AND u.username = 'demo' AND g.seed IS NULL;
