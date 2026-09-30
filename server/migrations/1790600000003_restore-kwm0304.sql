-- Up Migration

-- kwm0304 was removed by mistake: his seeded account comes back, joined with the others, with the same three games
-- the seed gives him. Like the other seeded accounts it has no password, so nobody signs in as him. Only into a
-- database the seed has filled: an empty one must stay empty, or `db:seed --if-empty` would find a player and stop.
INSERT INTO users (id, name, email, username, display_username, created_at, updated_at)
SELECT 'seeded-kwm0304', 'kwm0304', 'kwm0304@grimrepo.test', 'kwm0304', 'kwm0304', joined, joined
FROM (SELECT COALESCE((SELECT created_at FROM users WHERE username = 'johanh'), now()) AS joined) seeded
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'kwm0304')
  AND EXISTS (SELECT 1 FROM users WHERE username = 'johanh');

INSERT INTO games (user_id, outcome, turns, score, played_at, started_at, cards)
SELECT u.id, g.outcome, g.turns, g.score, u.created_at - make_interval(days => g.days_before),
       u.created_at - make_interval(days => g.days_before), '{"SQLInjection": 2, "Boilerplate": 3}'::jsonb
FROM users u
CROSS JOIN (VALUES ('loss', 8, 80, 6), ('win', 24, 2500, 4), ('loss', 13, 130, 2)) AS g (outcome, turns, score, days_before)
WHERE u.id = 'seeded-kwm0304' AND NOT EXISTS (SELECT 1 FROM games WHERE user_id = u.id);

-- Down Migration

DELETE FROM users WHERE id = 'seeded-kwm0304';
