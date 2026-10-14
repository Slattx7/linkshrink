const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.CACHE_HOST || 'localhost',
    port: process.env.CACHE_PORT || 6379,
  },
});

client.on('error', (err) => console.error('Cache error', err));
client.connect().catch((err) => console.error('Failed to connect to cache', err));

async function getCached(key) {
  return client.get(key);
}

async function setCached(key, value, ttlSeconds) {
  await client.set(key, value, { EX: ttlSeconds });
}

// Fixed-window counter: allows `limit` calls per `windowSeconds` for a given key.
async function rateLimit(key, limit, windowSeconds) {
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }
  return count <= limit;
}

module.exports = { getCached, setCached, rateLimit, client };
