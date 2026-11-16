import assert from 'node:assert/strict';
import test from 'node:test';
import { callbackTarget, inQuietHours, normalizeConfig, parseQuietHours } from '../lib/config.js';

test('defaults apply and bad values are coerced', () => {
  const c = normalizeConfig({ allowedCallers: ['123456', 'abc', 42], retries: 99, ringTimeoutSeconds: 1, callOn: ['done', 'bogus'], language: 'fr' });
  assert.deepEqual(c.allowedCallers, ['123456']);
  assert.equal(c.retries, 3);
  assert.equal(c.ringTimeoutSeconds, 15);
  assert.deepEqual(c.callOn, ['done']);
  assert.equal(c.language, 'zh');
});

test('quiet hours handle windows that cross midnight', () => {
  assert.deepEqual(parseQuietHours('23:00-08:00'), { start: 1380, end: 480 });
  assert.equal(parseQuietHours('nope'), null);
  assert.equal(inQuietHours(new Date(2026, 0, 1, 23, 30), '23:00-08:00'), true);
  assert.equal(inQuietHours(new Date(2026, 0, 1, 7, 59), '23:00-08:00'), true);
  assert.equal(inQuietHours(new Date(2026, 0, 1, 8, 0), '23:00-08:00'), false);
  assert.equal(inQuietHours(new Date(2026, 0, 1, 12, 0), '09:00-17:00'), true);
  assert.equal(inQuietHours(new Date(2026, 0, 1, 12, 0), ''), false);
});

test('callback target prefers an allowed callbackUser, else the first caller', () => {
  assert.equal(callbackTarget(normalizeConfig({ allowedCallers: ['111', '222'], callbackUser: '222' })), '222');
  assert.equal(callbackTarget(normalizeConfig({ allowedCallers: ['111', '222'], callbackUser: '999' })), '111');
  assert.equal(callbackTarget(normalizeConfig({})), undefined);
});
