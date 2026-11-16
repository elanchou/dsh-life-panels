import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { OUTBOUND_FILE } from './paths.js';
import { callbackTarget, inQuietHours } from './config.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 2 * 60 * 1000;
const STALE_MS = 12 * 60 * 60 * 1000;
const LEASE_MARGIN_MS = 90 * 1000;
const MAX_ITEMS = 8;
const MAX_SUMMARY = 400;
const MAX_HISTORY = 20;
const RETRYABLE = new Set(['noanswer', 'busy', 'error']);

const LABELS = {
  zh: {
    intro: '这通电话是你主动打给用户的,不是用户打来的。开场先问好并直接说明来意,不要问"有什么需要处理的"。',
    waiting: '需要用户确认', done: '已完成', failed: '没有完成', summary: '进展',
    task: '任务', note: '用户让你转告/说明', overview: '目前任务看板',
    manual: '用户在电脑上点了"打给我",想和你通话。先问好,简要汇报任务看板上的情况,再问用户有什么要交代的。',
    ask: '如果用户对"需要确认"的任务给出了答复,用 reply_to_task 工具转给对应任务。',
  },
  en: {
    intro: 'You placed this call to the user; they did not call you. Greet them and state the reason right away. Do not ask what they need.',
    waiting: 'needs the user\'s confirmation', done: 'finished', failed: 'did not finish', summary: 'Progress',
    task: 'Task', note: 'Message to pass on', overview: 'Current task board',
    manual: 'The user pressed "Call me" on their computer. Greet them, briefly report the task board, then ask what they want to hand off.',
    ask: 'If the user answers a task that needs confirmation, pass it on with the reply_to_task tool.',
  },
};

const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Plain-text briefing for the voice agent, in the configured conversation language. */
export function buildBriefing(language, { manual, note, tasks }) {
  const t = LABELS[language === 'en' ? 'en' : 'zh'];
  const lines = [manual ? t.manual : t.intro];
  const focus = tasks.filter((task) => task.reason);
  const rest = tasks.filter((task) => !task.reason);
  for (const task of focus) {
    lines.push(`${t.task} ${task.n} "${clip(task.title, 80)}": ${t[task.reason]}. ${task.summary ? `${t.summary}: ${clip(task.summary, MAX_SUMMARY)}` : ''}`.trim());
  }
  if (rest.length) {
    lines.push(`${t.overview}:`);
    for (const task of rest) lines.push(`${t.task} ${task.n} "${clip(task.title, 80)}": ${task.stateLabel ?? task.state}. ${clip(task.summary, 160)}`.trim());
  }
  if (note) lines.push(`${t.note}: ${clip(note, 500)}`);
  if (focus.some((task) => task.reason === 'waiting')) lines.push(t.ask);
  return lines.join('\n');
}

/**
 * Queue and policy for calls the assistant places. The Telegram gateway polls `claim()`,
 * dials, and reports the outcome with `report()`; nothing here touches the network.
 */
