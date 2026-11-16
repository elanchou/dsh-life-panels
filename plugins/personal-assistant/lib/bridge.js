import { randomUUID } from 'node:crypto';
import { createDshControl } from './dsh.js';
import { createOutbound, buildBriefing } from './outbound.js';
import { createTaskBoard } from './tasks.js';
import { bearerOf, maskPhone, readBody, safeEqual, sendJson } from './util.js';

export const BASE = '/livekit-telegram';
const MAX_EVENTS = 50;
const MAX_PROMPT = 2000;
const MAX_TODOS = 20;
const MAX_TODO_CHARS = 300;
const MAX_TRANSCRIPT = 6000;
const KNOWN_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const BRIDGE_TOKEN_REF = 'DSH_VOICE_BRIDGE_TOKEN';

const FORWARD_HEADERS = ['x-forwarded-for', 'forwarded', 'cf-connecting-ip', 'x-real-ip', 'cf-ray'];

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

/**
 * State-changing calls must come from the DSH page. A browser cannot add a custom header to a cross-site
 * request without a CORS preflight, and this API sends no CORS headers, so the header proves the caller is our own
 * page (or a local script). The Host check blocks DNS rebinding. Origin and Sec-Fetch-Site are not required because
 * some embedded browsers drop them, but when present they must say same-origin.
 */
