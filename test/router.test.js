const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shardForCode, SHARD_COUNT } = require('../src/shardRouter');

describe('Shard Router', () => {
  it('should initialize with default or configured shard count', () => {
    assert.ok(SHARD_COUNT > 0);
    assert.strictEqual(typeof SHARD_COUNT, 'number');
  });

  it('should deterministically route identical short codes to the same shard', () => {
    const code = 'aB3xY9';
    const shard1 = shardForCode(code);
    const shard2 = shardForCode(code);
    assert.strictEqual(shard1, shard2);
  });

  it('should always return a valid shard index within range [0, SHARD_COUNT - 1]', () => {
    const sampleCodes = ['abc', 'xyz123', '000000', '9Rlemonades', 'OMNI_Edge', 'test_key_999'];
    for (const code of sampleCodes) {
      const shard = shardForCode(code);
      assert.ok(shard >= 0 && shard < SHARD_COUNT, `Shard ${shard} out of bounds for code ${code}`);
    }
  });

  it('should distribute keys across available shards', () => {
    const hits = new Set();
    // Test across 100 codes to ensure multi-shard coverage
    for (let i = 0; i < 100; i++) {
      const code = `code_${i}_${Math.random()}`;
      hits.add(shardForCode(code));
    }
    // Should hit more than 1 shard when SHARD_COUNT >= 2
    if (SHARD_COUNT >= 2) {
      assert.ok(hits.size > 1, 'Keys are not distributing across multiple shards');
    }
  });

  it('handles edge case inputs without throwing exceptions', () => {
    assert.doesNotThrow(() => shardForCode(''));
    assert.doesNotThrow(() => shardForCode('!@#$%^&*()_+~`'));
    assert.doesNotThrow(() => shardForCode('a'.repeat(256)));
  });
});
