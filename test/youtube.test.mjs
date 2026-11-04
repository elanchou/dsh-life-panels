import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgo } from '../plugins/youtube/yt.js';

test('parseAgo reads Chinese and English relative times', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(parseAgo('16小时前', now), now - 16 * 3600e3);
  assert.equal(parseAgo('2周前', now), now - 14 * 864e5);
  assert.equal(parseAgo('1个月前', now), now - 30 * 864e5);
  assert.equal(parseAgo('3 days ago', now), now - 3 * 864e5);
  assert.equal(parseAgo('1 year ago', now), now - 365 * 864e5);
  assert.equal(parseAgo('直播中', now), null);
  assert.equal(parseAgo('', now), null);
});