export function isSameOriginPage(req) {
  if (req.headers['x-pa-request'] !== '1') return false;
  if (!LOOPBACK_HOST.test(String(req.headers.host ?? ''))) return false;
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin') return false;
  const origin = req.headers.origin;
  if (typeof origin === 'string') {
    try {
      if (new URL(origin).host !== req.headers.host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/** Status exposes call metadata, so refuse anything that arrived through a tunnel or proxy. */
function isLocalRequest(req) {
  const address = req.socket?.remoteAddress ?? '';
  const loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  return loopback && !FORWARD_HEADERS.some((name) => req.headers[name] !== undefined);
}

function taskPrompt(title, todos, transcript) {
  const list = todos.map((item, index) => `${index + 1}. ${item}`).join('\n');
  return [
    '[Task package from a Telegram voice call between the user and their voice assistant Lucy. ' +
      'The to-do list below was extracted automatically from the call. Carry it out in this session.',
    'Do reversible work directly. Before anything irreversible or external (spending money, messaging other people, ' +
      'deleting data), stop and ask the user in this session. If an item is unclear, say what you assumed.',
    'When finished, end with a short plain-language summary of what was done and what is still open.]',
    '',
    `Title: ${title}`,
    '',
    'To-do list:',
    list,
    ...(transcript ? ['', 'Call transcript (context only, may contain recognition errors):', transcript] : []),
  ].join('\n');
}

/**
 * Control plane between the Telegram gateway / LiveKit voice agent and DSH.
 * The gateway announces calls (and is told whether the caller is allowed),
 * the voice agent sends prompts and reads replies for a call's room.
 */
export function createBridge(ctx, getConfig, workers, store) {
  const dsh = createDshControl(ctx, getConfig);
  const events = [];
  const log = (kind, detail) => {
    events.unshift({ at: Date.now(), kind, detail });
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  };
  const outbound = createOutbound(getConfig, log);
  const REASONS = { waiting: 'waiting', done: 'done', failed: 'failed' };
  const board = createTaskBoard(ctx, (task, previous) => {
    const reason = REASONS[task.state];
    if (reason && previous !== task.state) void outbound.notifyTask(task, reason);
  });
  const calls = new Map(); // room -> call
  const rooms = new Map(); // room -> { from, endedAt?, tasked? } kept after hang-up so the post-call task can still arrive

  async function bridgeToken() {
    const ref = getConfig().bridgeTokenEnv || BRIDGE_TOKEN_REF;
    return (await ctx.credentials.resolve(ref))?.value;
  }

  function callerAllowed(userId) {
    const allowed = (getConfig().allowedCallers ?? []).map(String);
    return allowed.includes(String(userId));
  }

  async function readJson(req) {
    try {
      return JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}');
    } catch {
      return undefined;
    }
  }

  async function status() {
    const config = getConfig();
    const ref = config.bridgeTokenEnv || BRIDGE_TOKEN_REF;
    const info = await ctx.credentials.describe(ref);
    return {
      apiPath: `${BASE}/api`,
      agentName: config.agentName,
      assistantName: config.assistantName,
      allowedCallers: (config.allowedCallers ?? []).length,
      bridgeToken: { ref, configured: info.configured },
      autoStart: config.autoStart,
      workers: workers?.snapshot(),
      activeCalls: [...calls.values()].map((call) => ({
        from: call.from, startedAt: call.startedAt, hasSession: dsh.sessionOf(call.room) !== undefined,
      })),
      outbound: await outbound.snapshot(),
      events,
    };
  }

  async function handleApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://local');
    const route = url.pathname.slice(`${BASE}/api/`.length);
    if (route === 'status' && req.method === 'GET') {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: 'status is local only' });
      return sendJson(res, 200, await status());
    }
    if (route === 'tasks' && req.method === 'GET') {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: 'tasks are local only' });
      return sendJson(res, 200, { tasks: await board.list() });
    }
    if (route === 'settings' && req.method === 'GET') {
      if (!isLocalRequest(req)) return sendJson(res, 403, { error: 'settings are local only' });
      const config = getConfig();
      const refs = [
        ['LiveKit URL', config.livekitUrlEnv], ['LiveKit API key', config.livekitApiKeyEnv], ['LiveKit API secret', config.livekitApiSecretEnv],
        ['Bridge token', config.bridgeTokenEnv], ['Telegram api_id', config.telegramApiIdEnv], ['Telegram api_hash', config.telegramApiHashEnv],
      ];
      const credentials = [];
      for (const [label, ref] of refs) credentials.push({ label, ref, configured: (await ctx.credentials.describe(ref)).configured });
      return sendJson(res, 200, { values: config, defaults: store.defaults(), credentials });
    }
    if (route === 'settings' && req.method === 'POST') {
      if (!isLocalRequest(req) || !isSameOriginPage(req)) {
        log('error', `settings refused (local=${isLocalRequest(req)}, header=${req.headers['x-pa-request'] ?? 'none'}, origin=${req.headers.origin ?? 'none'}, host=${req.headers.host ?? 'none'})`);
        return sendJson(res, 403, { error: 'forbidden' });
      }
      const body = await readJson(req);
      if (!body || typeof body.values !== 'object' || Array.isArray(body.values)) return sendJson(res, 400, { error: 'values is required' });
      try {
        const result = await store.update(body.values);
        log('settings', result.restart ? 'saved; restarting voice workers' : 'saved');
        if (result.restart) void workers.restart().catch((error) => log('error', `restart failed: ${error?.message ?? error}`));
        return sendJson(res, 200, { ok: true, values: result.values, restarted: result.restart });
      } catch (error) {
        return sendJson(res, 500, { error: `could not save settings: ${error?.message ?? error}` });
      }
    }
    if (route === 'tasks/dismiss' && req.method === 'POST') {
      if (!isLocalRequest(req) || !isSameOriginPage(req)) {
        log('error', `dismiss refused (local=${isLocalRequest(req)}, header=${req.headers['x-pa-request'] ?? 'none'}, origin=${req.headers.origin ?? 'none'}, host=${req.headers.host ?? 'none'})`);
        return sendJson(res, 403, { error: 'forbidden' });
      }
      const body = await readJson(req);
      return sendJson(res, 200, { ok: await board.dismiss(String(body?.id ?? '')) });
    }
    if (route === 'call/me' && req.method === 'POST') {
      if (!isLocalRequest(req) || !isSameOriginPage(req)) {
        log('error', `call/me refused (local=${isLocalRequest(req)}, header=${req.headers['x-pa-request'] ?? 'none'}, origin=${req.headers.origin ?? 'none'}, host=${req.headers.host ?? 'none'})`);
        return sendJson(res, 403, { error: 'forbidden' });
      }
      const body = await readJson(req);
      const tasks = (await board.list()).slice(0, 8).map((task) => ({
        taskId: task.id, title: task.title, state: task.state, summary: task.summary ?? '',
        reason: task.state === 'waiting' ? 'waiting' : undefined,
      }));
      const result = await outbound.requestManual(String(body?.note ?? ''), tasks);
      return sendJson(res, result.ok ? 200 : 409, result);
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
    const expected = await bridgeToken();
    if (!expected || !safeEqual(bearerOf(req), expected)) return sendJson(res, 401, { error: 'unauthorized' });
    const body = await readJson(req);
    if (body === undefined) return sendJson(res, 400, { error: 'bad json' });
    const room = String(body.room ?? '');

    if (route === 'outbound/claim') {
      const call = await outbound.claim();
      return sendJson(res, 200, { call: call ?? null });
    }
    if (route === 'outbound/report') {
      return sendJson(res, 200, await outbound.report(String(body.id ?? ''), String(body.outcome ?? 'error'), String(body.detail ?? '')));
    }

    if (route === 'call/start') {
      if (!room) return sendJson(res, 400, { error: 'room is required' });
      const from = `tg:${maskPhone(body.userId)}`;
      if (!callerAllowed(body.userId)) {
        log('rejected', `caller ${from} is not in the allow list`);
        return sendJson(res, 200, { allowed: false });
      }
      const known = { from };
      const outboundId = String(body.outboundId ?? '');
      if (outboundId) {
        const plan = outbound.current(outboundId);
        if (!plan) return sendJson(res, 200, { allowed: false });
        const tasks = plan.tasks.map((task, index) => ({ ...task, n: index + 1 }));
        known.taskRefs = new Map(tasks.map((task) => [task.n, task.taskId]));
        known.briefing = buildBriefing(getConfig().language, { manual: plan.manual, note: plan.note, tasks });
        known.outgoing = true;
      }
      calls.set(room, { room, from, startedAt: Date.now(), outgoing: known.outgoing === true });
      rooms.set(room, known);
      for (const [key, value] of rooms) {
        if (value.endedAt !== undefined && Date.now() - value.endedAt > KNOWN_ROOM_TTL_MS) rooms.delete(key);
      }
      log('accepted', `${known.outgoing ? 'outgoing call to' : 'call'} ${from} in room ${room}`);
      return sendJson(res, 200, { allowed: true, agentName: getConfig().agentName });
    }

    if (route === 'call/briefing') {
      const known = rooms.get(room);
      return sendJson(res, 200, { briefing: known?.briefing ?? '', outgoing: known?.outgoing === true });
    }
    if (route === 'tasks/reply') {
      const taskId = rooms.get(room)?.taskRefs?.get(Number(body.n));
      const text = String(body.text ?? '').trim().slice(0, MAX_PROMPT);
      if (!taskId || !text) return sendJson(res, 400, { error: 'unknown task number or empty text' });
      const task = await board.get(taskId);
      if (!task) return sendJson(res, 404, { error: 'task not found' });
      try {
        await dsh.followup(task.sessionId, `[The user answered by phone]\n${text}`);
      } catch (error) {
        return sendJson(res, 500, { error: String(error?.message ?? error) });
      }
      log('task-reply', `answer sent to task ${body.n}`);
      return sendJson(res, 200, { ok: true });
    }

    if (route === 'tasks/create') {
      const known = rooms.get(room);
      if (!known) return sendJson(res, 404, { error: 'unknown room' });
      if (known.tasked) return sendJson(res, 200, { ok: true, duplicate: true });
      const todos = (Array.isArray(body.todos) ? body.todos : [])
        .map((item) => String(item ?? '').trim().slice(0, MAX_TODO_CHARS))
        .filter(Boolean)
        .slice(0, MAX_TODOS);
      if (todos.length === 0) return sendJson(res, 400, { error: 'todos is required' });
      const title = String(body.title ?? '').trim().slice(0, 120) || 'Voice call tasks';
      const transcript = String(body.transcript ?? '').slice(0, MAX_TRANSCRIPT);
      known.tasked = true;
      try {
        const created = await dsh.createTask(taskPrompt(title, todos, transcript), title);
        await board.add({ id: randomUUID(), sessionId: created.sessionId, title, todos, from: known.from, createdAt: Date.now() });
        log('task', `${known.from}: ${todos.length} item(s) -> session ${created.sessionId}`);
        return sendJson(res, 200, { ok: true, ...created, count: todos.length });
      } catch (error) {
        known.tasked = false;
        log('error', `task session failed: ${String(error?.message ?? error)}`);
        return sendJson(res, 500, { error: String(error?.message ?? error) });
      }
    }

    const call = calls.get(room);
    if (route === 'call/end') {
      if (call) {
        calls.delete(room);
        const known = rooms.get(room);
        if (known) known.endedAt = Date.now();
        await dsh.cancel(room).catch(() => undefined);
        dsh.forget(room);
        log('ended', `call ${call.from} ended`);
      }
      return sendJson(res, 200, { ok: true });
    }
    if (!call) return sendJson(res, 404, { error: 'no active call for this room' });
    try {
      if (route === 'send') {
        const text = String(body.text ?? '').trim().slice(0, MAX_PROMPT);
        if (!text) return sendJson(res, 400, { error: 'text is required' });
        const sent = await dsh.send(room, text);
        log('prompt', `call ${call.from}: ${text.slice(0, 80)}`);
        return sendJson(res, 200, { ok: true, ...sent });
      }
      if (route === 'reply') return sendJson(res, 200, await dsh.reply(room));
      if (route === 'cancel') return sendJson(res, 200, await dsh.cancel(room));
    } catch (error) {
      return sendJson(res, 500, { error: String(error?.message ?? error) });
    }
    return sendJson(res, 404, { error: 'unknown route' });
  }

  return { handleApi, refreshBoard: () => board.refresh() };
}
