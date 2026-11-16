import { Store, dataFile, registerRoute, registerTool, clip, uid } from './common.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/notes';
const MAX_NOTES = 5000;
const MAX_BODY = 20000;
const MAX_TAGS = 12;

/** Tags typed inline as #word (letters, digits, CJK, - and _) are collected from the body, so quick capture needs no extra field. */
export function inlineTags(body) {
  const out = [];
  for (const m of String(body).matchAll(/(^|[\s,，。;；])#([\p{L}\p{N}_-]{1,24})(?=$|[\s,，。;；])/gu)) if (/\p{L}/u.test(m[2])) out.push(m[2]); // "#5" is a number, not a tag
  return out;
}
/**
 * Checklist items ("- [ ] text", "* [x] text", "1. [ ] text") outside ``` code fences, in order.
 * The panel numbers its checkboxes the same way, so `check` can address one by index.
 */
const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/;
export function taskLines(body) {
  const out = [];
  let fence = false;
  String(body).split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) { fence = !fence; return; }
    if (fence) return;
    const m = TASK_RE.exec(line);
    if (m) out.push({ line: i, done: m[2] !== ' ' });
  });
  return out;
}
/** Flip (or set) checklist item `index`; returns the new body, or null when there is no such item. */
export function toggleTask(body, index, done) {
  const tasks = taskLines(body);
  const task = tasks[index];
  if (!task) return null;
  const lines = String(body).split('\n');
  const next = done === undefined ? !task.done : !!done;
  lines[task.line] = lines[task.line].replace(TASK_RE, (_, a, _b, c) => a + (next ? 'x' : ' ') + c);
  return lines.join('\n');
}
/**
 * Tags after a body edit: tags written in the text follow the text exactly (so autosaving "#wor" and then "#work"
 * leaves only "work"), and tags added by hand that never appeared in the text are kept.
 */
export function retag(oldTags, oldBody, newBody) {
  const before = new Set(inlineTags(oldBody).map((t) => t.toLowerCase()));
  const manual = (oldTags || []).filter((t) => !before.has(t));
  return normalizeTags([...inlineTags(newBody), ...manual]);
}

