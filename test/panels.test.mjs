// Spaced repetition and pomodoro bookkeeping. Each host test runs against a temporary DSH_HOME.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { applyGrade, addDays, streak } from '../plugins/vocabulary/srs.js';

test('applyGrade grows intervals and resets on a lapse', () => {
  const today = '2026-03-01';
  const card = { id: 'x', state: 'new', reps: 0 };
  assert.equal(applyGrade(card, 'good', today), true);
  assert.equal(card.interval, 1);
  assert.equal(card.due, '2026-03-02');
  applyGrade(card, 'good', today);
  applyGrade(card, 'good', today);
  assert.ok(card.interval >= 6, 'third good review is at least 6 days, got ' + card.interval);
  applyGrade(card, 'again', today);
  assert.equal(card.interval, 0);
  assert.equal(card.state, 'learning');
  assert.equal(card.lapses, 1);
  assert.ok(card.ease < 2.5);
  const easy = { id: 'y', state: 'new', reps: 0 };
  applyGrade(easy, 'easy', today);
  assert.equal(easy.interval, 4);
  assert.throws(() => applyGrade(easy, 'meh', today));
});

test('addDays crosses month ends and streak counts back from today', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  const days = [{ key: '2026-03-01', newCount: 3 }, { key: '2026-02-28', reviewCount: 1 }, { key: '2026-02-26', newCount: 1 }];
  assert.equal(streak(days, '2026-03-01'), 2);
  assert.equal(streak(days, '2026-03-02'), 2);
  assert.equal(streak(days, '2026-03-03'), 0);
});

const homes = [];
after(() => Promise.all(homes.map((d) => fs.rm(d, { recursive: true, force: true }))));

async function hostTool(name) {
  process.env.DSH_HOME = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-' + name + '-'));
  homes.push(process.env.DSH_HOME);
  const mod = await import('../plugins/' + name + '/index.js?' + Date.now());
  let run;
  mod.apply({ effect: (f) => f(), tools: { register: (d) => { run = (a) => d.execute(a, {}); } }, webServer: { register() {} }, connection: { requestRejection: () => null } });
  return run;
}

test('vocabulary session serves the daily quota and records grades', async () => {
  const run = await hostTool('vocabulary');
  await run({ action: 'settings', book: 'toefl', dailyNew: 5 });
  const s = await run({ action: 'session' });
  assert.equal(s.cards.length, 5);
  for (const c of s.cards) await run({ action: 'grade', id: c.id, grade: 'good' });
  const after = await run({ action: 'session' });
  assert.equal(after.cards.length, 0);
  assert.equal(after.todayNew, 5);
  const add = await run({ action: 'add', words: ['abandon', 'qwxz'] });
  assert.deepEqual(add.added, ['abandon']);
  assert.deepEqual(add.needMeaning, ['qwxz']);
  const list = await run({ action: 'list', filter: 'starred' });
  assert.equal(list.cards[0].id, 'abandon');
});

test('focus records a finished pomodoro and starts the break', async () => {
  const run = await hostTool('focus');
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  try {
    await run({ action: 'start', minutes: 2, task: 'report' });
    skew = 2 * 60000 + 1000;
    const r = await run({ action: 'status' });
    assert.equal(r.events.length, 1);
    assert.equal(r.timer.phase, 'short');
    assert.equal(r.stats.today.count, 1);
    assert.equal(r.stats.today.minutes, 2);
    assert.deepEqual(r.stats.topTasks, [{ task: 'report', minutes: 2 }]);
    await assert.rejects(run({ action: 'settings', focusMin: 500 }));
  } finally { Date.now = realNow; }
});
