require('dotenv').config();
const fs = require('fs');
const os = require('os');
const express = require('express');
const { shardForCode } = require('./shardRouter');
const { primaryFor, replicaFor } = require('./db');
const { getCached, setCached, rateLimit } = require('./cache');

const app = express();
app.use(express.json());
app.set('trust proxy', true); // so req.ip is the real client IP once nginx is in front

const stats = { requests: 0, cacheHits: 0, cacheMisses: 0, startedAt: Date.now() };
app.use((req, res, next) => {
  stats.requests++;
  next();
});

function readCpuTempC() {
  try {
    for (const zone of ['thermal_zone0', 'thermal_zone1', 'thermal_zone2']) {
      const path = `/sys/class/thermal/${zone}/temp`;
      if (fs.existsSync(path)) {
        const raw = parseInt(fs.readFileSync(path, 'utf8').trim(), 10);
        return raw > 1000 ? raw / 1000 : raw; // some devices report millidegrees
      }
    }
  } catch (err) {
    // not available on this device, that's fine
  }
  return null;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// 30 link creations per minute per IP — the write path is the one worth protecting
app.use('/api/shorten', async (req, res, next) => {
  try {
    const allowed = await rateLimit(`rl:shorten:${req.ip}`, 30, 60);
    if (!allowed) return res.status(429).json({ error: 'Too many requests, slow down' });
    next();
  } catch (err) {
    console.error('Rate limiter error, failing open', err);
    next(); // cache being down shouldn't take the whole API down
  }
});

app.post('/api/shorten', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Provide a valid url starting with http:// or https://' });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const shard = shardForCode(code);
    try {
      await primaryFor(shard).query(
        'INSERT INTO links (short_code, long_url) VALUES ($1, $2)',
        [code, url]
      );
      return res.status(201).json({
        short_code: code,
        shard,
        short_url: `${req.protocol}://${req.get('host')}/${code}`,
        long_url: url,
      });
    } catch (err) {
      if (err.code === '23505') continue; // short_code collision, retry with a new one
      console.error(err);
      return res.status(500).json({ error: 'Something broke on our end' });
    }
  }
  res.status(500).json({ error: 'Could not generate a unique code, try again' });
});

// Redirect: cache hit skips the database read entirely; cache miss reads the
// shard's REPLICA, not the primary. Click counting always happens against the
// primary, fired off without blocking the redirect.
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  const shard = shardForCode(code);
  const cacheKey = `link:${code}`;

  const bumpClickCount = () => {
    primaryFor(shard)
      .query('UPDATE links SET click_count = click_count + 1 WHERE short_code = $1', [code])
      .catch((err) => console.error('Click count update failed', err));
  };

  try {
    const cached = await getCached(cacheKey);
    if (cached) {
      stats.cacheHits++;
      bumpClickCount();
      return res.redirect(302, cached);
    }

    const result = await replicaFor(shard).query(
      'SELECT long_url FROM links WHERE short_code = $1',
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Short link not found');
    }
    const longUrl = result.rows[0].long_url;
    await setCached(cacheKey, longUrl, 3600);
    stats.cacheMisses++;
    bumpClickCount();
    res.redirect(302, longUrl);
  } catch (err) {
    console.error(err);
    res.status(500).send('Something broke on our end');
  }
});

// Read-only stats — always the replica, never the primary
app.get('/api/stats/:code', async (req, res) => {
  const { code } = req.params;
  const shard = shardForCode(code);
  try {
    const result = await replicaFor(shard).query(
      'SELECT short_code, long_url, click_count, created_at FROM links WHERE short_code = $1',
      [code]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ...result.rows[0], shard });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something broke on our end' });
  }
});

app.get('/metrics', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*'); // dashboard.html fetches this cross-origin
  const totalCacheable = stats.cacheHits + stats.cacheMisses;
  res.json({
    pid: process.pid,
    uptimeSeconds: Math.round((Date.now() - stats.startedAt) / 1000),
    requests: stats.requests,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    cacheHitRatio: totalCacheable ? stats.cacheHits / totalCacheable : 0,
    freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    loadAvg: os.loadavg(),
    cpuTempC: readCpuTempC(),
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', pid: process.pid }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`linkshrink [pid ${process.pid}] listening on port ${PORT}`));
