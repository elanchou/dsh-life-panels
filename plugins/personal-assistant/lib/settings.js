import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULTS, normalizeConfig } from './config.js';
import { SETTINGS_FILE } from './paths.js';

/** Keys whose change needs the voice agent / gateway to restart because they reach the workers as environment. */
const WORKER_KEYS = new Set([
  'assistantName', 'language', 'extraInstructions', 'sttModel', 'llmModel', 'ttsModel', 'ttsVoice', 'agentName',
  'telegramSession', 'nodePath', 'npmPath', 'pythonPath', 'autoStart',
  'livekitUrlEnv', 'livekitApiKeyEnv', 'livekitApiSecretEnv', 'bridgeTokenEnv', 'telegramApiIdEnv', 'telegramApiHashEnv',
]);

/**
 * Settings edited on the page are kept in a file next to the plugin data and override the plugin row's config.
 * Values are always passed through normalizeConfig, so a hand-edited file cannot produce an unsafe setting.
 */
export function createSettingsStore(getBase, file = SETTINGS_FILE) {
  let saved = {};
  let loaded = false;
  let writing = Promise.resolve();

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      if (data && typeof data === 'object' && !Array.isArray(data)) saved = pick(data);
    } catch { /* no file yet */ }
  }

  const pick = (source) => Object.fromEntries(Object.entries(source).filter(([key]) => key in DEFAULTS));
  const effective = () => normalizeConfig({ ...getBase(), ...saved });

  async function persist() {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(saved, null, 2), { mode: 0o600 });
    await rename(temp, file);
  }

  /** Merge a partial update, save, and report which worker-facing keys changed. */
  async function update(patch) {
    await load();
    const before = effective();
    const next = { ...saved, ...pick(patch ?? {}) };
    const previous = saved;
    saved = next;
    const after = effective();
    const restart = [...WORKER_KEYS].some((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    try {
      const run = writing.then(persist);
      writing = run.catch(() => undefined);
      await run;
    } catch (error) {
      saved = previous;
      throw error;
    }
    return { values: after, restart };
  }

  return { load, get: effective, update, defaults: () => normalizeConfig({}) };
}
