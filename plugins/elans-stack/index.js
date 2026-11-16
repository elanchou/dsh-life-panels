import { Store, dataFile, registerRoute, registerTool, fetchText, errorText, clip, lanRegistry } from './common.js';
import { classify } from './capture.js';

export const inject = ['tools', 'webServer', 'connection'];

// Host half of elans-stack. The grouping of panels happens in the browser, where the member panels register
// themselves; this half only serves the overview's weather card and remembers the city.
const ROUTE = '/plugin-api/elans-stack';
const WEATHER_TTL = 20 * 60 * 1000;
const FEATURE_ID = /^[\w:-]{1,60}$/;
const MAX_DISABLED = 80;
// The overview tab and the features tab itself stay on, so there is always a way back in.
const PROTECTED = new Set(['elans-overview', 'elans-features']);

export function apply(ctx) {
  const store = new Store(dataFile('elans-stack'), () => ({ version: 1, city: '', location: null, disabled: [] }));
  const cache = new Map(); // "lat,lon" -> { at, value }

  async function geocode(name) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=' + encodeURIComponent(name);
    const { text } = await fetchText(url, { timeoutMs: 8000 });
    const r = JSON.parse(text).results;
    if (!r || !r.length) return null;
    const g = r[0];
    return { name: g.name, country: g.country || '', admin: g.admin1 || '', latitude: g.latitude, longitude: g.longitude, timezone: g.timezone || 'auto' };
  }

  async function weather(loc, refresh) {
    const key = loc.latitude + ',' + loc.longitude;
    const hit = cache.get(key);
    if (!refresh && hit && Date.now() - hit.at < WEATHER_TTL) return hit.value;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude
      + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=auto';
    const { text } = await fetchText(url, { timeoutMs: 10000 });
    const j = JSON.parse(text);
    const c = j.current || {};
    const d = j.daily || {};
    const value = {
      now: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, wind: c.wind_speed_10m, humidity: c.relative_humidity_2m },
      days: (d.time || []).map((date, i) => ({ date, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max[i] })),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** Save one captured line in the panel it belongs to, through that panel's own operation. */
  const TARGET_PLUGIN = { note: 'notes', reminder: 'calendar-reminders', reading: 'reading-list' };
  async function capture(input) {
    const text = clip(String(input.text || '').trim(), 4000);
    if (!text) return { ok: false, error: 'text is required' };
    const c = classify(text);
    if (input.target && TARGET_PLUGIN[input.target] && input.target !== c.target) {
      // The user picked another destination: keep the text whole.
      Object.assign(c, input.target === 'note' ? { target: 'note', body: text } : input.target === 'reading' ? classify('读 ' + text) : classify('提醒 ' + text));
    }
    if (input.preview) return { ok: true, preview: c };
    const plugin = TARGET_PLUGIN[c.target];
    const entry = lanRegistry().runs.get(plugin);
    if (!entry) return { ok: false, error: 'The ' + plugin + ' panel is not installed' };
    const args = c.target === 'note' ? { action: 'add', body: c.body }
      : c.target === 'reading' ? { action: 'add', url: c.url, ...(c.notes ? { notes: c.notes } : {}) }
        : { action: 'add', title: c.title, ...(c.date ? { date: c.date } : {}), ...(c.time ? { time: c.time } : {}), ...(c.repeat ? { repeat: c.repeat } : {}), ...(c.notes ? { notes: c.notes } : {}) };
    if (c.target === 'reading' && !c.url) return { ok: false, error: 'No link found to save for later' };
    const r = await entry.run(args, undefined, { capture: true });
    if (!r || r.ok === false) return { ok: false, error: (r && r.error) || 'save failed' };
    const saved = r.note || r.item || {};
    return { ok: true, target: c.target, plugin, id: saved.id || null, saved: { title: saved.title || c.title || null, date: saved.date || null, time: saved.time || null, repeat: saved.repeat || null, url: saved.url || null }, duplicate: !!r.duplicate };
  }

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'weather';
    if (action === 'capture') return capture(input);
    if (action === 'weather') {
      if (!data.location) return { ok: true, city: data.city || '', location: null, weather: null };
      try { return { ok: true, city: data.city, location: data.location, weather: await weather(data.location, !!input.refresh) }; }
      catch (error) { return { ok: true, city: data.city, location: data.location, weather: null, error: errorText(error) }; }
    }
    if (action === 'settings') return { ok: true, disabled: Array.isArray(data.disabled) ? data.disabled : [] };
    if (action === 'set_disabled') {
      // The full list of hidden features replaces the old one: panel ids, and card:<name> for overview cards.
      const list = Array.isArray(input.disabled) ? input.disabled : null;
      if (!list) return { ok: false, error: 'disabled must be a list of feature ids' };
      const clean = [...new Set(list.map((x) => String(x)).filter((x) => FEATURE_ID.test(x)))].slice(0, MAX_DISABLED);
      if (clean.some((x) => PROTECTED.has(x))) return { ok: false, error: 'This feature cannot be turned off' };
      data.disabled = clean; data.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, disabled: clean };
    }
    if (action === 'set_city') {
      const city = clip(String(input.city || '').trim(), 60);
      if (!city) { data.city = ''; data.location = null; data.updatedAt = new Date().toISOString(); await store.save(); return { ok: true, city: '', location: null, weather: null }; }
      let loc;
      try { loc = await geocode(city); } catch (error) { return { ok: false, error: 'Could not look up the city: ' + errorText(error) }; }
      if (!loc) return { ok: false, error: 'City not found: ' + city };
      data.city = city; data.location = loc; data.updatedAt = new Date().toISOString();
      await store.save();
      try { return { ok: true, city, location: loc, weather: await weather(loc, true) }; } catch (error) { return { ok: true, city, location: loc, weather: null, error: errorText(error) }; }
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'elans-stack');
  registerTool(ctx, {
    name: 'quick_capture',
    description: 'Save one line from Elan into the right panel: a link goes to the reading list, text with a date or time ("明天下午3点 看牙", "周五 交周报", "tomorrow 7pm call mom") becomes a reminder, anything else becomes a note. A leading 记/提醒/读 (note/todo/read) forces the target, or pass target. preview=true only reports where it would go. Returns the target, the saved id and the parsed date and time.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What Elan said, as written.' },
        target: { type: 'string', enum: ['note', 'reminder', 'reading'], description: 'Optional: force the destination.' },
        preview: { type: 'boolean', description: 'Only classify; save nothing.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  }, (input) => capture(input), 'elans-stack');
}
