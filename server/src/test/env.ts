// Loaded with --import, so the environment check passes without a .env file.
process.env['NODE_ENV'] ??= 'test'
process.env['DATABASE_URL'] ??= 'postgresql://grimrepo:grimrepo@127.0.0.1:5433/grimrepo_test'
