import { Store, dataFile, registerRoute, registerTool, errorText, lanRegistry } from './common.js';
import { qrPath } from './qr.js';
import { createLanServer, lanAddresses, newKey, DEFAULT_EXCLUDE } from './server.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/lan-host';
const DEFAULT_PORT = 8765;
const PORT_TRIES = 10;

export function apply(ctx) {
  // Per machine and holds the pairing key, so it is deliberately not part of cloud-sync's file list.
  const store = new Store(dataFile('lan-host-local'), () => ({ version: 1, enabled: false, port: DEFAULT_PORT, key: '', hidden: [] }));
  let server = null; // { close, port, devices }
  let lastError = null;

  const cfg = () => ({ enabled: false, port: DEFAULT_PORT, key: '', hidden: [], ...(store.data || {}) });
  const excludeSet = () => new Set([...DEFAULT_EXCLUDE, ...(cfg().hidden || [])]);

  async function stop() {
    const s = server; server = null;
    if (s) await s.close();
  }
  async function start() {
    await stop();
    const c = cfg();
    if (!c.enabled) return;
    if (!c.key) { store.data.key = newKey(); await store.save(); }
    let error = null;
    for (let i = 0; i < PORT_TRIES; i++) {
      const srv = createLanServer({ port: (Number(c.port) || DEFAULT_PORT) + i, key: () => cfg().key, registry: lanRegistry, exclude: () => [...excludeSet()] });
      try {
        const bound = await srv.ready;
        server = { close: srv.close, port: bound, devices: srv.devices };
        lastError = null;
        return;
      } catch (e) {
        error = e;
        if (!e || e.code !== 'EADDRINUSE') break;
      }
    }
    lastError = errorText(error);
  }

  function view() {
    const c = cfg();
    const addrs = lanAddresses();
    const urls = server ? addrs.map((a) => 'http://' + a.address + ':' + server.port + '/?k=' + encodeURIComponent(c.key)) : [];
    const exposed = [];
    for (const e of lanRegistry().runs.values()) exposed.push({ name: e.name, locked: DEFAULT_EXCLUDE.includes(e.name), shown: !excludeSet().has(e.name) });
    exposed.sort((a, b) => a.name.localeCompare(b.name));
    return {
      enabled: !!c.enabled, running: !!server, port: server ? server.port : c.port, error: lastError,
      addresses: addrs, urls, url: urls[0] || null, qr: urls[0] ? qrPath(urls[0]) : null,
      devices: server ? server.devices() : 0, plugins: exposed,
    };
  }

  async function run(input) {
    await store.load();
    const action = input.action || 'status';
    if (action === 'status') return { ok: true, lan: view() };
    if (action === 'enable' || action === 'disable') {
      store.data.enabled = action === 'enable';
      if (store.data.enabled && !store.data.key) store.data.key = newKey();
      if (input.port !== undefined) {
        const port = Math.floor(Number(input.port));
        if (!(port >= 1024 && port <= 65500)) return { ok: false, error: 'port must be between 1024 and 65500' };
        store.data.port = port;
      }
      await store.save();
      await start();
      const out = { ok: !lastError || action === 'disable', lan: view() };
      if (lastError) out.error = lastError;
      return out;
    }
    if (action === 'rotate_key') {
      store.data.key = newKey();
      await store.save();
      return { ok: true, lan: view() };
    }
    if (action === 'plugin') {
      const name = String(input.name || '');
      if (!lanRegistry().runs.has(name)) return { ok: false, error: 'Unknown plugin: ' + name };
      if (DEFAULT_EXCLUDE.includes(name)) return { ok: false, error: name + ' is never available over the LAN' };
      const hidden = new Set(store.data.hidden || []);
      if (input.shown === false) hidden.add(name); else hidden.delete(name);
      store.data.hidden = [...hidden];
      await store.save();
      return { ok: true, lan: view() };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  store.load().then(() => start()).catch((error) => { lastError = errorText(error); });
  ctx.effect(() => () => { stop(); }, 'lan-host: server');
  registerRoute(ctx, ROUTE, run, 'lan-host');
  registerTool(ctx, {
    name: 'lan_host',
    description: 'Serve the life panels (calendar, news, reading list, travel, podcasts, vocabulary, focus, YouTube, TV) to another device on the local network, such as an iPad. Actions: status (running state, URLs, paired devices, which panels are shown); enable (optional port; starts the server and returns the pairing URL); disable; rotate_key (invalidates every paired device); plugin (name, shown=false hides one panel from the LAN). Cloud sync and the iCafe workflow are never exposed. The URL carries a secret key: share it only with your own devices.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'enable', 'disable', 'rotate_key', 'plugin'], description: 'Operation to perform.' },
        port: { type: 'number', description: 'enable: preferred port (default 8765; the next free one is used when taken).' },
        name: { type: 'string', description: 'plugin: panel name such as news-feeds.' },
        shown: { type: 'boolean', description: 'plugin: false hides the panel from LAN devices, true shows it again.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'lan-host');
}
