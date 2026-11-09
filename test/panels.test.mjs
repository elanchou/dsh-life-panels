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

/** A stand-in icafe-cli: logs its argv and answers with canned JSON, so no network or login is needed. */
async function fakeIcafeCli() {
  const file = path.join(process.env.DSH_HOME, 'icafe-cli');
  const log = path.join(process.env.DSH_HOME, 'calls.jsonl');
  await fs.writeFile(file, `#!${process.execPath}
const fs = require('fs');
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--auth-user'));
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(argv) + '\\n');
const [a, b] = argv;
const val = (k) => argv[argv.indexOf(k) + 1];
const out = (o) => process.stdout.write(JSON.stringify(o));
if (a === 'login') out({ status: '已登录', username: 'tester' });
else if (a === 'card' && b === 'get') out({ code: 200, cards: val('--sequence').split(',').map((q) => ({ sequence: Number(q), title: '相册需求', status: '开发中', type: { name: q === '10' || q === '20' ? 'Feature' : 'Story' }, ...(q === '21' ? { parent: { sequence: 20 } } : {}), detail: '<p>做相册</p>' })) });
else if (a === 'card' && b === 'query' && val('--iql').startsWith('父卡片编号')) out({ code: 200, total: 2, cards: [
  { sequence: 11, title: '列表页', status: '已完成', isFinishedStatus: true, type: { name: 'Task' } },
  { sequence: 12, title: '详情页', status: '开发中', type: { name: 'Task' } }] });
else if (a === 'card' && b === 'query' && val('--iql').startsWith('负责人 = currentUser OR RD')) out({ code: 200, total: 3, pageSize: 1, cards: [
  { sequence: 21, title: '子A', status: '开发中', type: { name: 'Story' }, parent: { sequence: 20 } },
  { sequence: 22, title: '子B', status: '开发中', type: { name: 'Task' }, parent: { sequence: 21 } },
  { sequence: 23, title: '子C', status: '开发中', type: { name: 'Story' }, parent: { sequence: 20 } }] });
else if (a === 'card' && b === 'query' && val('--iql').startsWith('类型 in ("Feature")')) out({ code: 200, total: 2, pageSize: 1, cards: [
  { sequence: 20, title: '特性', status: '开发中', type: { name: 'Feature' } },
  { sequence: 30, title: '旧特性', status: '已关闭', isFinishedStatus: true, type: { name: 'Feature' } }] });
else if (a === 'card' && b === 'query') out({ code: 200, total: 2, cards: [
  { sequence: 90, title: '崩溃', status: '新建', type: { name: 'Bug' } },
  { sequence: 91, title: '已修', status: '已关闭', isFinishedStatus: true, type: { name: 'Bug' } }] });
else if (a === 'card' && b === 'create') {
  if (val('--title') === 'bad') { process.stderr.write(JSON.stringify({ error: 'http_error', message: 'boom' })); process.exit(4); }
  out({ status: 200, issues: [{ sequence: 100, title: val('--title'), url: 'u' }] });
}
else if (a === 'space' && b === 'issue-types') out({ status: 200, result: { issueTypes: [{ id: 1, name: 'Story', childTypeIds: [3] }, { id: 2, name: '线下BUG' }, { id: 3, name: 'Task' }, { id: 4, name: 'Feature', childTypeIds: [1] }] } });
else if (a === 'card' && b === 'update') out({ code: 200 });
else { process.stderr.write(JSON.stringify({ error: 'auth_failed', message: 'login' })); process.exit(1); }
`, { mode: 0o755 });
  return { file, calls: async () => (await fs.readFile(log, 'utf8')).trim().split('\n').map((l) => JSON.parse(l)) };
}

