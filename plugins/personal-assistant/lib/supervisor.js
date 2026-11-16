import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_LOG_LINES = 200;
const RECHECK_MS = 10_000;
const KILL_GRACE_MS = 4_000;
const STABLE_RUN_MS = 60_000;

function psCommand(pid) {
  return new Promise((resolve) => {
    const child = spawn('ps', ['-p', String(pid), '-o', 'command='], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(out.trim()));
  });
}

function killGroup(pid, signal) {
  try { process.kill(-pid, signal); } catch {
    try { process.kill(pid, signal); } catch { /* already gone */ }
  }
}

/** Run a one-off command to completion; resolves with the exit code. */
export function runOnce(cmd, args, options, onLine) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      onLine?.(String(error?.message ?? error));
      return resolve(1);
    }
    const feed = (chunk) => String(chunk).split('\n').forEach((line) => line.trim() && onLine?.(line));
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', (error) => { onLine?.(String(error.message)); resolve(1); });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/**
 * Keep one long-running child process alive: restart with backoff, hold off while
 * `prepare` reports it cannot start yet, and kill the whole process group on stop.
 * `prepare` returns `{ ok, command, args, cwd, env }` or `{ ok: false, reason }`.
 */
export function createService({ name, prepare }) {
  const state = { name, state: 'stopped', reason: '', pid: undefined, restarts: 0, lastExit: undefined, since: Date.now() };
  const logs = [];
  const pidFile = join(tmpdir(), `dsh-livekit-telegram-${name}.pid`);
  let child;
  let timer;
  let stopped = true;
  let failures = 0;
  let secrets = [];

  const set = (next, reason = '') => {
    state.state = next;
    state.reason = reason;
    state.since = Date.now();
  };
  const redact = (line) => secrets.reduce((text, secret) => text.split(secret).join('***'), line);
  const pushLine = (line) => {
    logs.push(`${new Date().toLocaleTimeString()} ${redact(line).slice(0, 400)}`);
    if (logs.length > MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES);
  };

  async function reapStale() {
    let pid;
    try { pid = Number(readFileSync(pidFile, 'utf8')); } catch { return; }
    if (pid > 1) {
      const command = await psCommand(pid);
      if (command.includes('livekit') || command.includes('telegram_gateway') || command.includes('agent.js')) {
        killGroup(pid, 'SIGTERM');
        pushLine(`stopped a leftover process (pid ${pid}) from a previous run`);
      }
    }
    rmSync(pidFile, { force: true });
  }

  const later = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => { void attempt(); }, ms);
  };

  async function attempt() {
    if (stopped) return;
    let plan;
    try {
      plan = await prepare((line) => pushLine(line), (reason) => set('preparing', reason));
    } catch (error) {
      plan = { ok: false, reason: String(error?.message ?? error) };
    }
    if (stopped) return;
    if (!plan.ok) {
      set('blocked', plan.reason);
      return later(RECHECK_MS);
    }
    secrets = (plan.secrets ?? []).filter((value) => typeof value === 'string' && value.length >= 6);
    await reapStale();
    if (stopped) return;
    const startedAt = Date.now();
    try {
      child = spawn(plan.command, plan.args, {
        cwd: plan.cwd, env: plan.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
      });
    } catch (error) {
      set('failed', String(error?.message ?? error));
      return later(RECHECK_MS);
    }
    const mine = child;
    state.pid = mine.pid;
    if (mine.pid) writeFileSync(pidFile, String(mine.pid));
    set('running');
    const feed = (chunk) => String(chunk).split('\n').forEach((line) => line.trim() && pushLine(line));
    mine.stdout.on('data', feed);
    mine.stderr.on('data', feed);
    mine.on('error', (error) => pushLine(`spawn error: ${error.message}`));
    mine.on('close', (code, signal) => {
      if (child === mine) child = undefined;
      state.pid = undefined;
      rmSync(pidFile, { force: true });
      if (stopped) return;
      state.lastExit = signal ? `signal ${signal}` : `code ${code}`;
      failures = Date.now() - startedAt > STABLE_RUN_MS ? 0 : failures + 1;
      state.restarts += 1;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
      set('backoff', `exited with ${state.lastExit}; restarting in ${Math.round(delay / 1000)}s`);
      later(delay);
    });
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    failures = 0;
    void attempt();
  }

  async function stop() {
    stopped = true;
    clearTimeout(timer);
    const running = child;
    child = undefined;
    set('stopped');
    if (!running?.pid) return;
    await new Promise((resolve) => {
      const force = setTimeout(() => { killGroup(running.pid, 'SIGKILL'); }, KILL_GRACE_MS);
      running.once('close', () => { clearTimeout(force); resolve(); });
      killGroup(running.pid, 'SIGTERM');
      setTimeout(resolve, KILL_GRACE_MS + 1500);
    });
    rmSync(pidFile, { force: true });
  }

  return { start, stop, snapshot: () => ({ ...state, logs: logs.slice(-40) }), pushLine };
}

export const fileExists = (path) => existsSync(path);
