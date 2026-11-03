/**
 * Spaced repetition for the vocabulary panel: a compact SM-2 variant with four grades.
 * Dates are local YYYY-MM-DD strings; an interval of 0 means "again today".
 */
export const GRADES = ['again', 'hard', 'good', 'easy'];
const MAX_INTERVAL = 365;
const MIN_EASE = 1.3;

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  const p = (v) => String(v).padStart(2, '0');
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

/** Applies a grade to the card in place and returns whether this was the card's first study. */
export function applyGrade(card, grade, today) {
  if (!GRADES.includes(grade)) throw new Error('grade must be again, hard, good or easy');
  const first = !card.reps;
  let ease = card.ease || 2.5;
  let iv = card.interval || 0;
  if (grade === 'again') {
    if (card.state === 'review') card.lapses = (card.lapses || 0) + 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    iv = 0;
  } else if (grade === 'hard') {
    ease = Math.max(MIN_EASE, ease - 0.15);
    iv = iv < 1 ? 1 : Math.max(iv + 1, Math.round(iv * 1.2));
  } else if (grade === 'good') {
    iv = iv < 1 ? 1 : Math.max(iv + 1, Math.round(iv * ease));
  } else {
    ease += 0.15;
    iv = iv < 1 ? (first ? 4 : 2) : Math.max(iv + 2, Math.round(iv * ease * 1.3));
  }
  card.ease = Math.round(ease * 100) / 100;
  card.interval = Math.min(iv, MAX_INTERVAL);
  card.state = card.interval === 0 ? 'learning' : 'review';
  card.due = addDays(today, card.interval);
  card.reps = (card.reps || 0) + 1;
  card.lastGrade = grade;
  card.lastAt = new Date().toISOString();
  return first;
}

/** Consecutive days with study activity, ending today (or yesterday when today has none yet). */
export function streak(days, today) {
  const active = new Set(days.filter((d) => (d.newCount || 0) + (d.reviewCount || 0) > 0).map((d) => d.key));
  let cursor = active.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (active.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}
