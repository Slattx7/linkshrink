const crypto = require('crypto');

const SHARD_COUNT = parseInt(process.env.SHARD_COUNT || '2', 10);

// Same code always hashes to the same shard, so a lookup never needs a
// separate directory of "which shard is this code on" — the code IS the key.
function shardForCode(code) {
  const hash = crypto.createHash('md5').update(code).digest();
  return hash.readUInt32BE(0) % SHARD_COUNT;
}

module.exports = { shardForCode, SHARD_COUNT };
