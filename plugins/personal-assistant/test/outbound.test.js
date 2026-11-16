import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeConfig } from '../lib/config.js';
import { buildBriefing, createOutbound } from '../lib/outbound.js';

const task = { id: 't1', title: '订机票', state: 'waiting', summary: '要选哪个航班?' };
const make = (raw = {}) => {
  const config = normalizeConfig({ allowedCallers: ['111'], quietHours: '', minCallIntervalMinutes: 0, ...raw });
  const logs = [];
  return { out: createOutbound(() => config, (kind, detail) => logs.push([kind, detail]), join(mkdtempSync(join(tmpdir(), 'pa-test-')), 'outbound.json')), logs, config };
};

test('a finished task queues one call, merged with others', async () => {
  const { out } = make();
  await out.notifyTask(task, 'waiting');
  await out.notifyTask({ ...task, id: 't2', title: '买菜' }, 'done');
  const call = await out.claim(Date.now() + 1);
  assert.equal(call.tasks.length, 2);
  assert.equal(call.userId, '111');
  assert.equal(await out.claim(Date.now() + 2), undefined, 'only one call in flight');
});

test('events outside callOn are ignored', async () => {
  const { out } = make({ callOn: ['done'] });
  assert.equal(await out.notifyTask(task, 'waiting'), false);
  assert.equal(await out.claim(), undefined);
});

test('daily limit and quiet hours hold automatic calls but not manual ones', async () => {
  const { out } = make({ maxCallsPerDay: 0 });
  await out.notifyTask(task, 'waiting');
  assert.equal(await out.claim(), undefined);
  assert.equal((await out.requestManual('', [])).ok, true);
  assert.equal((await out.claim()).manual, true);

  const night = make({ quietHours: '00:00-23:59' });
  await night.out.notifyTask(task, 'waiting');
  assert.equal(await night.out.claim(), undefined);
});

test('a missed call is retried once, an answered call is not', async () => {
  const { out } = make({ retries: 1 });
  await out.notifyTask(task, 'waiting');
  const first = await out.claim();
  await out.report(first.id, 'noanswer');
  assert.equal(await out.claim(Date.now() + 1000), undefined, 'retry waits');
  const retry = await out.claim(Date.now() + 3 * 60_000);
  assert.ok(retry);
  await out.report(retry.id, 'noanswer');
  assert.equal(await out.claim(Date.now() + 10 * 60_000), undefined, 'retries exhausted');
});

test('a report with the wrong id is rejected', async () => {
  const { out } = make();
  await out.notifyTask(task, 'waiting');
  await out.claim();
  assert.deepEqual(await out.report('nope', 'answered'), { ok: false });
});

test('briefing is written in the configured language', () => {
  const tasks = [{ n: 1, title: '订机票', reason: 'waiting', summary: '选哪个航班?', state: 'waiting' }];
  assert.match(buildBriefing('zh', { manual: false, tasks }), /需要用户确认/);
  assert.match(buildBriefing('en', { manual: false, tasks }), /needs the user/);
  assert.match(buildBriefing('en', { manual: true, tasks: [] }), /Call me/);
});
