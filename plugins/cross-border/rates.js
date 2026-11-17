import { fetchText, errorText } from './common.js';

/** CNY-based daily reference rates from the ECB via frankfurter.dev (about 30 currencies; no AED, SAR, VND and others). */
const URL_CNY = 'https://api.frankfurter.dev/v1/latest?base=CNY';
const TTL = 6 * 60 * 60 * 1000;
let cache = null;

/** Rates already fetched in this process, or null. Never touches the network. */
export function cachedRates() { return cache; }
export function setRatesForTest(value) { cache = value; }

export async function getRates({ refresh = false } = {}) {
  if (cache && !refresh && Date.now() - cache.fetchedAt < TTL) return cache;
  try {
    const { text } = await fetchText(URL_CNY, { timeoutMs: 8000, maxBytes: 64 * 1024 });
    const j = JSON.parse(text);
    if (!j || !j.rates || typeof j.rates !== 'object') throw new Error('unexpected response');
    cache = { base: 'CNY', date: j.date, rates: { ...j.rates, CNY: 1 }, fetchedAt: Date.now(), source: 'frankfurter.dev (ECB)', stale: false };
    return cache;
  } catch (error) {
    if (cache) return { ...cache, stale: true, error: errorText(error) };
    throw new Error('Could not load exchange rates: ' + errorText(error) + '. Pass `rate` (sale currency per 1 CNY) to calculate offline.');
  }
}

/** Sale currency per 1 CNY from a rates table, or null when the currency is not covered. */
export function rateIn(table, currency) {
  const v = table && table.rates ? table.rates[String(currency).toUpperCase()] : undefined;
  return Number.isFinite(v) && v > 0 ? v : null;
}
