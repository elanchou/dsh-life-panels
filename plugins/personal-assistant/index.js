import { BASE, createBridge } from './lib/bridge.js';
import { buildSchema, normalizeConfig } from './lib/config.js';
import { createSettingsStore } from './lib/settings.js';
import { createWorkers } from './lib/workers.js';

export const name = 'livekit-telegram-voice';
export const inject = ['webServer', 'credentials', 'sessionController'];
export const Config = await buildSchema();

const BOARD_WATCH_MS = 5000;

export function apply(ctx, rawConfig) {
  // Read through a function so a settings change applies without rebuilding the objects below.
  const store = createSettingsStore(() => normalizeConfig(rawConfig));
  const settings = () => store.get();
  const workers = createWorkers(ctx, settings);
  const bridge = createBridge(ctx, settings, workers, store);

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: `${BASE}/api`,
    handler: async (req, res) => {
      try {
        await bridge.handleApi(req, res);
      } catch {
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{"error":"internal error"}');
      }
    },
  }), 'livekit-telegram-voice: control api');

  // The board is also read by the page, but calls must go out when nobody has it open.
  ctx.effect(() => {
    const timer = setInterval(() => { void bridge.refreshBoard().catch(() => undefined); }, BOARD_WATCH_MS);
    timer.unref?.();
    return () => clearInterval(timer);
  }, 'livekit-telegram-voice: task watcher');

  // Start after the web server route is registered so the workers can reach the API at once.
  // Settings saved on the page are read first, so autoStart reflects them.
  ctx.effect(() => {
    let disposed = false;
    void store.load().then(() => { if (!disposed && settings().autoStart) workers.start(); });
    return () => { disposed = true; return workers.stop(); };
  }, 'livekit-telegram-voice: voice workers');
}