test('icafe-workflow tracks a requirement and creates child cards through icafe-cli', async () => {
  const run = await hostTool('icafe-workflow');
  const cli = await fakeIcafeCli();
  await run({ action: 'settings', space: 'pan', cliPath: cli.file });
  await assert.rejects(run({ action: 'settings', space: 'bad space' }));
  const st = await run({ action: 'status' });
  assert.equal(st.login.loggedIn, true);

  const added = await run({ action: 'req_add', card: 'https://console.cloud.baidu-int.com/devops/icafe/issue/pan-10/show', prdUrl: 'https://ku.baidu-int.com/x', figmaUrl: 'https://www.figma.com/design/abc' });
  assert.equal(added.requirement.title, '相册需求');
  assert.equal(added.requirement.parentSequence, 10);
  await assert.rejects(run({ action: 'req_add', card: 'pan-10' }), /already/);
  await assert.rejects(run({ action: 'req_add', card: '7', prdUrl: 'javascript:alert(1)' }), /http/);

  const withDocs = await run({ action: 'req_update', id: added.requirement.id, docs: [{ title: '接口文档', url: 'https://ku.baidu-int.com/d/1' }, { url: 'https://ku.baidu-int.com/d/1' }, { url: '' }] });
  assert.deepEqual(withDocs.requirement.docs, [{ title: '接口文档', url: 'https://ku.baidu-int.com/d/1' }]);
  await assert.rejects(run({ action: 'req_update', id: added.requirement.id, docs: [{ url: 'javascript:alert(1)' }] }), /http/);
  await assert.rejects(run({ action: 'req_update', id: added.requirement.id, docs: 'x' }), /docs/);
  const detail = await run({ action: 'req_get', id: added.requirement.id });
  assert.deepEqual(detail.children.map((c) => [c.sequence, c.finished]), [[11, true], [12, false]]);
  assert.equal((await run({ action: 'req_list' })).requirements[0].childDone, 1);

  const made = await run({ action: 'create_children', requirementId: added.requirement.id, items: [{ title: '分享页', detail: '范围：\n- 生成链接\n- 复制' }, { title: 'bad' }] });
  assert.equal(made.created.length, 1);
  assert.equal(made.failed[0].title, 'bad');
  const create = (await cli.calls()).find((c) => c[1] === 'create');
  assert.deepEqual(create.slice(0, 10), ['card', 'create', '--space', 'pan', '--title', '分享页', '--type', 'Task', '--parent', '10']);
  assert.equal(create[create.indexOf('--detail') + 1], '<p>范围：</p><ul><li>生成链接</li><li>复制</li></ul>');

  const disc = await run({ action: 'req_discover' });
  assert.deepEqual(disc.types, ['Feature']);
  assert.deepEqual(disc.candidates.map((c) => [c.sequence, c.mine, c.registered]), [[20, 3, false]]);
  assert.equal((await run({ action: 'req_discover', scope: 'all', includeFinished: true })).candidates.length, 2);
  assert.equal((await run({ action: 'req_discover', scope: 'all' })).candidates.length, 1);
  await assert.rejects(run({ action: 'req_discover', space: 'bad space' }));
  const imp = await run({ action: 'req_import', cards: ['pan-20', 'pan-10'] });
  assert.deepEqual(imp.added.map((r) => r.parentSequence).sort(), [20]);
  assert.equal(imp.skipped[0].sequence, 10);
  assert.equal((await run({ action: 'req_discover' })).candidates[0].registered, true);
  await assert.rejects(run({ action: 'req_import', cards: [] }));
  await run({ action: 'req_remove', id: imp.added[0].id });

  const bugs = await run({ action: 'bugs' });
  assert.deepEqual(bugs.bugs.map((b) => b.sequence), [90]);
  await run({ action: 'settings', bugSpaces: 'qa-pool, pan' });
  const multi = await run({ action: 'bugs' });
  assert.deepEqual(multi.spaces, ['qa-pool', 'pan']);
  assert.deepEqual(multi.bugs.map((b) => b.space).sort(), ['pan', 'qa-pool']);
  assert.equal(multi.queries.pan, '负责人 = currentUser AND 类型 in ("线下BUG")');
  await run({ action: 'settings', bugScope: 'both', bugTypes: ['story'] });
  assert.equal((await run({ action: 'bugs', space: 'pan' })).queries.pan, '(负责人 = currentUser OR 创建人 = currentUser) AND 类型 in ("Story")');
  await run({ action: 'settings', bugTypes: ['Nope'] });
  assert.equal((await run({ action: 'bugs', space: 'pan' })).bugs.length, 0);
  await run({ action: 'settings', bugTypes: [], bugIql: '创建人 = currentUser' });
  assert.equal((await run({ action: 'bugs', space: 'pan' })).queries.pan, '创建人 = currentUser');
  await assert.rejects(run({ action: 'settings', bugScope: 'nobody' }), /bugScope/);
  await run({ action: 'settings', bugIql: '', bugScope: 'assignee', bugSpaces: [] });
  await assert.rejects(run({ action: 'settings', bugSpaces: 'ok, bad/space' }));
  await run({ action: 'set_status', card: 'pan-90', status: '已修复', comment: '空指针' });
  const upd = (await cli.calls()).find((c) => c[1] === 'update');
  assert.deepEqual(upd, ['card', 'update', '--space', 'pan', '--sequence', '90', '--status', '已修复', '--comment', '<p>空指针</p>']);
});
