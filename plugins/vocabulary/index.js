import { promises as fs } from 'node:fs';
import { Store, dataFile, registerRoute, registerTool, clip, localToday } from './common.js';
import { GRADES, applyGrade, addDays, streak } from './srs.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/vocabulary';
const BOOKS = { ielts: 'IELTS 雅思', toefl: 'TOEFL 托福' };
const MASTERED_DAYS = 21;
const MAX_REVIEWS = 200;
const HISTORY_DAYS = 30;

const keyOf = (word) => String(word || '').trim().toLowerCase();

/** Word books ship as JSON next to this file: { words: [[word, phonetic, meaning], ...] }, most useful first. */
const bookCache = new Map();
async function loadBook(id) {
  if (!BOOKS[id]) throw new Error('Unknown book: ' + String(id) + '. Available: ' + Object.keys(BOOKS).join(', '));
  if (!bookCache.has(id)) {
    const promise = fs.readFile(new URL('./books/' + id + '.json', import.meta.url), 'utf8').then((text) => {
      const doc = JSON.parse(text);
      const index = new Map(doc.words.map((w, i) => [keyOf(w[0]), i]));
      return { ...doc, index };
    });
    promise.catch(() => bookCache.delete(id));
    bookCache.set(id, promise);
  }
  return bookCache.get(id);
}
async function lookupWord(word) {
  const k = keyOf(word);
  for (const id of Object.keys(BOOKS)) {
    const book = await loadBook(id);
    const i = book.index.get(k);
    if (i !== undefined) {
      const [w, phonetic, meaning] = book.words[i];
      return { word: w, phonetic, meaning, book: id };
    }
  }
  return null;
}

function cardView(card, today) {
  const { updatedAt, ...rest } = card;
  return { ...rest, isDue: card.state !== 'new' && !!card.due && card.due <= today, mastered: (card.interval || 0) >= MASTERED_DAYS };
}
/** Next interval in days for each grade, shown on the grading buttons. */
function preview(card, today) {
  const out = {};
  for (const g of GRADES) { const c = { ...card }; applyGrade(c, g, today); out[g] = c.interval; }
  return out;
}

