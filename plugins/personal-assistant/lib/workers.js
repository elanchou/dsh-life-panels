import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { createService, runOnce } from './supervisor.js';
import { WORKER_DIR, WORKER_SRC, migrateLegacy } from './paths.js';

const WORKER_FILES = ['agent.js', 'package.json', 'telegram_gateway.py', 'requirements.txt'];

/** Workers run from the data directory so installing or upgrading the package never touches their venv, node_modules or login. */
function syncWorkerFiles() {
  migrateLegacy();
  mkdirSync(WORKER_DIR, { recursive: true, mode: 0o700 });
  for (const file of WORKER_FILES) copyFileSync(join(WORKER_SRC, file), join(WORKER_DIR, file));
}
const EXTRA_BIN = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', join(homedir(), '.local', 'bin')];

const exec = (cmd, args) => new Promise((resolve) => {
  execFile(cmd, args, { timeout: 15_000 }, (error, stdout, stderr) => resolve(error ? '' : `${stdout}${stderr}`.trim()));
});

function findBinary(name, override) {
  if (override) return existsSync(override) ? override : undefined;
  const dirs = [...(process.env.PATH ?? '').split(delimiter), ...EXTRA_BIN];
  for (const dir of dirs) {
    const candidate = join(dir, name);
    if (dir && existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function findPython(override) {
  const names = override ? [override] : ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3'];
  for (const name of names) {
    const path = name.includes('/') ? (existsSync(name) ? name : undefined) : findBinary(name);
    if (!path) continue;
    const version = await exec(path, ['-c', 'import sys;print(sys.version_info[0]*100+sys.version_info[1])']);
    if (Number(version) >= 310) return path;
  }
  return undefined;
}

/**
 * Both workers need the same credentials; the plugin resolves them from the DSH credential
 * store at (re)start so a changed secret reaches the next restart without editing any file.
 */
const agentSettings = (c) => ({
  ASSISTANT_NAME: c.assistantName,
  ASSISTANT_LANGUAGE: c.language,
  EXTRA_INSTRUCTIONS: c.extraInstructions,
  STT_MODEL: c.sttModel,
  LLM_MODEL: c.llmModel,
  TTS_MODEL: c.ttsModel,
  TTS_VOICE: c.ttsVoice,
});

export function createWorkers(ctx, getConfig) {
  async function resolveEnv(config) {
    const read = async (ref) => (await ctx.credentials.resolve(ref))?.value;
    const values = {
      LIVEKIT_URL: await read(config.livekitUrlEnv),
      LIVEKIT_API_KEY: await read(config.livekitApiKeyEnv),
      LIVEKIT_API_SECRET: await read(config.livekitApiSecretEnv),
      DSH_VOICE_BRIDGE_TOKEN: await read(config.bridgeTokenEnv),
      TG_API_ID: await read(config.telegramApiIdEnv),
      TG_API_HASH: await read(config.telegramApiHashEnv),
    };
    const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k);
    return { values, missing };
  }

  function baseEnv(values, extra = {}) {
    const path = [...(process.env.PATH ?? '').split(delimiter), ...EXTRA_BIN].filter(Boolean).join(delimiter);
    return {
      ...process.env,
      PATH: path,
      ...values,
      DSH_BASE_URL: ctx.webServer.getOrigin(),
      AGENT_NAME: getConfig().agentName,
      ...agentSettings(getConfig()),
      PYTHONUNBUFFERED: '1',
      ...extra,
    };
  }

  const secretsOf = (values) => Object.entries(values)
    .filter(([key]) => /SECRET|TOKEN|HASH|KEY/.test(key)).map(([, v]) => v);

  const agent = createService({
    name: 'agent',
    async prepare(log, status) {
      syncWorkerFiles();
      const config = getConfig();
      const { values, missing } = await resolveEnv(config);
      const lk = missing.filter((key) => key.startsWith('LIVEKIT') || key === 'DSH_VOICE_BRIDGE_TOKEN');
      if (lk.length) return { ok: false, reason: `missing credentials: ${lk.join(', ')}` };
      const node = findBinary('node', config.nodePath);
      const npm = findBinary('npm', config.npmPath);
      if (!node || !npm) return { ok: false, reason: 'node and npm were not found on PATH (set nodePath / npmPath)' };
      const env = baseEnv(values, { PATH: [dirname(node), ...baseEnv(values).PATH.split(delimiter)].join(delimiter) });
      if (!existsSync(join(WORKER_DIR, 'node_modules', '@livekit', 'agents'))) {
        status('installing agent dependencies');
        const code = await runOnce(npm, ['install', '--no-audit', '--no-fund'], { cwd: WORKER_DIR, env }, log);
        if (code !== 0) return { ok: false, reason: 'npm install failed; see logs' };
      }
      return { ok: true, command: node, args: ['agent.js', 'start'], cwd: WORKER_DIR, env, secrets: secretsOf(values) };
    },
  });

  const gateway = createService({
    name: 'gateway',
    async prepare(log, status) {
      syncWorkerFiles();
      const config = getConfig();
      const { values, missing } = await resolveEnv(config);
      if (missing.length) return { ok: false, reason: `missing credentials: ${missing.join(', ')}` };
      const venvPython = join(WORKER_DIR, '.venv', 'bin', 'python');
      const env = baseEnv(values);
      if (!existsSync(venvPython)) {
        const python = await findPython(config.pythonPath);
        if (!python) return { ok: false, reason: 'Python 3.10 or newer was not found (set pythonPath)' };
        status('creating Python environment');
        if (await runOnce(python, ['-m', 'venv', join(WORKER_DIR, '.venv')], { cwd: WORKER_DIR, env }, log) !== 0) {
          return { ok: false, reason: 'creating the Python venv failed; see logs' };
        }
        status('installing gateway dependencies');
        const pip = await runOnce(venvPython, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt'], { cwd: WORKER_DIR, env }, log);
        if (pip !== 0) return { ok: false, reason: 'pip install failed; see logs' };
      }
      const session = join(WORKER_DIR, `${config.telegramSession}.session`);
      if (!existsSync(session)) {
        return { ok: false, reason: `Telegram login required: run  ${join(WORKER_DIR, '.venv/bin/python')} ${join(WORKER_DIR, 'telegram_gateway.py')} --login  in a terminal` };
      }
      return {
        ok: true, command: venvPython, args: ['telegram_gateway.py'], cwd: WORKER_DIR,
        env: { ...env, TG_SESSION: config.telegramSession }, secrets: secretsOf(values),
      };
    },
  });

  return {
    start() { agent.start(); gateway.start(); },
    /** Apply new settings: stop both workers and start them again when autoStart is on. */
    async restart() {
      await Promise.all([agent.stop(), gateway.stop()]);
      if (getConfig().autoStart) { agent.start(); gateway.start(); }
    },
    stop: () => Promise.all([agent.stop(), gateway.stop()]),
    snapshot: () => ({ agent: agent.snapshot(), gateway: gateway.snapshot() }),
  };
}
