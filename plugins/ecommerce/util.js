import { clip, localToday } from './common.js';

export const r2 = (n) => Math.round(n * 100) / 100;
export const r1 = (n) => Math.round(n * 10) / 10;
export const n0 = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : NaN; };
export const str = (v, n) => clip(String(v ?? '').trim(), n);
export const today = localToday;
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s));
export const nowIso = () => new Date().toISOString();

const DAY = 86400000;
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export function addDays(date, n) {
  const d = new Date(Date.parse(date) + n * DAY);
  return d.toISOString().slice(0, 10);
}

/** Parse an optional non-negative number field: { value } (undefined when absent) or { error }. */
export function nonNeg(input, key, max = 1e9) {
  if (input[key] === undefined || input[key] === null || input[key] === '') return { value: undefined };
  const n = num(input[key]);
  if (Number.isNaN(n) || n < 0 || n > max) return { error: key + ' must be a number between 0 and ' + max };
  return { value: n };
}

/** Apply every non-negative number in `keys` that is present on `input` to `target`; returns an error message or null. */
export function applyNums(target, input, keys, pctKeys = []) {
  for (const k of keys) {
    const r = nonNeg(input, k, pctKeys.includes(k) ? 100 : 1e9);
    if (r.error) return r.error;
    if (r.value !== undefined) target[k] = r.value;
  }
  return null;
}

/** Order, purchase and shipment lists are filtered by an inclusive date window. */
export function inRange(date, from, to) {
  return (!from || date >= from) && (!to || date <= to);
}

export function dateRange(input, defaultDays = 30) {
  const to = isDate(input.to) ? input.to : today();
  const from = isDate(input.from) ? input.from : addDays(to, -(defaultDays - 1));
  return { from, to };
}
