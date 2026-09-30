// Loaded with --import, so tests need no .env file and always hit the test database.
process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://grimrepo:grimrepo@127.0.0.1:5433/grimrepo_test'
process.env['BETTER_AUTH_SECRET'] ??= 'grimrepo-test-secret-not-for-real-use-0123456789'
