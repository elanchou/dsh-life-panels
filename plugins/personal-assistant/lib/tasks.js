import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { TASKS_FILE as FILE } from './paths.js';
import { textOfMessage } from './util.js';

const MAX_TASKS = 200;
const VISIBLE = 60;
const REFRESH_MS = 3000;
const SUMMARY_CHARS = 600;

/** Derive a board state from a DSH session log. */
function stateOf(events) {
  let open = 0;
  let started = false;
  let reason;
  let summary = '';
  for (const event of events) {
    if (event.type === 'turn/start') { open += 1; started = true; }
    else if (event.type === 'turn/end') { open = Math.max(0, open - 1); reason = event.data?.reason?.kind; }
    else if (event.type === 'assistant/message') {
      const text = textOfMessage(event.data?.message);
      if (text) summary = text;
    }
  }
  let state = 'queued';
  if (open > 0) state = 'running';
  else if (started) {
    if (reason === 'completed') state = 'done';
    else if (reason === 'blocked') state = 'waiting';
    else if (reason === 'aborted' || reason === 'interrupted') state = 'stopped';
    else state = 'failed';
  }
  return { state, summary: summary.slice(0, SUMMARY_CHARS) };
}

/** Durable list of the task sessions Lucy has opened, with live state read from each session. */
export function createTaskBoard(ctx, onChange) {
  let tasks = [];
  let loading;
  let saving = Promise.resolve();
  let refreshedAt = 0;
  let refreshing;

  const load = () => (loading ??= readFile(FILE, 'utf8')
    .then((text) => { const value = JSON.parse(text); if (Array.isArray(value)) tasks = value; })
    .catch(() => undefined));

  async function save() {
    await mkdir(dirname(FILE), { recursive: true, mode: 0o700 });
    const temp = `${FILE}.tmp`;
    await writeFile(temp, JSON.stringify(tasks, null, 2), { mode: 0o600 });
    await rename(temp, FILE);
  }
  const persist = () => (saving = saving.then(save).catch(() => undefined));

  async function add(task) {
    await load();
    tasks.unshift({ ...task, state: 'queued', summary: '', updatedAt: task.createdAt });
    if (tasks.length > MAX_TASKS) tasks.length = MAX_TASKS;
    await persist();
  }

  const ACTIVE = new Set(['queued', 'running', 'waiting']);
  const RECENT_MS = 10 * 60 * 1000;

  async function refreshAll() {
    let changed = false;
    for (const task of tasks.slice(0, VISIBLE)) {
      if (task.dismissed) continue;
      // Settled tasks are only re-read for a while: a follow-up in the session can still reopen them.
      if (!ACTIVE.has(task.state) && Date.now() - (task.updatedAt ?? 0) > RECENT_MS) continue;
      let inspected;
      try {
        inspected = await ctx.sessionController.inspect(task.sessionId);
      } catch {
        continue;
      }
      const next = stateOf(inspected.events ?? []);
      if (next.state !== task.state || next.summary !== task.summary) {
        const previous = task.state;
        Object.assign(task, next, { updatedAt: Date.now() });
        changed = true;
        if (next.state !== previous) {
          try { onChange?.(task, previous); } catch { /* a notifier bug must not stop the board */ }
        }
      }
    }
    if (changed) await persist();
  }

  async function refresh() {
    await load();
    refreshing ??= refreshAll().finally(() => { refreshedAt = Date.now(); refreshing = undefined; });
    await refreshing;
  }

  async function list() {
    await load();
    if (Date.now() - refreshedAt > REFRESH_MS) await refresh();
    return tasks.filter((task) => !task.dismissed).slice(0, VISIBLE);
  }

  async function dismiss(id) {
    await load();
    const task = tasks.find((item) => item.id === id);
    if (!task) return false;
    task.dismissed = true;
    await persist();
    return true;
  }

  async function get(id) {
    await load();
    return tasks.find((task) => task.id === id);
  }

  return { add, list, dismiss, refresh, get };
}
