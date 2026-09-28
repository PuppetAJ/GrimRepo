-- Up Migration

-- The seeded account for kwm0304 leaves the site; only the seeded one, by its address, and its games go with it.
DELETE FROM users WHERE username = 'kwm0304' AND email = 'kwm0304@grimrepo.test';

-- Down Migration

-- Nothing to restore: the seed made it, and the seed no longer does.
