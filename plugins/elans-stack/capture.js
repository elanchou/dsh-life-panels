/**
 * Quick capture: one line of text, routed to the right panel.
 *   a link                         -> reading list
 *   text with a date or time       -> reminder ("明天下午3点 看牙", "周五 交周报", "11/20 15:00 dentist")
 *   anything else                  -> note
 * A leading keyword forces the target: 记/笔记/note, 提醒/待办/todo, 读/稍后读/read.
 * Pure functions; `now` is injectable for tests. Dates are local (the host's time zone).
 */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const CN_NUM = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const WEEK = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0, 七: 0 };
const EN_WEEK = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

/** "三" -> 3, "十二" -> 12, "二十三" -> 23, "12" -> 12. */
function num(s) {
  if (/^\d+$/.test(s)) return Number(s);
  if (s.length === 1) return CN_NUM[s] ?? NaN;
  if (s[0] === '十') return 10 + (CN_NUM[s[1]] ?? 0);
  if (s.length === 2 && s[1] === '十') return CN_NUM[s[0]] * 10;
  if (s.length === 3 && s[1] === '十') return CN_NUM[s[0]] * 10 + CN_NUM[s[2]];
  return NaN;
}
const N = '(\\d{1,2}|[一二两三四五六七八九十]{1,3})';

const FORCE = [
  [/^(记一下|记下|记|笔记|note)[:：\s]\s*/i, 'note'],
  [/^(提醒我?|待办|todo|remind me)[:：\s]\s*/i, 'reminder'],
  [/^(稍后读|读|read)[:：\s]\s*/i, 'reading'],
];