export function createOutbound(getConfig, log, file = OUTBOUND_FILE) {
  const pending = []; // { id, manual, note, tasks:[{taskId,title,state,reason,summary}], notBefore, attempts, queuedAt }
  let inflight;
  let saved = { autoCalls: [], history: [] };
  let loaded = false;

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      saved = { autoCalls: Array.isArray(data.autoCalls) ? data.autoCalls : [], history: Array.isArray(data.history) ? data.history : [] };
    } catch { /* first run */ }
  }

  async function persist() {
    try {
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(saved), { mode: 0o600 });
      await rename(temp, file);
    } catch (error) {
      log('error', `could not save call history: ${error?.message ?? error}`);
    }
  }

  const recentAutoCalls = (now) => saved.autoCalls.filter((at) => now - at < DAY_MS);

  function record(entry) {
    saved.history.unshift({ at: Date.now(), ...entry });
    saved.history.length = Math.min(saved.history.length, MAX_HISTORY);
  }

  /** Why an automatic call cannot go out right now, or undefined when it can. */
  function autoBlock(config, now) {
    if (config.maxCallsPerDay === 0) return 'automatic calls are off';
    if (recentAutoCalls(now).length >= config.maxCallsPerDay) return 'daily call limit reached';
    const last = Math.max(0, ...recentAutoCalls(now));
    if (now - last < config.minCallIntervalMinutes * 60_000) return 'waiting for the minimum interval';
    if (inQuietHours(new Date(now), config.quietHours)) return 'quiet hours';
    return undefined;
  }

  /** A task changed state; queue a call when the config asks for it. */
  async function notifyTask(task, reason) {
    await load();
    const config = getConfig();
    if (!config.callOn.includes(reason) || !callbackTarget(config)) return false;
    if (pending.some((p) => !p.manual && p.tasks.some((x) => x.taskId === task.id && x.reason === reason))) return false;
    pending.push({
      id: randomUUID(), manual: false, attempts: 0, queuedAt: Date.now(), notBefore: 0,
      tasks: [{ taskId: task.id, title: task.title, state: task.state, reason, summary: task.summary ?? '' }],
    });
    log('call-queued', `${reason}: ${clip(task.title, 60)}`);
    return true;
  }

  /** The user asked for a call. Manual calls skip quiet hours and the rate limits. */
  async function requestManual(note, overview) {
    await load();
    const config = getConfig();
    if (!callbackTarget(config)) return { ok: false, error: 'no allowed caller is configured' };
    if (inflight || pending.some((p) => p.manual)) return { ok: false, error: 'a call is already on its way' };
    pending.push({
      id: randomUUID(), manual: true, attempts: 0, queuedAt: Date.now(), notBefore: 0,
      note: clip(note, 500), tasks: overview,
    });
    log('call-queued', 'manual call requested');
    return { ok: true };
  }

  function dropStale(now) {
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      if (now - pending[i].queuedAt > STALE_MS) pending.splice(i, 1);
    }
  }

  /**
   * The gateway asks for work when it is idle. Everything due is merged into one call so a burst of
   * finished tasks rings the phone once. Returns undefined when nothing may go out right now.
   */
  async function claim(now = Date.now()) {
    await load();
    const config = getConfig();
    if (inflight) {
      if (now - inflight.leasedAt < config.ringTimeoutSeconds * 1000 + LEASE_MARGIN_MS) return undefined;
      log('error', 'call lease expired without a report; treating it as failed');
      await report(inflight.id, 'error', 'gateway did not report');
    }
    dropStale(now);
    const target = callbackTarget(config);
    if (!target) return undefined;
    const due = pending.filter((p) => p.notBefore <= now);
    if (due.length === 0) return undefined;
    const manual = due.some((p) => p.manual);
    if (!manual) {
      const blocked = autoBlock(config, now);
      if (blocked) return undefined;
    }
    for (const item of due) pending.splice(pending.indexOf(item), 1);
    const seen = new Set();
    const tasks = due.flatMap((p) => p.tasks).filter((t) => {
      const key = `${t.taskId}:${t.reason ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_ITEMS);
    inflight = {
      id: randomUUID(), items: due, leasedAt: now, manual,
      attempts: Math.max(...due.map((p) => p.attempts)),
      note: due.map((p) => p.note).filter(Boolean).join(' '),
      tasks,
    };
    log('calling', `${manual ? 'manual' : 'automatic'} call, ${tasks.length} task(s), attempt ${inflight.attempts + 1}`);
    return {
      id: inflight.id, userId: target, manual, note: inflight.note, tasks,
      ringTimeoutSeconds: config.ringTimeoutSeconds,
    };
  }

  /** The gateway reports how the dial ended: answered, noanswer, busy, declined or error. */
  async function report(id, outcome, detail = '') {
    await load();
    if (!inflight || inflight.id !== id) return { ok: false };
    const call = inflight;
    inflight = undefined;
    const config = getConfig();
    record({ outcome, manual: call.manual, tasks: call.tasks.length, detail: clip(detail, 120) });
    if (outcome === 'answered' || outcome === 'declined') {
      // Counting only calls that rang through keeps one bad line from using up the day's budget.
      if (!call.manual) saved.autoCalls.push(Date.now());
      saved.autoCalls = recentAutoCalls(Date.now());
    } else if (outcome === 'privacy') {
      log('call-failed', 'Telegram privacy settings block calls from the assistant account (Settings > Privacy > Calls)');
    } else if (RETRYABLE.has(outcome) && call.attempts < config.retries) {
      pending.push({
        id: randomUUID(), manual: call.manual, attempts: call.attempts + 1, queuedAt: call.items[0]?.queuedAt ?? Date.now(),
        notBefore: Date.now() + RETRY_DELAY_MS, note: call.note, tasks: call.tasks,
      });
      log('call-retry', `${outcome}; trying again in ${RETRY_DELAY_MS / 60000} min`);
    } else {
      log('call-failed', `${outcome}${detail ? `: ${clip(detail, 80)}` : ''}`);
    }
    await persist();
    return { ok: true };
  }

  async function snapshot() {
    await load();
    const now = Date.now();
    const config = getConfig();
    return {
      target: callbackTarget(config) ? 'configured' : 'missing',
      queued: pending.length,
      dialing: Boolean(inflight),
      autoCallsToday: recentAutoCalls(now).length,
      blockedBy: pending.length && !pending.some((p) => p.manual) ? autoBlock(config, now) ?? null : null,
      history: saved.history,
    };
  }

  /** Context for the voice agent of an outgoing call; only the call currently being dialed qualifies. */
  const current = (id) => (inflight && inflight.id === id ? { manual: inflight.manual, note: inflight.note, tasks: inflight.tasks } : undefined);

  return { notifyTask, requestManual, claim, report, snapshot, current };
}
