import { fetchText, errorText } from './common.js';
import { addDays, today } from './util.js';

/**
 * CNY-based reference rates from the ECB via frankfurter.dev (about 30 currencies, no key).
 * `rate` everywhere means units of the currency per 1 CNY. A currency the ECB does not publish needs a manual rate.
 */
const API = 'https://api.frankfurter.dev/v1/';
const TTL = 6 * 60 * 60 * 1000;
let latest = null;
let history = null;
let forced = null;

export function setRatesForTest(value) { latest = value; }
/** Tests: every history request returns this table and the network is never used. */
export function setHistoryForTest(value) { forced = value; }

export async function getRates({ refresh = false } = {}) {
  if (latest && !refresh && Date.now() - latest.fetchedAt < TTL) return latest;
  try {
    const { text } = await fetchText(API + 'latest?base=CNY', { timeoutMs: 8000, maxBytes: 64 * 1024 });
    const j = JSON.parse(text);
    if (!j || !j.rates || typeof j.rates !== 'object') throw new Error('unexpected response');
    latest = { base: 'CNY', date: j.date, rates: { ...j.rates, CNY: 1 }, fetchedAt: Date.now(), source: 'frankfurter.dev (ECB)', stale: false };
    return latest;
  } catch (error) {
    if (latest) return { ...latest, stale: true, error: errorText(error) };
    throw new Error('Could not load exchange rates: ' + errorText(error) + '. Pass `rate` (sale currency per 1 CNY) to calculate offline.');
  }
}

/** Sale currency per 1 CNY from a rates table, or null when the currency is not covered. */
export function rateIn(table, currency) {
  const v = table && table.rates ? table.rates[String(currency).toUpperCase()] : undefined;
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Daily rates from `from` to today in one request, cached for the process (an import of hundreds of orders makes one call).
 * A later request for an earlier date widens the cache. Returns { byDate, dates, from, ok }; empty when the service is unreachable.
 */
export async function getHistory(from) {
  if (forced) return forced;
  const need = from < addDays(today(), -1100) ? addDays(today(), -1100) : from;
  if (history && history.ok && Date.now() - history.fetchedAt < TTL && history.from <= need) return history;
  const lo = need < today() ? need : addDays(today(), -10);
  let value = { byDate: {}, dates: [], ok: false, from: lo };
  try {
    const { text } = await fetchText(API + lo + '..' + today() + '?base=CNY', { timeoutMs: 15000, maxBytes: 3 * 1024 * 1024 });
    const j = JSON.parse(text);
    if (j && j.rates && typeof j.rates === 'object') value = { byDate: j.rates, dates: Object.keys(j.rates).sort(), ok: true, from: lo };
  } catch { /* offline: callers fall back to the latest rate */ }
  value.fetchedAt = Date.now();
  if (value.ok) history = value;
  return value;
}

/** Rate on `date` (the latest published day on or before it, else the earliest known); null when nothing is known. */
export function rateOnDate(hist, date, currency) {
  const cur = String(currency).toUpperCase();
  if (cur === 'CNY') return 1;
  if (!hist || !hist.dates || !hist.dates.length) return null;
  let pick = null;
  for (const d of hist.dates) { if (d <= date) pick = d; else break; }
  const row = hist.byDate[pick || hist.dates[0]];
  const v = row ? row[cur] : undefined;
  return Number.isFinite(v) && v > 0 ? v : null;
}