export function normalizeTags(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const tag = String(raw).trim().replace(/^#/, '').toLowerCase().slice(0, 24);
    if (tag && /^[\p{L}\p{N}_-]+$/u.test(tag) && !seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out.slice(0, MAX_TAGS);
}

export function apply(ctx) {
  const store = new Store(dataFile('notes'), () => ({ version: 1, notes: [] }));

  const view = (n, full) => {
    const tasks = taskLines(n.body);
    return {
      id: n.id, title: n.title || '', body: full ? n.body : clip(n.body, 400), tags: n.tags || [], pinned: !!n.pinned,
      createdAt: n.createdAt, updatedAt: n.updatedAt, truncated: !full && n.body.length > 400,
      inlineTags: normalizeTags(inlineTags(n.body)),
      tasks: { total: tasks.length, done: tasks.filter((x) => x.done).length },
    };
  };
  const byRecency = (a, b) => (a.pinned === b.pinned ? String(b.updatedAt).localeCompare(String(a.updatedAt)) : a.pinned ? -1 : 1);

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'list';
    if (action === 'list') {
      const q = String(input.query || '').trim().toLowerCase();
      const tag = String(input.tag || '').trim().replace(/^#/, '').toLowerCase();
      let items = data.notes.filter((n) => (!tag || (n.tags || []).includes(tag)) && (!q || (n.title + '\n' + n.body + '\n' + (n.tags || []).join(' ')).toLowerCase().includes(q)));
      items = items.slice().sort(byRecency);
      const limit = Math.max(1, Math.min(500, Math.floor(Number(input.limit) || 200)));
      const counts = new Map();
      for (const n of data.notes) for (const t of n.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
      const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
      return { ok: true, total: data.notes.length, matched: items.length, items: items.slice(0, limit).map((n) => view(n, false)), tags };
    }
    if (action === 'get') {
      const n = data.notes.find((x) => x.id === input.id);
      return n ? { ok: true, note: view(n, true) } : { ok: false, error: 'No such note: ' + String(input.id) };
    }
    if (action === 'add') {
      const body = String(input.body || '').replace(/\s+$/, '').replace(/^\s*\n/, '');
      if (!body.trim()) return { ok: false, error: 'body is required' };
      if (body.length > MAX_BODY) return { ok: false, error: 'Note is too long (max ' + MAX_BODY + ' characters)' };
      if (data.notes.length >= MAX_NOTES) return { ok: false, error: 'Too many notes (max ' + MAX_NOTES + ')' };
      const now = new Date().toISOString();
      const note = {
        id: uid(), title: clip(String(input.title || '').trim(), 120), body,
        tags: normalizeTags([...(Array.isArray(input.tags) ? input.tags : []), ...inlineTags(body)]), pinned: !!input.pinned, createdAt: now, updatedAt: now,
      };
      data.notes.push(note);
      await store.save();
      return { ok: true, note: view(note, true) };
    }
    if (action === 'update') {
      const n = data.notes.find((x) => x.id === input.id);
      if (!n) return { ok: false, error: 'No such note: ' + String(input.id) };
      const oldBody = n.body;
      if (input.body !== undefined) {
        const body = String(input.body).replace(/\s+$/, '');
        if (!body.trim()) return { ok: false, error: 'body cannot be empty; use delete to remove a note' };
        if (body.length > MAX_BODY) return { ok: false, error: 'Note is too long (max ' + MAX_BODY + ' characters)' };
        n.body = body;
      }
      if (input.title !== undefined) n.title = clip(String(input.title).trim(), 120);
      // An explicit tag list is exact, so a tag removed in the UI stays removed even if #tag still appears in the text.
      // Without one, tags written into an edited body are added to the existing ones.
      if (input.tags !== undefined) n.tags = normalizeTags(input.tags);
      else if (input.body !== undefined) n.tags = retag(n.tags, oldBody, n.body);
      if (input.pinned !== undefined) n.pinned = !!input.pinned;
      n.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, note: view(n, true) };
    }
    if (action === 'check') {
      const n = data.notes.find((x) => x.id === input.id);
      if (!n) return { ok: false, error: 'No such note: ' + String(input.id) };
      const index = Math.floor(Number(input.index));
      const next = Number.isFinite(index) && index >= 0 ? toggleTask(n.body, index, input.done) : null;
      if (next === null) return { ok: false, error: 'No checklist item ' + String(input.index) + ' in this note' };
      n.body = next;
      n.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, note: view(n, true) };
    }
    if (action === 'delete') {
      const i = data.notes.findIndex((x) => x.id === input.id);
      if (i < 0) return { ok: false, error: 'No such note: ' + String(input.id) };
      data.notes.splice(i, 1);
      await store.save();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'notes');
  registerTool(ctx, {
    name: 'notes',
    description: 'Quick notes in the sidebar Notes panel: jot ideas, links and snippets, with tags and search. Bodies are Markdown; "- [ ] item" lines are checklist items. Actions: list (optional query, tag, limit; returns notes newest first with pinned ones on top, each with checklist progress, plus all tags), get (id; full text), add (body, optional title, tags, pinned; #tag words inside the body also become tags), update (id plus body, title, tags, pinned), check (id, index: 0-based checklist item, optional done; omit done to flip it), delete (id). Use it when the user asks to remember, note down, or look up something they noted earlier.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'add', 'update', 'check', 'delete'], description: 'Operation to perform.' },
        index: { type: 'number', description: 'check: 0-based position of the checklist item among the note\'s checklist items.' },
        done: { type: 'boolean', description: 'check: true ticks, false unticks; omit to flip.' },
        id: { type: 'string', description: 'Note id from list or add. Required for get, update, check and delete.' },
        body: { type: 'string', description: 'add/update: the note text, Markdown.' },
        title: { type: 'string', description: 'add/update: optional short title.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'add/update: tags without the # sign; on update the list replaces the existing tags exactly.' },
        pinned: { type: 'boolean', description: 'add/update: pin the note to the top.' },
        query: { type: 'string', description: 'list: case-insensitive text filter over title, body and tags.' },
        tag: { type: 'string', description: 'list: only notes with this tag.' },
        limit: { type: 'number', description: 'list: maximum notes, default 200.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'notes');
}
