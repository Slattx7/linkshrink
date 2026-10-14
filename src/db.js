const { Pool } = require('pg');
const { SHARD_COUNT } = require('./shardRouter');

const primaries = [];
const replicas = [];

function poolFor(host, port) {
  return new Pool({
    host,
    port,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'linkshrink',
    max: 10,
  });
}

for (let i = 0; i < SHARD_COUNT; i++) {
  primaries.push(poolFor(
    process.env[`SHARD${i}_PRIMARY_HOST`] || 'localhost',
    process.env[`SHARD${i}_PRIMARY_PORT`]
  ));
  replicas.push(poolFor(
    process.env[`SHARD${i}_REPLICA_HOST`] || 'localhost',
    process.env[`SHARD${i}_REPLICA_PORT`]
  ));
}

function primaryFor(shardIdx) {
  return primaries[shardIdx];
}

// Falls back to the primary if a replica isn't configured yet, so the app
// still works mid-migration while you're bringing replicas up one at a time.
function replicaFor(shardIdx) {
  return replicas[shardIdx] || primaries[shardIdx];
}

module.exports = { primaryFor, replicaFor };
