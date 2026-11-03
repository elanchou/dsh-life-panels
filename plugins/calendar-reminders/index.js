import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { merge3, withFileLock } from './merge.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/calendar-reminders';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function dataFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'plugin-data', 'calendar-reminders.json');
}

async function mtimeOf(file) {
  try { return (await fs.stat(file)).mtimeMs; } catch { return null; }
}
async function readItems(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Small JSON store; writes are serialized, atomic (temp file + rename) and hold the shared per-file lock.
 * When another writer (cloud sync) replaced the file, load() re-reads it and save() three-way merges onto it.
 */
class Store {
  constructor(file) {
    this.file = file;
    this.items = null;
    this.baseText = null;
    this.mtime = null;
    this.queue = Promise.resolve();
  }
  async load() {
    const mtime = await mtimeOf(this.file);
    if (this.items && mtime === this.mtime) return this.items;
    this.items = await readItems(this.file);
    this.baseText = JSON.stringify(this.items);
    this.mtime = mtime;
    return this.items;
  }
  save() {
    const run = () => withFileLock(this.file, async () => {
      const mtime = await mtimeOf(this.file);
      if (this.baseText !== null && mtime !== this.mtime) {
        const merged = merge3(JSON.parse(this.baseText), this.items, await readItems(this.file));
        this.items.length = 0;
        this.items.push(...merged);
      }
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.' + process.pid + '.tmp';
      await fs.writeFile(tmp, JSON.stringify({ version: 1, items: this.items }, null, 2));
      await fs.rename(tmp, this.file);
      this.baseText = JSON.stringify(this.items);
      this.mtime = await mtimeOf(this.file);
    });
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
}

function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function validate(input) {
  const out = {};
  if (input.title !== undefined) {
    const title = String(input.title).trim();
    if (!title) return { error: 'title must not be empty' };
    out.title = title.slice(0, 200);
  }
  if (input.date !== undefined) {
    if (input.date === null || input.date === '') out.date = null;
    else if (!DATE_RE.test(String(input.date)) || Number.isNaN(Date.parse(input.date))) return { error: 'date must be YYYY-MM-DD' };
    else out.date = String(input.date);
  }
  if (input.time !== undefined) {
    if (input.time === null || input.time === '') out.time = null;
    else if (!TIME_RE.test(String(input.time))) return { error: 'time must be HH:mm (24-hour)' };
    else out.time = String(input.time);
  }
  if (input.notes !== undefined) out.notes = String(input.notes).slice(0, 2000);
  return { value: out };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ka = (a.date || '9999-99-99') + ' ' + (a.time || '99:99');
    const kb = (b.date || '9999-99-99') + ' ' + (b.time || '99:99');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

function filterScope(items, scope) {
  const today = localToday();
  switch (scope) {
    case 'today': return items.filter((i) => !i.done && i.date === today);
    case 'overdue': return items.filter((i) => !i.done && i.date && i.date < today);
    case 'upcoming': return items.filter((i) => !i.done && i.date && i.date > today);
    case 'open': return items.filter((i) => !i.done);
    case 'done': return items.filter((i) => i.done);
    default: return items;
  }
}

export function apply(ctx) {
  const store = new Store(dataFile());

  async function dropSchedule(item) {
    const schedule = ctx.get('schedule');
    if (!schedule || !item.scheduleId || !item.sessionId) return;
    try { await schedule.delete({ sessionId: item.sessionId, id: item.scheduleId }); } catch { /* already gone */ }
    delete item.scheduleId;
    delete item.sessionId;
  }

  async function createSchedule(item, sessionId) {
    const schedule = ctx.get('schedule');
    if (!schedule) return 'The schedule service is not available, so no chat notification was created.';
    if (!item.date) return 'A date is required to schedule a notification.';
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    try {
      const record = await schedule.create(sessionId, {
        title: item.title.slice(0, 100),
        prompt: 'Reminder due: ' + item.title + (item.notes ? '\n' + item.notes : ''),
        at: { date: item.date, time: (item.time || '09:00') + ':00', time_zone: zone },
      });
      item.scheduleId = record.id;
      item.sessionId = sessionId;
      return null;
    } catch (error) {
      return 'Saved, but the chat notification could not be scheduled: ' + (error && error.message ? error.message : String(error));
    }
  }

  /** The single operation used by both the UI route and the agent tool. */
  async function run(input, agentId) {
    const items = await store.load();
    const action = input.action;
    if (action === 'list') {
      return { ok: true, items: sortItems(filterScope(items, input.scope)), today: localToday() };
    }
    if (action === 'add') {
      const checked = validate({ ...input, title: input.title ?? '' });
      if (checked.error) return { ok: false, error: checked.error };
      const now = new Date().toISOString();
      const item = { id: randomUUID(), title: '', notes: '', date: null, time: null, done: false, createdAt: now, updatedAt: now, ...checked.value };
      let warning = null;
      if (input.notify && agentId) warning = await createSchedule(item, agentId);
      else if (input.notify) warning = 'Chat notifications can only be created from an agent session.';
      items.push(item);
      await store.save();
      return { ok: true, item, ...(warning ? { warning } : {}) };
    }
    const item = items.find((i) => i.id === input.id);
    if (action === 'delete' || action === 'update' || action === 'complete' || action === 'reopen') {
      if (!item) return { ok: false, error: 'No item with id ' + String(input.id) };
    }
    if (action === 'delete') {
      await dropSchedule(item);
      items.splice(items.indexOf(item), 1);
      await store.save();
      return { ok: true, deleted: item.id };
    }
    if (action === 'update') {
      const checked = validate(input);
      if (checked.error) return { ok: false, error: checked.error };
      if (Object.keys(checked.value).some((k) => k === 'date' || k === 'time')) await dropSchedule(item);
      Object.assign(item, checked.value, { updatedAt: new Date().toISOString() });
      await store.save();
      return { ok: true, item };
    }
    if (action === 'complete' || action === 'reopen') {
      item.done = action === 'complete';
      item.updatedAt = new Date().toISOString();
      if (item.done) await dropSchedule(item);
      await store.save();
      return { ok: true, item };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  /* ---- HTTP route for the sidebar UI ---- */
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    async handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      const rejection = ctx.connection.requestRejection({ headers: req.headers });
      if (rejection) return send(rejection, { ok: false, error: 'unauthorized' });
      if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' });
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 64 * 1024) return send(413, { ok: false, error: 'request too large' });
        }
        const input = raw ? JSON.parse(raw) : {};
        send(200, await run(input, undefined));
      } catch (error) {
        send(500, { ok: false, error: error && error.message ? error.message : String(error) });
      }
    },
  }), 'calendar-reminders: route');

  /* ---- Agent tool ---- */
  ctx.effect(() => ctx.tools.register({
    name: 'calendar_reminders',
    description: 'Manage the user\'s calendar and reminder list shown in the sidebar panel. Actions: list (optional scope: all|open|today|upcoming|overdue|done), add (title, optional date YYYY-MM-DD, time HH:mm, notes, notify), update (id plus changed fields), complete, reopen, delete (id). Set notify=true on add to also schedule a chat message at the due time in this session. Dates use the user\'s local time zone.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'update', 'complete', 'reopen', 'delete'], description: 'Operation to perform.' },
        id: { type: 'string', description: 'Item id from a previous list or add result. Required for update, complete, reopen and delete.' },
        title: { type: 'string', description: 'Item title. Required for add.' },
        date: { type: 'string', description: 'Due date, YYYY-MM-DD. Empty string clears it on update.' },
        time: { type: 'string', description: 'Due time, HH:mm in 24-hour form. Empty string clears it on update.' },
        notes: { type: 'string', description: 'Free-form notes.' },
        notify: { type: 'boolean', description: 'On add: also create a chat notification in this session at date/time (09:00 when time is omitted).' },
        scope: { type: 'string', enum: ['all', 'open', 'today', 'upcoming', 'overdue', 'done'], description: 'On list: which items to return. Defaults to all.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const result = await run(args || {}, exec && exec.agent ? exec.agent.id : undefined);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
  }), 'calendar-reminders: tool');
}
