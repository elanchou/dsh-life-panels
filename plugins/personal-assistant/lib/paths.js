import { cpSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh');
/** Everything the plugin writes lives here, so upgrading or reinstalling the package keeps it. */
export const DATA_DIR = join(DSH_HOME, 'personal-assistant');
export const WORKER_SRC = join(PKG_DIR, 'worker');
export const WORKER_DIR = join(DATA_DIR, 'worker');
export const TASKS_FILE = join(DATA_DIR, 'tasks.json');

/** One-off move from the layout used before the data directory existed. */
export function migrateLegacy() {
  mkdirSync(WORKER_DIR, { recursive: true, mode: 0o700 });
  const legacyTasks = join(DSH_HOME, 'livekit-telegram-voice', 'tasks.json');
  if (existsSync(legacyTasks) && !existsSync(TASKS_FILE)) renameSync(legacyTasks, TASKS_FILE);
  if (!existsSync(WORKER_SRC)) return;
  for (const name of readdirSync(WORKER_SRC)) {
    if (/\.session(-journal)?$/.test(name) && !existsSync(join(WORKER_DIR, name))) {
      cpSync(join(WORKER_SRC, name), join(WORKER_DIR, name));
    }
  }
}
export const OUTBOUND_FILE = join(DATA_DIR, 'outbound.json');
export const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