export function apply(ctx) {
  const store = new Store(dataFile('vocabulary'), () => ({
    version: 1,
    settings: { book: 'ielts', dailyNew: 20, updatedAt: null },
    cards: [],
    days: [],
  }));

  function dayOf(data, today) {
    let day = data.days.find((d) => d.key === today);
    if (!day) { day = { key: today, newCount: 0, reviewCount: 0, updatedAt: null }; data.days.push(day); }
    return day;
  }
  function summary(data, today) {
    const day = data.days.find((d) => d.key === today) || { newCount: 0, reviewCount: 0 };
    const studied = data.cards.filter((c) => c.state !== 'new');
    const due = studied.filter((c) => c.due && c.due <= today).length;
    const history = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const key = addDays(today, -i);
      const d = data.days.find((x) => x.key === key);
      history.push({ date: key, newCount: d ? d.newCount : 0, reviewCount: d ? d.reviewCount : 0 });
    }
    return {
      today,
      settings: { book: data.settings.book, dailyNew: data.settings.dailyNew },
      todayNew: day.newCount, todayReview: day.reviewCount,
      newRemaining: Math.max(0, data.settings.dailyNew - day.newCount),
      due,
      learning: studied.filter((c) => (c.interval || 0) < MASTERED_DAYS).length,
      mastered: studied.filter((c) => (c.interval || 0) >= MASTERED_DAYS).length,
      starred: data.cards.filter((c) => c.starred).length,
      added: data.cards.filter((c) => c.state === 'new').length,
      streak: streak(data.days, today),
      history,
    };
  }
  async function booksInfo(data) {
    const out = [];
    for (const id of Object.keys(BOOKS)) {
      const book = await loadBook(id);
      const learned = data.cards.filter((c) => c.state !== 'new' && book.index.has(c.id)).length;
      out.push({ id, name: BOOKS[id], total: book.words.length, learned });
    }
    return out;
  }
  /** New words for today: words added by hand first, then the current book in order, skipping words already carded. */
  async function freshWords(data, limit) {
    if (limit <= 0) return [];
    const out = data.cards.filter((c) => c.state === 'new').slice(0, limit).map((c) => ({ ...c }));
    if (out.length >= limit) return out;
    const book = await loadBook(data.settings.book);
    const known = new Set(data.cards.map((c) => c.id));
    for (const [word, phonetic, meaning] of book.words) {
      if (out.length >= limit) break;
      const id = keyOf(word);
      if (known.has(id)) continue;
      out.push({ id, word, phonetic, meaning, book: data.settings.book, state: 'new', reps: 0 });
    }
    return out;
  }

  async function run(input) {
    const data = await store.load();
    const today = localToday();
    const action = input.action || 'status';
    const findCard = (ref) => { const k = keyOf(ref); return data.cards.find((c) => c.id === k); };

    if (action === 'status') {
      return { ok: true, ...summary(data, today), books: await booksInfo(data) };
    }
    if (action === 'session') {
      const reviews = data.cards.filter((c) => c.state !== 'new' && c.due && c.due <= today)
        .sort((a, b) => (a.due || '').localeCompare(b.due || '') || (a.interval || 0) - (b.interval || 0))
        .slice(0, MAX_REVIEWS);
      const s = summary(data, today);
      const fresh = await freshWords(data, input.extraNew ? Math.min(100, Number(input.extraNew) || 0) : s.newRemaining);
      const cards = [...reviews, ...fresh].map((c) => ({ ...cardView(c, today), next: preview(c, today) }));
      return { ok: true, ...s, cards };
    }
    if (action === 'grade') {
      const grade = String(input.grade || '');
      if (!GRADES.includes(grade)) return { ok: false, error: 'grade must be again, hard, good or easy' };
      let card = findCard(input.id || input.word);
      if (!card) {
        const found = await lookupWord(input.id || input.word);
        if (!found) return { ok: false, error: 'Unknown word: ' + String(input.id || input.word) + '. Add it first.' };
        card = { id: keyOf(found.word), word: found.word, phonetic: found.phonetic, meaning: found.meaning, book: found.book, state: 'new', reps: 0, addedAt: new Date().toISOString() };
        data.cards.push(card);
      }
      const first = applyGrade(card, grade, today);
      card.updatedAt = card.lastAt;
      const day = dayOf(data, today);
      if (first) day.newCount++; else day.reviewCount++;
      day.updatedAt = card.lastAt;
      await store.save();
      return { ok: true, card: { ...cardView(card, today), next: preview(card, today) }, todayNew: day.newCount, todayReview: day.reviewCount };
    }
    if (action === 'add') {
      const raw = Array.isArray(input.words) ? input.words : [input.word ? { word: input.word, meaning: input.meaning, phonetic: input.phonetic } : null];
      const added = []; const skipped = []; const missing = [];
      const now = new Date().toISOString();
      for (const entry of raw.slice(0, 200)) {
        const e = typeof entry === 'string' ? { word: entry } : (entry || {});
        const word = String(e.word || '').trim();
        if (!word || word.length > 64) continue;
        const id = keyOf(word);
        const existing = data.cards.find((c) => c.id === id);
        if (existing) {
          if (!existing.starred) { existing.starred = true; existing.updatedAt = now; }
          skipped.push(word); continue;
        }
        const found = await lookupWord(word);
        const meaning = String(e.meaning || '').trim() || (found ? found.meaning : '');
        if (!meaning) { missing.push(word); continue; }
        data.cards.push({
          id, word: found ? found.word : word, phonetic: String(e.phonetic || '').trim() || (found ? found.phonetic : ''),
          meaning: clip(meaning, 300), note: clip(String(e.note || '').trim(), 300) || undefined,
          book: found ? found.book : 'custom', state: 'new', reps: 0, starred: true, addedAt: now, updatedAt: now,
        });
        added.push(word);
      }
      if (added.length || skipped.length) await store.save();
      const result = { ok: true, added, alreadyAdded: skipped };
      if (missing.length) result.needMeaning = missing;
      return result;
    }
    if (action === 'list') {
      const filter = input.filter || 'all';
      const q = keyOf(input.query);
      let list = data.cards.filter((c) => {
        if (filter === 'due') return c.state !== 'new' && c.due && c.due <= today;
        if (filter === 'learning') return c.state !== 'new' && (c.interval || 0) < MASTERED_DAYS;
        if (filter === 'mastered') return (c.interval || 0) >= MASTERED_DAYS;
        if (filter === 'starred') return !!c.starred;
        if (filter === 'new') return c.state === 'new';
        if (filter === 'hard') return (c.lapses || 0) >= 2 || c.lastGrade === 'again';
        return true;
      });
      if (q) list = list.filter((c) => c.id.includes(q) || String(c.meaning || '').includes(String(input.query).trim()));
      list.sort((a, b) => (b.lastAt || b.addedAt || '').localeCompare(a.lastAt || a.addedAt || ''));
      const limit = Math.max(1, Math.min(500, Number(input.limit) || 200));
      return { ok: true, total: list.length, cards: list.slice(0, limit).map((c) => cardView(c, today)) };
    }
    if (action === 'lookup') {
      const found = await lookupWord(input.word || input.id);
      const card = findCard(input.word || input.id);
      return { ok: true, word: found, card: card ? cardView(card, today) : null };
    }
    if (action === 'settings') {
      if (input.book !== undefined) {
        if (!BOOKS[input.book]) return { ok: false, error: 'book must be one of: ' + Object.keys(BOOKS).join(', ') };
        data.settings.book = input.book;
      }
      if (input.dailyNew !== undefined) {
        const n = Math.round(Number(input.dailyNew));
        if (!Number.isFinite(n) || n < 0 || n > 200) return { ok: false, error: 'dailyNew must be 0-200' };
        data.settings.dailyNew = n;
      }
      data.settings.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, ...summary(data, today), books: await booksInfo(data) };
    }
    const card = findCard(input.id || input.word);
    if (!card) return { ok: false, error: 'No card for ' + String(input.id || input.word) };
    if (action === 'star') {
      card.starred = input.starred === undefined ? !card.starred : !!input.starred;
      card.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, card: cardView(card, today) };
    }
    if (action === 'update') {
      if (input.meaning !== undefined && String(input.meaning).trim()) card.meaning = clip(String(input.meaning).trim(), 300);
      if (input.note !== undefined) card.note = clip(String(input.note).trim(), 300);
      if (input.phonetic !== undefined) card.phonetic = String(input.phonetic).trim().slice(0, 80);
      card.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, card: cardView(card, today) };
    }
    if (action === 'reset') {
      Object.assign(card, { state: 'new', reps: 0, interval: 0, ease: 2.5, lapses: 0, due: null, lastGrade: null, updatedAt: new Date().toISOString() });
      await store.save();
      return { ok: true, card: cardView(card, today) };
    }
    if (action === 'delete') {
      data.cards.splice(data.cards.indexOf(card), 1);
      await store.save();
      return { ok: true, deleted: card.id };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'vocabulary');
  registerTool(ctx, {
    name: 'vocabulary',
    description: 'English vocabulary trainer in the sidebar Vocabulary panel (IELTS and TOEFL word books, spaced repetition). Actions: status (today\'s progress, due count, streak, books); session (today\'s review and new cards); grade (id or word, grade again|hard|good|easy; records a study); add (words: list of strings or {word, meaning?, phonetic?, note?}; meaning is looked up in the books when omitted, needMeaning lists words you must supply a Chinese meaning for); list (filter all|due|learning|mastered|starred|new|hard, query, limit); lookup (word); update (id plus meaning, note, phonetic); star (id, starred); reset (id; relearn from scratch); delete (id); settings (book ielts|toefl, dailyNew 0-200). Use add to save words the user meets while reading, and list filter hard to quiz them.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'session', 'grade', 'add', 'list', 'lookup', 'update', 'star', 'reset', 'delete', 'settings'], description: 'Operation to perform.' },
        id: { type: 'string', description: 'Card id (the lowercase word).' },
        word: { type: 'string', description: 'grade/lookup/add: the word itself.' },
        words: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'object', properties: { word: { type: 'string' }, meaning: { type: 'string' }, phonetic: { type: 'string' }, note: { type: 'string' } }, required: ['word'] }] }, description: 'add: words to add.' },
        grade: { type: 'string', enum: GRADES, description: 'grade: how well the user recalled it.' },
        meaning: { type: 'string', description: 'add/update: Chinese meaning.' },
        phonetic: { type: 'string', description: 'add/update: IPA.' },
        note: { type: 'string', description: 'update: example sentence or memory hint.' },
        starred: { type: 'boolean', description: 'star: starred state; omit to toggle.' },
        filter: { type: 'string', enum: ['all', 'due', 'learning', 'mastered', 'starred', 'new', 'hard'], description: 'list: which cards.' },
        query: { type: 'string', description: 'list: word or meaning substring.' },
        limit: { type: 'number', description: 'list: maximum cards, default 200.' },
        extraNew: { type: 'number', description: 'session: learn this many new words beyond the daily quota.' },
        book: { type: 'string', enum: Object.keys(BOOKS), description: 'settings: word book for new words.' },
        dailyNew: { type: 'number', description: 'settings: new words per day.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'vocabulary');
}
