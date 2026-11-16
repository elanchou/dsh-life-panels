import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseWhen } from '../plugins/elans-stack/capture.js';

const now = new Date(2026, 10, 16, 13, 0); // Monday 2026-11-16 13:00 local
const c = (s) => classify(s, now);

test('dated or timed text becomes a reminder with the words removed', () => {
  assert.deepEqual(c('明天下午3点 看牙'), { target: 'reminder', title: '看牙', date: '2026-11-17', time: '15:00' });
  assert.deepEqual(c('周五 交周报'), { target: 'reminder', title: '交周报', date: '2026-11-20', time: null });
  assert.equal(c('下周三 开会').date, '2026-11-25');
  assert.equal(c('周一 例会').date, '2026-11-16', 'this weekday is today');
  assert.deepEqual(c('11/20 15:00 dentist'), { target: 'reminder', title: 'dentist', date: '2026-11-20', time: '15:00' });
  assert.equal(c('1/5 年终').date, '2027-01-05', 'a passed month/day rolls to next year');
  assert.equal(c('12月3日 生日').date, '2026-12-03');
  assert.equal(c('二十三号 交房租').target, 'note', 'a bare day without a month is not a date');
  assert.deepEqual(c('晚上八点半 跑步'), { target: 'reminder', title: '跑步', date: '2026-11-16', time: '20:30' });
  assert.equal(c('10点 站会').date, '2026-11-17', 'a time that already passed today means tomorrow');
  assert.equal(c('3天后 续费').date, '2026-11-19');
  assert.deepEqual(c('call mom tomorrow 7pm'), { target: 'reminder', title: 'call mom', date: '2026-11-17', time: '19:00' });
  assert.equal(c('next fri demo').date, '2026-11-27');
  assert.equal(c('今晚 看电影').time, '20:00');
  assert.equal(parseWhen('2026-02-30 bad', now).date, null);
});

test('links go to the reading list, other text to notes, and a keyword forces the target', () => {
  assert.deepEqual(c('https://example.com/b'), { target: 'reading', url: 'https://example.com/b', notes: '' });
  assert.deepEqual(c('读 https://example.com/a 有意思'), { target: 'reading', url: 'https://example.com/a', notes: '有意思' });
  assert.equal(c('看看这个 https://x.dev/p。').url, 'https://x.dev/p');
  assert.equal(c('想法：做一个番茄钟 #idea').target, 'note');
  assert.deepEqual(c('记：明天的事'), { target: 'note', body: '明天的事' });
  assert.deepEqual(c('提醒我 买牛奶'), { target: 'reminder', title: '买牛奶', date: null, time: null });
  assert.equal(c('A long paragraph that mentions https://example.com in the middle of a much longer thought about the project plan').target, 'note');
  assert.equal(c('   ').empty, true);
});

test('repeat phrases set a rule and the first date', () => {
  assert.deepEqual(c('每天早上8点 吃药'), { target: 'reminder', title: '吃药', date: '2026-11-17', time: '08:00', repeat: 'daily' });
  assert.equal(c('每天晚上10点 复盘').date, '2026-11-16', 'still ahead today');
  assert.deepEqual(c('每周五 10点 周会'), { target: 'reminder', title: '周会', date: '2026-11-20', time: '10:00', repeat: 'weekly' });
  assert.deepEqual(c('每月15号 还信用卡'), { target: 'reminder', title: '还信用卡', date: '2026-12-15', time: null, repeat: 'monthly' });
  assert.deepEqual(c('工作日 10点 站会'), { target: 'reminder', title: '站会', date: '2026-11-17', time: '10:00', repeat: 'weekdays' });
  assert.equal(c('每年12月3日 生日').repeat, 'yearly');
  assert.equal(c('写工作日志').target, 'note');
});

test('completing a repeating reminder keeps a done copy and moves it to the next date', async () => {
  const os = await import('node:os'); const path = await import('node:path'); const { promises: fs } = await import('node:fs');
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cal-repeat-'));
  process.env.DSH_HOME = home;
  try {
    const cal = await import('../plugins/calendar-reminders/index.js?repeat');
    assert.equal(cal.nextDate('2026-01-31', 'monthly'), '2026-02-28');
    assert.equal(cal.nextDate('2026-02-28', 'monthly', 31), '2026-03-31');
    assert.equal(cal.nextDate('2026-11-20', 'weekdays'), '2026-11-23');
    let run;
    cal.apply({ effect: (f) => f(), get: () => null, tools: { register() {} }, webServer: { register: (d) => { run = d; } }, connection: { requestRejection: () => null } });
    const reg = (await import('../plugins/calendar-reminders/common.js')).lanRegistry().runs.get('calendar-reminders').run;
    const pad = (n) => String(n).padStart(2, '0'); const d0 = new Date(); const today = d0.getFullYear() + '-' + pad(d0.getMonth() + 1) + '-' + pad(d0.getDate());
    const add = await reg({ action: 'add', title: 'water plants', repeat: 'weekly' });
    assert.equal(add.item.date, today, 'a repeating item without a date starts today');
    const done = await reg({ action: 'complete', id: add.item.id });
    assert.equal(done.item.done, false);
    assert.equal(done.next, cal.nextDate(today, 'weekly'));
    assert.equal(done.completed.done, true);
    assert.equal(done.completed.repeat, undefined);
    const all = (await reg({ action: 'list' })).items;
    assert.equal(all.length, 2);
    assert.equal((await reg({ action: 'add', title: 'x', repeat: 'hourly' })).ok, false);
    assert.ok(run);
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});