/** Find a date and a time in the text; returns { date, time, rest } with the matched words removed. */
export function parseWhen(text, now = new Date()) {
  let rest = ' ' + text + ' ';
  let date = null;
  let time = null;
  const take = (re, fn) => {
    if (date && time) return;
    const m = re.exec(rest);
    if (!m) return;
    const r = fn(m);
    if (!r) return;
    if (r.date && !date) date = r.date;
    if (r.time && !time) time = r.time;
    rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const futureMD = (mo, d) => {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    let x = new Date(today.getFullYear(), mo - 1, d);
    if (x.getMonth() !== mo - 1) return null;
    if (x < addDays(today, -1)) x = new Date(today.getFullYear() + 1, mo - 1, d); // "1/5" in November means next January
    return ymd(x);
  };
  // 周五 = the coming Friday (today if it is Friday); 下周五 = Friday of next week (weeks start on Monday).
  const weekday = (target, next) => {
    const cur = today.getDay();
    if (next) { const monday = addDays(today, 7 - ((cur + 6) % 7)); return ymd(addDays(monday, (target + 6) % 7)); }
    return ymd(addDays(today, (target - cur + 7) % 7));
  };

  take(/(\d{4})-(\d{1,2})-(\d{1,2})/, (m) => {
    const x = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return x.getMonth() === Number(m[2]) - 1 ? { date: ymd(x) } : null;
  });
  take(new RegExp(N + '月' + N + '[日号]?'), (m) => { const d = futureMD(num(m[1]), num(m[2])); return d ? { date: d } : null; });
  take(/(?<![\d:/])(\d{1,2})\/(\d{1,2})(?![\d/])/, (m) => { const d = futureMD(Number(m[1]), Number(m[2])); return d ? { date: d } : null; });
  take(/大后天/, () => ({ date: ymd(addDays(today, 3)) }));
  take(/后天/, () => ({ date: ymd(addDays(today, 2)) }));
  take(/明天|明早|明晚|tomorrow/i, (m) => ({ date: ymd(addDays(today, 1)), ...(m[0] === '明早' ? { time: '09:00' } : m[0] === '明晚' ? { time: '20:00' } : {}) }));
  take(/今天|今晚|今早|today|tonight/i, (m) => ({ date: ymd(today), ...(/今晚|tonight/i.test(m[0]) ? { time: '20:00' } : m[0] === '今早' ? { time: '09:00' } : {}) }));
  take(/(下(?:个)?)(?:周|星期|礼拜)([一二三四五六日天七])/, (m) => ({ date: weekday(WEEK[m[2]], true) }));
  take(/(?:这|本)?(?:周|星期|礼拜)([一二三四五六日天七])/, (m) => ({ date: weekday(WEEK[m[1]], false) }));
  take(/\b(next\s+)?(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, (m) => ({ date: weekday(EN_WEEK[m[2].toLowerCase()], !!m[1]) }));
  take(new RegExp(N + '(?:天|日)后'), (m) => { const n = num(m[1]); return n > 0 && n < 400 ? { date: ymd(addDays(today, n)) } : null; });
  take(/\bin\s+(\d{1,3})\s+days?\b/i, (m) => ({ date: ymd(addDays(today, Number(m[1]))) }));

  // Times: 15:00, 3pm, 下午3点, 3点半, 晚上八点十五
  take(/(?<![\d/])([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/, (m) => ({ time: pad(Number(m[1])) + ':' + m[2] }));
  take(/(?<![\d:])(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i, (m) => {
    let hh = Number(m[1]) % 12; if (/pm/i.test(m[3])) hh += 12;
    return hh < 24 ? { time: pad(hh) + ':' + (m[2] || '00') } : null;
  });
  take(new RegExp('(早上|上午|中午|下午|傍晚|晚上|凌晨)?' + N + '[点时](半|' + N + '分?)?'), (m) => {
    let hh = num(m[2]);
    if (!(hh >= 0 && hh <= 24)) return null;
    const mm = m[3] === '半' ? 30 : m[4] ? num(m[4]) : 0;
    if (!(mm >= 0 && mm < 60)) return null;
    const part = m[1] || '';
    if (/下午|傍晚|晚上/.test(part) && hh < 12) hh += 12;
    if (part === '中午' && hh < 6) hh += 12;
    if (hh === 24) hh = 0;
    return { time: pad(hh) + ':' + pad(mm) };
  });
  const explicitDate = !!date;
  if (time && !date) {
    // A time alone means today, or tomorrow when that time has passed.
    const [hh, mm] = time.split(':').map(Number);
    const passed = now.getHours() * 60 + now.getMinutes() > hh * 60 + mm;
    date = ymd(addDays(today, passed ? 1 : 0));
  }
  return { date, time, explicitDate, rest: rest.replace(/\s+/g, ' ').trim() };
}

/** Decide where a captured line goes. Returns { target: 'note'|'reminder'|'reading', ... } with the fields to save. */
export function classify(input, now = new Date()) {
  let text = String(input || '').trim();
  let forced = null;
  for (const [re, target] of FORCE) {
    const m = re.exec(text);
    if (m) { forced = target; text = text.slice(m[0].length).trim(); break; }
  }
  if (!text) return { target: forced || 'note', empty: true };
  const url = (/https?:\/\/[^\s<>"']+/i.exec(text) || [])[0];
  if ((forced === 'reading' || (!forced && url && text.replace(url, '').trim().length <= 40)) && url) {
    const note = text.replace(url, '').trim();
    return { target: 'reading', url: url.replace(/[)。，,.]+$/, ''), notes: note };
  }
  if (forced === 'note') return { target: 'note', body: text };
  // The repeat rule comes off first, so "每周五" is not read as this Friday plus a stray "每".
  const rep = parseRepeat(text, now);
  const when = parseWhen(rep ? rep.rest : text, now);
  if (rep && !when.explicitDate) {
    // Daily and weekday rules start at the next occurrence of the time; the others start on their own date.
    if (rep.repeat === 'daily' && when.time) { /* when.date is today, or tomorrow once the time has passed */ }
    else if (rep.repeat === 'weekdays' && when.time) {
      const d = new Date(when.date + 'T00:00:00');
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      when.date = ymd(d);
    } else when.date = rep.date;
  }
  if (forced === 'reminder' || when.date) {
    const title = when.rest.replace(/^(要|去|记得|提醒我)\s*/, '').trim() || text;
    return { target: 'reminder', title: title.slice(0, 200), date: when.date, time: when.time, ...(rep ? { repeat: rep.repeat } : {}), ...(title.length > 200 ? { notes: title } : {}) };
  }
  return { target: 'note', body: text };
}

/** 每天 / 工作日 / 每周五 / 每月15号 / 每年 / every day|weekday|week|month|year. Returns { repeat, date, rest } or null. */
export function parseRepeat(text, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rules = [
    [/(?:每个?|每逢)?工作日(?![志报程])|\bevery\s+weekday\b|\bweekdays\b/i, () => {
      const x = new Date(today); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return ['weekdays', ymd(x)]; }],
    [/每天|每日|\bevery\s*day\b|\bdaily\b/i, () => ['daily', ymd(today)]],
    [/每(?:个)?(?:周|星期|礼拜)([一二三四五六日天七])/, (m) => { const tg = WEEK[m[1]]; return ['weekly', ymd(addDays(today, (tg - today.getDay() + 7) % 7))]; }],
    [/每周|\bevery\s+week\b|\bweekly\b/i, () => ['weekly', ymd(today)]],
    [new RegExp('每(?:个)?月' + N + '[日号]'), (m) => {
      const d = num(m[1]); if (!(d >= 1 && d <= 31)) return null;
      let x = new Date(today.getFullYear(), today.getMonth(), Math.min(d, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
      if (x < today) x = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(d, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()));
      return ['monthly', ymd(x)]; }],
    [/每(?:个)?月|\bevery\s+month\b|\bmonthly\b/i, () => ['monthly', ymd(today)]],
    [/每年|\bevery\s+year\b|\byearly\b|\bannually\b/i, () => ['yearly', ymd(today)]],
  ];
  for (const [re, fn] of rules) {
    const m = re.exec(text);
    if (!m) continue;
    const r = fn(m);
    if (!r) continue;
    return { repeat: r[0], date: r[1], rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
  }
  return null;
}
