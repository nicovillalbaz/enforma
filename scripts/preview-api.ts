// Separate local origin for testing the built offline shell. Same authorization rules.
process.env.PORT = '3002';
process.env.APP_ORIGIN = 'http://127.0.0.1:4173';
await import('../apps/api/src/server.js');
