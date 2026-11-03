import { Store, dataFile, registerRoute, registerTool, clip, uid, localToday } from './common.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/focus';
const PHASES = ['focus', 'short', 'long'];
const MIN_RECORD_MS = 60 * 1000;
const KEEP_SESSIONS = 3000;

const DEFAULT_SETTINGS = { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoBreak: true, autoFocus: false, dailyGoal: 8, updatedAt: null };
const LIMITS = { focusMin: [1, 180], shortMin: [1, 60], longMin: [1, 90], longEvery: [2, 12], dailyGoal: [1, 24] };

const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return ymdOf(new Date(y, m - 1, d + n).getTime());
}

export function apply(ctx) {
  const store = new Store(dataFile('focus'), () => ({ version: 1, settings: { ...DEFAULT_SETTINGS }, timer: null, cycle: 0, next: 'focus', sessions: [] }));

  const minutesFor = (s, phase) => (phase === 'focus' ? s.focusMin : phase === 'short' ? s.shortMin : s.longMin);

  function newTimer(data, phase, now, opts = {}) {
    const minutes = opts.minutes || minutesFor(data.settings, phase);
    const durationMs = Math.round(minutes * 60000);
    return {
      id: uid(), phase, state: 'running', durationMs, startedAt: new Date(now).toISOString(),
      endsAt: now + durationMs, remainingMs: null,
      task: phase === 'focus' ? clip(String(opts.task ?? (data.timer && data.timer.task) ?? data.lastTask ?? '').trim(), 80) : '',
      updatedAt: new Date(now).toISOString(),
    };
  }
  function elapsedMs(timer, now) {
    const left = timer.state === 'paused' ? timer.remainingMs : Math.max(0, timer.endsAt - now);
    return Math.max(0, timer.durationMs - left);
  }
  function record(data, timer, ms, completed, endMs) {
    if (timer.phase !== 'focus' || ms < MIN_RECORD_MS) return null;
    const session = {
      id: timer.id, task: timer.task || '', startedAt: timer.startedAt, endedAt: new Date(endMs).toISOString(),
      date: ymdOf(Date.parse(timer.startedAt)), minutes: Math.round(ms / 60000), completed, updatedAt: new Date(endMs).toISOString(),
    };
    data.sessions = data.sessions.filter((x) => x.id !== session.id);
    data.sessions.push(session);
    if (data.sessions.length > KEEP_SESSIONS) data.sessions.splice(0, data.sessions.length - KEEP_SESSIONS);
    if (timer.task) data.lastTask = timer.task;
    return session;
  }
  /** Ends the current phase at endMs and moves to the next one, auto-starting it when the settings say so. */
  function advance(data, endMs, completed) {
    const timer = data.timer;
    const ms = completed ? timer.durationMs : elapsedMs(timer, endMs);
    const session = record(data, timer, ms, completed, endMs);
    let next;
    if (timer.phase === 'focus') {
      if (completed) data.cycle = (data.cycle || 0) + 1;
      next = completed && data.cycle % data.settings.longEvery === 0 ? 'long' : 'short';
    } else {
      next = 'focus';
      if (timer.phase === 'long') data.cycle = 0;
    }
    const auto = next === 'focus' ? data.settings.autoFocus : data.settings.autoBreak;
    data.next = next;
    data.timer = auto && completed ? newTimer(data, next, endMs, { task: timer.task }) : null;
    return { finished: timer.phase, session, next, autoStarted: !!data.timer };
  }
  /** Finalizes phases that ran out while nobody was watching. */
  function catchUp(data, now) {
    const events = [];
    for (let i = 0; i < 24 && data.timer && data.timer.state === 'running' && data.timer.endsAt <= now; i++) {
      events.push(advance(data, data.timer.endsAt, true));
    }
    return events;
  }

  function stats(data, today) {
    const byDay = new Map();
    for (const s of data.sessions) {
      const d = byDay.get(s.date) || { minutes: 0, count: 0 };
      d.minutes += s.minutes; if (s.completed) d.count++;
      byDay.set(s.date, d);
    }
    const week = [];
    for (let i = 6; i >= 0; i--) { const date = addDays(today, -i); week.push({ date, ...(byDay.get(date) || { minutes: 0, count: 0 }) }); }
    let streakDays = 0;
    let cursor = byDay.has(today) ? today : addDays(today, -1);
    while (byDay.has(cursor) && byDay.get(cursor).minutes > 0) { streakDays++; cursor = addDays(cursor, -1); }
    const tasks = new Map();
    const since = addDays(today, -6);
    for (const s of data.sessions) if (s.date >= since && s.task) tasks.set(s.task, (tasks.get(s.task) || 0) + s.minutes);
    const t = byDay.get(today) || { minutes: 0, count: 0 };
    return {
      today: { date: today, minutes: t.minutes, count: t.count, goal: data.settings.dailyGoal },
      week, weekMinutes: week.reduce((a, d) => a + d.minutes, 0), streak: streakDays,
      totalMinutes: data.sessions.reduce((a, s) => a + s.minutes, 0),
      topTasks: [...tasks].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([task, minutes]) => ({ task, minutes })),
    };
  }
  function view(data, now, extra) {
    const timer = data.timer ? { ...data.timer, remainingMs: data.timer.state === 'paused' ? data.timer.remainingMs : Math.max(0, data.timer.endsAt - now) } : null;
    const recentTasks = [...new Set(data.sessions.slice().reverse().map((s) => s.task).filter(Boolean))].slice(0, 8);
    return {
      ok: true, now, timer, next: data.next, cycle: data.cycle || 0, settings: data.settings,
      stats: stats(data, localToday()), recent: data.sessions.slice(-12).reverse(), recentTasks, ...extra,
    };
  }

  async function run(input) {
    const data = await store.load();
    const now = Date.now();
    const action = input.action || 'status';
    const events = catchUp(data, now);
    const done = async (extra) => { await store.save(); return view(data, Date.now(), { events, ...extra }); };

    if (action === 'status') return events.length ? done() : view(data, now, { events });
    if (action === 'start') {
      const phase = input.phase || (data.timer ? data.timer.phase : data.next || 'focus');
      if (!PHASES.includes(phase)) return { ok: false, error: 'phase must be focus, short or long' };
      if (data.timer && data.timer.state === 'paused' && !input.phase && input.minutes === undefined) {
        data.timer.state = 'running'; data.timer.endsAt = now + data.timer.remainingMs; data.timer.remainingMs = null;
        data.timer.updatedAt = new Date(now).toISOString();
        return done();
      }
      if (data.timer && data.timer.state === 'running' && data.timer.phase === phase && input.minutes === undefined && input.task === undefined) return done();
      if (data.timer) record(data, data.timer, elapsedMs(data.timer, now), false, now);
      const minutes = input.minutes !== undefined ? Number(input.minutes) : undefined;
      if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)) return { ok: false, error: 'minutes must be 1-240' };
      data.timer = newTimer(data, phase, now, { minutes, task: input.task });
      return done();
    }
    if (!['pause', 'stop', 'skip', 'task', 'settings', 'history', 'delete_session'].includes(action)) return { ok: false, error: 'Unknown action: ' + String(action) };
    if (action === 'settings') {
      for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
        if (input[k] === undefined) continue;
        const n = Number(input[k]);
        if (!Number.isFinite(n) || n < lo || n > hi) return { ok: false, error: k + ' must be ' + lo + '-' + hi };
        data.settings[k] = Math.round(n);
      }
      for (const k of ['autoBreak', 'autoFocus']) if (input[k] !== undefined) data.settings[k] = !!input[k];
      data.settings.updatedAt = new Date(now).toISOString();
      return done();
    }
    if (action === 'history') {
      const days = Math.max(1, Math.min(365, Number(input.days) || 30));
      const since = addDays(localToday(), -(days - 1));
      const sessions = data.sessions.filter((s) => s.date >= since).reverse();
      return { ok: true, days, since, totalMinutes: sessions.reduce((a, s) => a + s.minutes, 0), sessions };
    }
    if (action === 'delete_session') {
      const i = data.sessions.findIndex((s) => s.id === input.id);
      if (i < 0) return { ok: false, error: 'No session ' + String(input.id) };
      data.sessions.splice(i, 1);
      return done();
    }
    if (action === 'task') {
      const task = clip(String(input.task || '').trim(), 80);
      if (data.timer && data.timer.phase === 'focus') { data.timer.task = task; data.timer.updatedAt = new Date(now).toISOString(); }
      data.lastTask = task;
      return done();
    }
    if (!data.timer) return view(data, now, { events });
    if (action === 'pause') {
      if (data.timer.state === 'running') {
        data.timer.state = 'paused'; data.timer.remainingMs = Math.max(0, data.timer.endsAt - now);
        data.timer.updatedAt = new Date(now).toISOString();
      }
      return done();
    }
    if (action === 'skip') { events.push(advance(data, now, false)); return done(); }
    // stop: end the current phase without moving on; partial focus time of a minute or more still counts.
    record(data, data.timer, elapsedMs(data.timer, now), false, now);
    if (data.timer.phase !== 'focus') data.next = 'focus';
    data.timer = null;
    return done();
  }

  registerRoute(ctx, ROUTE, run, 'focus');
  registerTool(ctx, {
    name: 'focus',
    description: 'Pomodoro focus timer in the sidebar Focus panel; white noise plays in the panel during focus phases. Actions: status (timer, settings, today and 7-day stats, top tasks); start (optional phase focus|short|long, minutes, task; with no arguments resumes a paused timer or starts the next phase); pause; stop (end the phase; focus time of at least a minute is still recorded); skip (end the phase and move to the next); task (set the current focus task label); settings (focusMin, shortMin, longMin, longEvery, autoBreak, autoFocus, dailyGoal in pomodoros); history (days, default 30); delete_session (id). Times are in the user\'s local time zone.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'start', 'pause', 'stop', 'skip', 'task', 'settings', 'history', 'delete_session'], description: 'Operation to perform.' },
        phase: { type: 'string', enum: PHASES, description: 'start: which phase.' },
        minutes: { type: 'number', description: 'start: custom length in minutes, 1-240.' },
        task: { type: 'string', description: 'start/task: what the user is focusing on.' },
        focusMin: { type: 'number', description: 'settings: focus length, minutes.' },
        shortMin: { type: 'number', description: 'settings: short break, minutes.' },
        longMin: { type: 'number', description: 'settings: long break, minutes.' },
        longEvery: { type: 'number', description: 'settings: a long break after this many focus sessions.' },
        autoBreak: { type: 'boolean', description: 'settings: start the break automatically after focus.' },
        autoFocus: { type: 'boolean', description: 'settings: start focus automatically after a break.' },
        dailyGoal: { type: 'number', description: 'settings: pomodoros per day.' },
        days: { type: 'number', description: 'history: how many days back.' },
        id: { type: 'string', description: 'delete_session: session id.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'focus');
}
