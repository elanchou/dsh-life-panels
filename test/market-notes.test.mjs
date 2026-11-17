import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuotes, parseHint, hintKey, parseKline, klineKey, marketOf, parseEastmoney, parseEmKline, parseCoinLore, parseBybitKline, exchangeState, EXCHANGES, emUrl } from '../plugins/market/quote.js';
import { inlineTags, normalizeTags, taskLines, toggleTask, retag } from '../plugins/notes/index.js';

const fields = (over) => { const f = new Array(50).fill(''); Object.assign(f, over); return f.join('~'); };


test('Tencent quotes: US and Hong Kong rows parse with English names; mainland keys are ignored', () => {
  const us = fields({ 1: '苹果', 2: 'AAPL.OQ', 3: '356.27', 4: '354.88', 5: '357.9', 30: '2026-11-13 16:00:01', 31: '1.39', 32: '0.39', 33: '360.83', 34: '355.75', 46: 'Apple Inc.' });
  const hk = fields({ 1: '腾讯控股', 2: '00700', 3: '500.0', 4: '490.0', 46: 'TENCENT' });
  const cn = fields({ 1: '贵州茅台', 2: '600519', 3: '1438.55', 4: '1435.26' });
  const q = parseQuotes('v_usAAPL="' + us + '";\nv_hk00700="' + hk + '";\nv_sh600519="' + cn + '";\nv_pv_none_match="1";');
  assert.deepEqual([...q.keys()].sort(), ['hk00700', 'usAAPL']);
  assert.equal(q.get('usAAPL').nameEn, 'Apple Inc.'); assert.equal(q.get('usAAPL').currency, 'USD'); assert.equal(q.get('usAAPL').region, 'americas');
  assert.equal(q.get('hk00700').currency, 'HKD'); assert.equal(q.get('hk00700').pct, 2.04, 'blank change and percent are derived');
  assert.equal(klineKey(q.get('usAAPL')), 'usAAPL.OQ');
  assert.equal(parseQuotes('garbage').size, 0);
  assert.equal(marketOf('c:BTC').market, 'crypto');
});

test('search hints offer only US and Hong Kong stocks, ETFs and no mainland or open-end funds', () => {
  const hits = parseHint('v_hint="sh~600519~\\u8d35\\u5dde\\u8305\\u53f0~gzmt~GP-A^us~aapl.oq~Apple~aapl~GP^us~.ixic~Nasdaq~ixic~ZS^jj~110011~fund~jj~KJ^hk~00700~\\u817e\\u8baf~tx~GP^hk~HSI~Hang Seng~hsi~ZS";');
  assert.equal(hits.length, 6);
  assert.deepEqual(hits.map(hintKey), [null, 'usAAPL', null, null, 'hk00700', null]);
  assert.deepEqual(parseHint('v_hint="N";'), []);
});

test('Eastmoney rows map to the catalog and keep Chinese and English names', () => {
  const m = parseEastmoney({ data: { diff: [
    { f2: 7561.67, f3: -0.4, f4: -30.1, f12: 'SPX', f13: 100, f15: 7600, f16: 7500, f17: 7590, f18: 7591.8, f124: 1794603585 },
    { f2: '-', f3: 0, f12: 'N225', f13: 100 },
    { f2: 1, f3: 1, f12: 'NOPE', f13: 100 },
  ] } });
  assert.deepEqual([...m.keys()], ['x:100.SPX']);
  const q = m.get('x:100.SPX');
  assert.equal(q.nameEn, 'S&P 500'); assert.equal(q.name, '标普500'); assert.equal(q.kind, 'index'); assert.equal(q.region, 'americas'); assert.equal(q.prev, 7591.8);
  assert.match(emUrl(['x:100.SPX', 'x:101.GC00Y']), /secids=100\.SPX,101\.GC00Y$/);
  assert.equal(parseEastmoney(null).size, 0);
  assert.equal(parseEmKline({ data: { klines: ['2026-11-16,1,2,3,0.5,0', 'bad'] } })[0].close, 2);
});

test('CoinLore and Bybit rows parse; duplicate symbols keep the higher-ranked coin', () => {
  const m = parseCoinLore({ data: [
    { symbol: 'BTC', name: 'Bitcoin', price_usd: '64613.17', percent_change_24h: '0.23', percent_change_1h: '-0.15', percent_change_7d: '-14.9', market_cap_usd: '1290380149919.6', volume24: 99465035787, rank: 1 },
    { symbol: 'BTC', name: 'Fake Bitcoin', price_usd: '1', rank: 900 },
    { symbol: 'ETH', name: 'Ethereum', price_usd: 'oops' },
  ] });
  assert.deepEqual([...m.keys()], ['c:BTC']);
  assert.equal(m.get('c:BTC').name, 'Bitcoin'); assert.equal(m.get('c:BTC').pct7d, -14.9); assert.ok(Math.abs(m.get('c:BTC').change - 148.27) < 0.01);
  const k = parseBybitKline({ result: { list: [['1794787200000', '1', '2', '0.5', '1.5', '10'], ['1794700800000', '1', '2', '0.5', '1.2', '10']] } });
  assert.deepEqual(k.map((c) => c.close), [1.2, 1.5], 'oldest first');
  assert.deepEqual(parseKline(null, 'x'), []);
});

test('exchange hours: weekends closed, lunch breaks, and local time zones', () => {
  const ex = (id) => EXCHANGES.find((e) => e.id === id);
  const mon = (iso) => new Date('2026-11-16T' + iso + 'Z');
  assert.equal(exchangeState(ex('tse'), mon('01:00:00')), 'open');   // 10:00 JST
  assert.equal(exchangeState(ex('tse'), mon('03:00:00')), 'lunch');  // 12:00 JST
  assert.equal(exchangeState(ex('tse'), mon('07:00:00')), 'closed');
  assert.equal(exchangeState(ex('nyse'), mon('15:00:00')), 'open');  // 10:00 EST
  assert.equal(exchangeState(ex('nyse'), mon('13:00:00')), 'closed'); // 08:00 EST
  assert.equal(exchangeState(ex('nyse'), new Date('2026-11-14T15:00:00Z')), 'closed', 'Saturday');
  assert.equal(exchangeState(ex('lse'), mon('10:00:00')), 'open');
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
