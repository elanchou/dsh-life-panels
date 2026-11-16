import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotes, parseHint, hintKey, parseKline, klineKey, marketOf } from '../plugins/market/quote.js';
import { inlineTags, normalizeTags, taskLines, toggleTask, retag } from '../plugins/notes/index.js';

const fields = (over) => { const f = new Array(50).fill(''); Object.assign(f, over); return f.join('~'); };

test('parseQuotes reads A-share, HK and US rows and skips unknown or short ones', () => {
  const a = fields({ 0: '1', 1: '贵州茅台', 2: '600519', 3: '1438.55', 4: '1435.26', 5: '1426.30', 30: '20261116120553', 31: '3.29', 32: '0.23', 33: '1445.60', 34: '1425.00', 38: '0.15', 39: '21.89', 45: '17983.05' });
  const u = fields({ 0: '200', 1: '苹果', 2: 'AAPL.OQ', 3: '356.27', 4: '354.88', 30: '2026-11-13 16:00:01', 31: '1.39', 32: '0.39', 33: '360.83', 34: '355.75' });
  const text = `v_sh600519="${a}";\nv_usAAPL="${u}";\nv_pv_none_match="1";\nv_sh000000="1~~~";`;
  const q = parseQuotes(text);
  assert.equal(q.size, 2);
  const m = q.get('sh600519');
  assert.equal(m.name, '贵州茅台'); assert.equal(m.price, 1438.55); assert.equal(m.pct, 0.23); assert.equal(m.market, 'cn'); assert.equal(m.pe, 21.89); assert.equal(m.cap, 17983.05);
  assert.equal(q.get('usAAPL').market, 'us'); assert.equal(q.get('usAAPL').code, 'AAPL.OQ');
  assert.equal(klineKey(q.get('usAAPL')), 'usAAPL.OQ');
  assert.equal(klineKey(m), 'sh600519');
  assert.equal(parseQuotes('garbage').size, 0);
});

test('parseQuotes derives change and percent when the feed leaves them blank', () => {
  const row = fields({ 1: '某ETF', 2: '510300', 3: '4.20', 4: '4.00' });
  const q = parseQuotes(`v_sh510300="${row}";`).get('sh510300');
  assert.equal(q.change, 0.2); assert.equal(q.pct, 5);
});

test('search hints decode escapes and map to quote keys; funds are not quotable', () => {
  const hits = parseHint('v_hint="sh~600519~\\u8d35\\u5dde\\u8305\\u53f0~gzmt~GP-A^us~aapl.oq~\\u82f9\\u679c~pg~GP^us~.ixic~\\u7eb3\\u6307~nz~ZS^jj~110011~\\u57fa\\u91d1~jj~KJ^hk~00700~\\u817e\\u8baf~tx~GP";');
  assert.equal(hits.length, 5);
  assert.equal(hits[0].name, '贵州茅台');
  assert.deepEqual(hits.map(hintKey), ['sh600519', 'usAAPL', 'us.IXIC', null, 'hk00700']);
  assert.deepEqual(parseHint('v_hint="N";'), []);
  assert.equal(marketOf('hkHSI').market, 'hk');
});

test('parseKline reads qfqday or day rows and drops malformed ones', () => {
  const rows = [['2026-11-13', '1', '2', '3', '0.5', '100'], ['2026-11-16', '2', '3', '4', '1', '200'], ['bad']];
  assert.equal(parseKline({ data: { sh600519: { qfqday: rows } } }, 'sh600519').length, 2);
  assert.equal(parseKline({ data: { hkHSI: { day: rows } } }, 'hkHSI')[1].close, 3);
  assert.deepEqual(parseKline(null, 'x'), []);
  assert.deepEqual(parseKline({ data: [] }, 'x'), []);
});

test('notes collect #tags from text but ignore numbers, mid-word hashes and bad names', () => {
  assert.deepEqual(inlineTags('周三交材料 #工作 #todo https://x.example/#anchor price #5 C# done'), ['工作', 'todo']);
  assert.deepEqual(normalizeTags(['Idea', '#idea', 'bad tag!', ' Work ', '']), ['idea', 'work']);
  assert.equal(normalizeTags(new Array(30).fill(0).map((_, i) => 't' + i)).length, 12);
});

test('checklist items are found outside code fences and toggled by index', () => {
  const body = '- [ ] a\n* [x] b\n```\n- [ ] not me\n```\n  1. [ ] c\ntext - [ ] no';
  assert.deepEqual(taskLines(body).map((x) => [x.line, x.done]), [[0, false], [1, true], [5, false]]);
  assert.equal(toggleTask(body, 2).split('\n')[5], '  1. [x] c');
  assert.equal(toggleTask(body, 1, true), body);
  assert.equal(toggleTask(body, 1, false).split('\n')[1], '* [ ] b');
  assert.equal(toggleTask(body, 3), null);
});

test('retag follows #tags in the text exactly and keeps hand-added ones', () => {
  assert.deepEqual(retag(['wor', 'manual'], 'hi #wor', 'hi #work'), ['work', 'manual']);
  assert.deepEqual(retag(['a'], '#a', 'nothing'), []);
  assert.deepEqual(retag([], '', 'new #x and #y'), ['x', 'y']);
});
