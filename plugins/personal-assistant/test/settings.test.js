import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeConfig } from '../lib/config.js';
import { createSettingsStore } from '../lib/settings.js';

const make = () => {
  const file = join(mkdtempSync(join(tmpdir(), 'pa-set-')), 'settings.json');
  return { file, store: createSettingsStore(() => normalizeConfig({ allowedCallers: ['111'] }), file) };
};

test('saved values override the plugin config and persist', async () => {
  const { store, file } = make();
  await store.load();
  assert.deepEqual(store.get().allowedCallers, ['111']);
  const result = await store.update({ allowedCallers: ['222', 'x'], maxCallsPerDay: 2 });
  assert.deepEqual(result.values.allowedCallers, ['222']);
  assert.equal(result.values.maxCallsPerDay, 2);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).maxCallsPerDay, 2);
});

test('unknown keys are dropped and out-of-range numbers are clamped', async () => {
  const { store, file } = make();
  const result = await store.update({ evil: 1, retries: 50, ringTimeoutSeconds: 1 });
  assert.equal(result.values.retries, 3);
  assert.equal(result.values.ringTimeoutSeconds, 15);
  assert.equal('evil' in JSON.parse(readFileSync(file, 'utf8')), false);
});

test('only worker-facing changes ask for a restart', async () => {
  const { store } = make();
  assert.equal((await store.update({ maxCallsPerDay: 3 })).restart, false);
  assert.equal((await store.update({ language: 'en' })).restart, true);
  assert.equal((await store.update({ language: 'en' })).restart, false);
});
