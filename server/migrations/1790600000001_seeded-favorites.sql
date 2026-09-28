-- Up Migration

-- The original team's seeded games have scores but no moves to count cards from; each gets the card the seed now gives.
UPDATE games g
SET cards = jsonb_build_object(
  CASE u.username WHEN 'johanh' THEN 'RubberDuck' ELSE 'ForkBomb' END, 2,
  'Boilerplate', 3
)
FROM users u
WHERE u.id = g.user_id
  AND u.username IN ('johanh', 'puppetaj')
  AND g.seed IS NULL
  AND g.cards IS NULL;

-- Down Migration

UPDATE games g SET cards = NULL
FROM users u
WHERE u.id = g.user_id AND u.username IN ('johanh', 'puppetaj') AND g.seed IS NULL;
