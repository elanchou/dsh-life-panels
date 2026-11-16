import { textOfMessage } from './util.js';

const VOICE_PREFIX =
  '[Voice request relayed from a live Telegram call. Reply in short plain sentences suitable for being read aloud. ' +
  'The caller cannot approve tool calls or permission prompts by voice.]\n';

/**
 * Thin wrapper over the Host session services: one DSH session per phone call,
 * prompts are queued as follow-ups and replies are read back from the session log.
 */
export function createDshControl(ctx, getConfig) {
  const bindings = new Map(); // callId -> { sessionId, baseSeq, sentAt }

  async function ensureSession(callId) {
    const existing = bindings.get(callId);
    if (existing) return existing;
    const config = getConfig();
    const request = {};
    if (config.workspacePath) request.cwd = config.workspacePath;
    if (config.agentPreset) request.agentPreset = config.agentPreset;
    const created = await ctx.sessionController.create(request);
    const binding = { sessionId: created.sessionId, baseSeq: -1, sentAt: 0 };
    bindings.set(callId, binding);
    return binding;
  }

  async function lastSeq(sessionId) {
    const inspected = await ctx.sessionController.inspect(sessionId);
    const events = inspected.events;
    return events.length === 0 ? -1 : events[events.length - 1].seq;
  }

  async function send(callId, text) {
    const binding = await ensureSession(callId);
    binding.baseSeq = await lastSeq(binding.sessionId);
    binding.sentAt = Date.now();
    const found = await ctx.sessionController.resolveAgent(binding.sessionId);
    if ('error' in found) throw found.error;
    found.agent.followup({
      content: [{ type: 'text', text: VOICE_PREFIX + text }],
      source: { kind: 'user' },
    });
    return { sessionId: binding.sessionId };
  }

  async function reply(callId) {
    const binding = bindings.get(callId);
    if (!binding) return { state: 'no-session' };
    const inspected = await ctx.sessionController.inspect(binding.sessionId);
    const events = inspected.events.filter((event) => event.seq > binding.baseSeq);
    let open = 0;
    let ended;
    let text = '';
    for (const event of events) {
      if (event.type === 'turn/start') open += 1;
      else if (event.type === 'turn/end') {
        open = Math.max(0, open - 1);
        ended = event.data?.reason?.kind;
      } else if (event.type === 'assistant/message') {
        const value = textOfMessage(event.data?.message);
        if (value) text = value;
      }
    }
    const started = events.some((event) => event.type === 'turn/start');
    if (!started || open > 0) return { state: 'running', sessionId: binding.sessionId };
    if (ended && ended !== 'completed') {
      return { state: 'failed', reason: ended, reply: text, sessionId: binding.sessionId };
    }
    return { state: 'done', reply: text, sessionId: binding.sessionId };
  }

  async function cancel(callId) {
    const binding = bindings.get(callId);
    if (!binding) return { cancelled: false };
    ctx.sessionController.cancel({ sessionId: binding.sessionId });
    return { cancelled: true };
  }

  /** Open a fresh DSH session (not tied to a live call) and hand it a to-do package to carry out. */
  async function createTask(prompt, title) {
    const config = getConfig();
    const request = {};
    if (config.workspacePath) request.cwd = config.workspacePath;
    if (config.agentPreset) request.agentPreset = config.agentPreset;
    const created = await ctx.sessionController.create(request);
    const found = await ctx.sessionController.resolveAgent(created.sessionId);
    if ('error' in found) throw found.error;
    found.agent.followup({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } });
    if (title) {
      try {
        await ctx.sessionController.rename({ sessionId: created.sessionId, title: `${getConfig().assistantName || 'Lucy'} · ${title}` });
      } catch {
        // a missing title must not fail the task
      }
    }
    return { sessionId: created.sessionId };
  }

  async function followup(sessionId, text) {
    const found = await ctx.sessionController.resolveAgent(sessionId);
    if ('error' in found) throw found.error;
    found.agent.followup({ content: [{ type: 'text', text }], source: { kind: 'user' } });
  }

  return {
    followup,
    createTask,
    send,
    reply,
    cancel,
    sessionOf: (callId) => bindings.get(callId)?.sessionId,
    forget: (callId) => bindings.delete(callId),
  };
}
