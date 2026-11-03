import { Store, dataFile, registerRoute, registerTool, fetchText, clip, errorText, uid, localToday } from './common.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/travel-planner';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS = ['sight', 'food', 'transport', 'hotel', 'activity', 'other'];
const EXPENSE_CATS = ['transport', 'hotel', 'food', 'tickets', 'shopping', 'other'];
const WEATHER_TTL = 3 * 60 * 60 * 1000;

const DEFAULT_PACKING = ['身份证 / 护照', '手机充电器', '充电宝', '换洗衣物', '洗漱用品', '常用药品', '雨伞'];

function isDate(s) { return DATE_RE.test(String(s)) && !Number.isNaN(Date.parse(s)); }
function str(v, n) { return clip(String(v ?? '').trim(), n); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; }

function summarize(trip) {
  const spent = trip.expenses.reduce((a, e) => a + e.amount, 0);
  const packed = trip.packing.filter((p) => p.done).length;
  return {
    id: trip.id, name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate,
    budget: trip.budget, currency: trip.currency, spent: Math.round(spent * 100) / 100,
    stops: trip.itinerary.length, packed, packingTotal: trip.packing.length, location: trip.location || null,
  };
}

export function apply(ctx) {
  const store = new Store(dataFile('travel-planner'), () => ({ version: 1, trips: [] }));
  const weatherCache = new Map();

  async function geocode(name) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=' + encodeURIComponent(name);
    const { text } = await fetchText(url, { timeoutMs: 8000 });
    const r = JSON.parse(text).results;
    if (!r || !r.length) return null;
    const g = r[0];
    return { name: g.name, country: g.country || '', admin: g.admin1 || '', latitude: g.latitude, longitude: g.longitude, timezone: g.timezone || 'auto' };
  }

  async function weather(trip) {
    if (!trip.location) return { available: false, reason: 'Destination could not be located' };
    const key = trip.location.latitude + ',' + trip.location.longitude;
    const hit = weatherCache.get(key);
    if (hit && Date.now() - hit.at < WEATHER_TTL) return hit.value;
    const url = 'https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=16&timezone='
      + encodeURIComponent(trip.location.timezone || 'auto') + '&latitude=' + trip.location.latitude + '&longitude=' + trip.location.longitude;
    try {
      const { text } = await fetchText(url, { timeoutMs: 8000 });
      const d = JSON.parse(text).daily;
      const days = d.time.map((date, i) => ({ date, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max[i] }));
      const value = { available: true, days, source: 'Open-Meteo' };
      weatherCache.set(key, { at: Date.now(), value });
      return value;
    } catch (error) {
      return { available: false, reason: errorText(error) };
    }
  }

  function sortItinerary(trip) {
    trip.itinerary.sort((a, b) => ((a.date || '') + (a.time || '99:99')).localeCompare((b.date || '') + (b.time || '99:99')));
  }

  async function run(input) {
    const data = await store.load();
    const trips = data.trips;
    const action = input.action || 'list_trips';

    if (action === 'list_trips') {
      const today = localToday();
      const list = trips.map(summarize).sort((a, b) => {
        const pa = a.endDate < today ? 1 : 0; const pb = b.endDate < today ? 1 : 0;
        return pa - pb || (pa ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate));
      });
      return { ok: true, trips: list, today };
    }

    if (action === 'create_trip') {
      const destination = str(input.destination, 80);
      if (!destination) return { ok: false, error: 'destination is required' };
      if (!isDate(input.startDate) || !isDate(input.endDate)) return { ok: false, error: 'startDate and endDate must be YYYY-MM-DD' };
      if (input.endDate < input.startDate) return { ok: false, error: 'endDate must not be before startDate' };
      const budget = input.budget === undefined || input.budget === '' ? 0 : num(input.budget);
      if (Number.isNaN(budget) || budget < 0) return { ok: false, error: 'budget must be a non-negative number' };
      let location = null;
      try { location = await geocode(destination); } catch { location = null; }
      const now = new Date().toISOString();
      const trip = {
        id: uid(), name: str(input.name, 80) || destination, destination, startDate: input.startDate, endDate: input.endDate,
        budget, currency: str(input.currency, 8) || 'CNY', notes: str(input.notes, 4000), location,
        itinerary: [], expenses: [],
        packing: (input.packing === false ? [] : DEFAULT_PACKING).map((text) => ({ id: uid(), text, done: false })),
        createdAt: now, updatedAt: now,
      };
      (await store.load()).trips.push(trip); // re-read: cloud sync may have replaced the file during geocoding
      await store.save();
      return { ok: true, trip: summarize(trip), located: !!location };
    }

    const trip = trips.find((tr) => tr.id === input.tripId);
    if (!trip) return { ok: false, error: 'No trip with tripId ' + String(input.tripId) };
    const touch = async (extra) => { trip.updatedAt = new Date().toISOString(); await store.save(); return { ok: true, ...extra }; };

    switch (action) {
      case 'get_trip': {
        const out = { ok: true, trip: { ...trip, summary: summarize(trip) } };
        if (input.includeWeather !== false) out.weather = await weather(trip);
        return out;
      }
      case 'update_trip': {
        if (input.name !== undefined && str(input.name, 80)) trip.name = str(input.name, 80);
        if (input.startDate !== undefined) { if (!isDate(input.startDate)) return { ok: false, error: 'startDate must be YYYY-MM-DD' }; trip.startDate = input.startDate; }
        if (input.endDate !== undefined) { if (!isDate(input.endDate)) return { ok: false, error: 'endDate must be YYYY-MM-DD' }; trip.endDate = input.endDate; }
        if (trip.endDate < trip.startDate) return { ok: false, error: 'endDate must not be before startDate' };
        if (input.budget !== undefined) { const b = num(input.budget); if (Number.isNaN(b) || b < 0) return { ok: false, error: 'budget must be a non-negative number' }; trip.budget = b; }
        if (input.currency !== undefined && str(input.currency, 8)) trip.currency = str(input.currency, 8);
        if (input.notes !== undefined) trip.notes = str(input.notes, 4000);
        if (input.destination !== undefined && str(input.destination, 80) && str(input.destination, 80) !== trip.destination) {
          trip.destination = str(input.destination, 80);
          try { trip.location = await geocode(trip.destination); } catch { trip.location = null; }
        }
        return touch({ trip: summarize(trip) });
      }
      case 'delete_trip': {
        trips.splice(trips.indexOf(trip), 1);
        await store.save();
        return { ok: true, deleted: trip.id };
      }
      case 'add_stop': {
        const title = str(input.title, 160);
        if (!title) return { ok: false, error: 'title is required' };
        const date = input.date || trip.startDate;
        if (!isDate(date)) return { ok: false, error: 'date must be YYYY-MM-DD' };
        if (input.time && !TIME_RE.test(input.time)) return { ok: false, error: 'time must be HH:mm' };
        const cost = input.cost === undefined || input.cost === '' ? 0 : num(input.cost);
        if (Number.isNaN(cost) || cost < 0) return { ok: false, error: 'cost must be a non-negative number' };
        const stop = { id: uid(), date, time: input.time || null, title, place: str(input.place, 160), kind: KINDS.includes(input.kind) ? input.kind : 'sight', notes: str(input.notes, 1000), cost };
        trip.itinerary.push(stop);
        sortItinerary(trip);
        return touch({ stop, outsideTrip: date < trip.startDate || date > trip.endDate });
      }
      case 'update_stop': {
        const stop = trip.itinerary.find((s) => s.id === input.id);
        if (!stop) return { ok: false, error: 'No stop with id ' + String(input.id) };
        if (input.title !== undefined && str(input.title, 160)) stop.title = str(input.title, 160);
        if (input.date !== undefined) { if (!isDate(input.date)) return { ok: false, error: 'date must be YYYY-MM-DD' }; stop.date = input.date; }
        if (input.time !== undefined) { if (input.time && !TIME_RE.test(input.time)) return { ok: false, error: 'time must be HH:mm' }; stop.time = input.time || null; }
        if (input.place !== undefined) stop.place = str(input.place, 160);
        if (input.kind !== undefined && KINDS.includes(input.kind)) stop.kind = input.kind;
        if (input.notes !== undefined) stop.notes = str(input.notes, 1000);
        if (input.cost !== undefined) { const c = num(input.cost); if (Number.isNaN(c) || c < 0) return { ok: false, error: 'cost must be a non-negative number' }; stop.cost = c; }
        sortItinerary(trip);
        return touch({ stop });
      }
      case 'remove_stop': {
        const i = trip.itinerary.findIndex((s) => s.id === input.id);
        if (i < 0) return { ok: false, error: 'No stop with id ' + String(input.id) };
        trip.itinerary.splice(i, 1);
        return touch({ removed: input.id });
      }
      case 'add_expense': {
        const amount = num(input.amount);
        if (Number.isNaN(amount) || amount <= 0) return { ok: false, error: 'amount must be a positive number' };
        const date = input.date || localToday();
        if (!isDate(date)) return { ok: false, error: 'date must be YYYY-MM-DD' };
        const expense = { id: uid(), title: str(input.title, 120) || '—', amount, category: EXPENSE_CATS.includes(input.category) ? input.category : 'other', date };
        trip.expenses.push(expense);
        trip.expenses.sort((a, b) => b.date.localeCompare(a.date));
        return touch({ expense, spent: summarize(trip).spent });
      }
      case 'remove_expense': {
        const i = trip.expenses.findIndex((e) => e.id === input.id);
        if (i < 0) return { ok: false, error: 'No expense with id ' + String(input.id) };
        trip.expenses.splice(i, 1);
        return touch({ removed: input.id });
      }
      case 'add_packing': {
        const texts = (Array.isArray(input.items) ? input.items : [input.title]).map((s) => str(s, 80)).filter(Boolean);
        if (!texts.length) return { ok: false, error: 'Provide title or items' };
        const have = new Set(trip.packing.map((p) => p.text));
        const added = texts.filter((x) => !have.has(x)).map((text) => ({ id: uid(), text, done: false }));
        trip.packing.push(...added);
        return touch({ added });
      }
      case 'toggle_packing': {
        const p = trip.packing.find((x) => x.id === input.id);
        if (!p) return { ok: false, error: 'No packing item with id ' + String(input.id) };
        p.done = input.done === undefined ? !p.done : !!input.done;
        return touch({ item: p });
      }
      case 'remove_packing': {
        const i = trip.packing.findIndex((x) => x.id === input.id);
        if (i < 0) return { ok: false, error: 'No packing item with id ' + String(input.id) };
        trip.packing.splice(i, 1);
        return touch({ removed: input.id });
      }
      default:
        return { ok: false, error: 'Unknown action: ' + String(action) };
    }
  }

  registerRoute(ctx, ROUTE, run, 'travel-planner');
  registerTool(ctx, {
    name: 'travel_planner',
    description: 'Plan trips in the sidebar Travel panel. Actions: list_trips; create_trip (destination, startDate, endDate, optional name, budget, currency, notes; locates the city for weather); get_trip (tripId; itinerary, expenses, packing list and a 16-day Open-Meteo forecast); update_trip; delete_trip; add_stop / update_stop / remove_stop (itinerary entry: date, time HH:mm, title, place, kind sight|food|transport|hotel|activity|other, notes, cost); add_expense (amount, title, category transport|hotel|food|tickets|shopping|other, date) / remove_expense; add_packing (title or items[]) / toggle_packing / remove_packing. Use web_search for attraction research, then add_stop to write the plan. Dates are YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list_trips', 'create_trip', 'get_trip', 'update_trip', 'delete_trip', 'add_stop', 'update_stop', 'remove_stop', 'add_expense', 'remove_expense', 'add_packing', 'toggle_packing', 'remove_packing'], description: 'Operation to perform.' },
        tripId: { type: 'string', description: 'Trip id; required for every action except list_trips and create_trip.' },
        id: { type: 'string', description: 'Stop, expense or packing item id for update/remove/toggle actions.' },
        name: { type: 'string', description: 'Trip display name.' },
        destination: { type: 'string', description: 'Trip destination city or region.' },
        startDate: { type: 'string', description: 'Trip start date, YYYY-MM-DD.' },
        endDate: { type: 'string', description: 'Trip end date, YYYY-MM-DD.' },
        budget: { type: 'number', description: 'Total trip budget.' },
        currency: { type: 'string', description: 'Currency code, default CNY.' },
        notes: { type: 'string', description: 'Trip or stop notes.' },
        date: { type: 'string', description: 'Stop or expense date, YYYY-MM-DD.' },
        time: { type: 'string', description: 'Stop time, HH:mm.' },
        title: { type: 'string', description: 'Stop, expense or packing item title.' },
        place: { type: 'string', description: 'Stop address or place name.' },
        kind: { type: 'string', enum: KINDS, description: 'Stop kind.' },
        cost: { type: 'number', description: 'Estimated stop cost.' },
        amount: { type: 'number', description: 'Expense amount.' },
        category: { type: 'string', enum: EXPENSE_CATS, description: 'Expense category.' },
        items: { type: 'array', items: { type: 'string' }, description: 'add_packing: several items at once.' },
        done: { type: 'boolean', description: 'toggle_packing: explicit packed state.' },
        includeWeather: { type: 'boolean', description: 'get_trip: include the forecast (default true).' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'travel-planner');
}
