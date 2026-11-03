window.__ModuleLoader__.load({
  id: '@local/travel-planner',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'travel-planner';
    const NS = 'travelPlanner';
    const call = makeCall('/plugin-api/travel-planner');

    const zh = {
      dateLocale: 'zh-CN', panel: '旅行', title: '旅行计划', back: '全部行程',
      newTrip: '新建行程', destination: '目的地', destPh: '例如：成都、京都', start: '出发', end: '返回', budget: '预算', name: '名称（可选）', create: '创建',
      statUpcoming: '即将出发', statNext: '天后出发', statPlanned: '已规划行程', none: '—',
      days: '{n} 天', inDays: '{n} 天后出发', ongoing: '旅行中 · 第 {n} 天', past: '已结束', today: '今天出发',
      emptyTrips: '还没有行程，先创建一个吧', itinerary: '行程安排', dayN: '第 {n} 天', addStop: '添加', stopPh: '安排一个地点或活动',
      place: '地点', time: '时间', cost: '费用', emptyDay: '这一天还没有安排',
      k_sight: '景点', k_food: '美食', k_transport: '交通', k_hotel: '住宿', k_activity: '活动', k_other: '其他',
      budgetTitle: '预算', spent: '已花 {a}', left: '剩余 {a}', over: '超支 {a}', noBudget: '未设置预算', planned: '行程预估 {a}',
      expensePh: '花在哪里', amount: '金额', addExpense: '记一笔', emptyExpense: '还没有记账',
      c_transport: '交通', c_hotel: '住宿', c_food: '餐饮', c_tickets: '门票', c_shopping: '购物', c_other: '其他',
      packing: '行李清单', packPh: '添加物品', packed: '{a}/{b} 已打包', emptyPack: '清单是空的',
      weather: '天气', weatherNear: '目的地未来天气', weatherNone: '出发前 16 天内可查看行程天气', rain: '降水 {n}%',
      deleteTrip: '删除行程', confirmDelete: '再点一次确认删除', loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      notLocated: '没找到这个地点的坐标，天气不可用', hint: '可以在对话里说“帮我规划成都 3 天行程并写进旅行面板”',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Travel', title: 'Trips', back: 'All trips',
      newTrip: 'New trip', destination: 'Destination', destPh: 'e.g. Chengdu, Kyoto', start: 'Start', end: 'End', budget: 'Budget', name: 'Name (optional)', create: 'Create',
      statUpcoming: 'upcoming', statNext: 'days to next trip', statPlanned: 'trips planned', none: '—',
      days: '{n} days', inDays: 'in {n} days', ongoing: 'Day {n} of the trip', past: 'Finished', today: 'Leaves today',
      emptyTrips: 'No trips yet. Create one to start.', itinerary: 'Itinerary', dayN: 'Day {n}', addStop: 'Add', stopPh: 'Add a place or activity',
      place: 'Place', time: 'Time', cost: 'Cost', emptyDay: 'Nothing planned yet',
      k_sight: 'Sight', k_food: 'Food', k_transport: 'Transport', k_hotel: 'Stay', k_activity: 'Activity', k_other: 'Other',
      budgetTitle: 'Budget', spent: 'Spent {a}', left: '{a} left', over: '{a} over', noBudget: 'No budget set', planned: 'Planned {a}',
      expensePh: 'What for', amount: 'Amount', addExpense: 'Add', emptyExpense: 'No expenses yet',
      c_transport: 'Transport', c_hotel: 'Stay', c_food: 'Food', c_tickets: 'Tickets', c_shopping: 'Shopping', c_other: 'Other',
      packing: 'Packing list', packPh: 'Add an item', packed: '{a}/{b} packed', emptyPack: 'The list is empty',
      weather: 'Weather', weatherNear: 'Forecast at destination', weatherNone: 'Trip weather appears within 16 days of departure', rain: '{n}% rain',
      deleteTrip: 'Delete trip', confirmDelete: 'Click again to delete', loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      notLocated: 'Could not locate this destination; weather is unavailable', hint: 'Ask in chat: “Plan 3 days in Chengdu and add it to my Travel panel”',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
    };
    const KINDS = ['sight', 'food', 'transport', 'hotel', 'activity', 'other'];
    const KIND_ICON = { sight: 'pin', food: 'sparkle', transport: 'plane', hotel: 'luggage', activity: 'sun', other: 'note' };
    const CATS = ['transport', 'hotel', 'food', 'tickets', 'shopping', 'other'];
    const CAT_COLOR = { transport: BRAND, hotel: OK, food: WARN, tickets: ERR, shopping: IDLE, other: '--dsw-alias-border-l2' };

    function wx(code) {
      if (code === 0) return '☀️';
      if (code <= 2) return '🌤️';
      if (code === 3) return '☁️';
      if (code <= 48) return '🌫️';
      if (code <= 67 || (code >= 80 && code <= 82)) return '🌧️';
      if (code <= 77 || code === 85 || code === 86) return '🌨️';
      return '⛈️';
    }
    function money(n, cur, locale) {
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'CNY', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
      catch { return (cur || '') + ' ' + n; }
    }
    function tripDays(trip) {
      const out = [];
      const n = dayDiff(trip.endDate, trip.startDate);
      for (let i = 0; i <= n && i < 60; i += 1) { const d = parseYmd(trip.startDate); d.setDate(d.getDate() + i); out.push(ymd(d)); }
      return out;
    }
    function countdown(trip, t) {
      const today = todayStr();
      if (trip.endDate < today) return { text: t('past'), tone: '' };
      if (trip.startDate > today) return { text: t('inDays', { n: dayDiff(trip.startDate, today) }), tone: 'tone-brand' };
      if (trip.startDate === today) return { text: t('today'), tone: 'tone-warn' };
      return { text: t('ongoing', { n: dayDiff(today, trip.startDate) + 1 }), tone: 'tone-success' };
    }
    const hueOf = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);

    function TripCard(props) {
      const { trip, t, onOpen } = props;
      const cd = countdown(trip, t);
      const loc = safeLocale(t);
      const pct = trip.budget ? Math.min(100, Math.round((trip.spent / trip.budget) * 100)) : 0;
      return h('button', { type: 'button', className: 'tp-trip' + (cd.tone ? '' : ' is-past'), onClick: () => onOpen(trip.id), style: { '--tp-hue': hueOf(trip.destination) } },
        h('div', { className: 'tp-trip-cover' },
          h('span', { className: 'tp-trip-dest' }, trip.destination),
          h('span', { className: 'lp-pill tp-trip-cd ' + cd.tone }, cd.text)),
        h('div', { className: 'tp-trip-body' },
          h('div', { className: 'tp-trip-name' }, trip.name),
          h('div', { className: 'tp-trip-meta' }, h(Icon, { name: 'calendar', size: 13 }),
            fmtDate(trip.startDate, loc, { month: 'short', day: 'numeric' }) + ' – ' + fmtDate(trip.endDate, loc, { month: 'short', day: 'numeric' }),
            h('span', { className: 'lp-muted' }, '· ' + t('days', { n: dayDiff(trip.endDate, trip.startDate) + 1 }))),
          h('div', { className: 'tp-trip-row' },
            h('span', null, h(Icon, { name: 'pin', size: 13 }), trip.stops),
            h('span', null, h(Icon, { name: 'luggage', size: 13 }), trip.packed + '/' + trip.packingTotal),
            h('span', null, h(Icon, { name: 'wallet', size: 13 }), trip.budget ? money(trip.spent, trip.currency, loc) + ' / ' + money(trip.budget, trip.currency, loc) : money(trip.spent, trip.currency, loc))),
          trip.budget ? h('div', { className: 'lp-progress' + (trip.spent > trip.budget ? ' tone-error' : '') }, h('i', { style: { width: pct + '%' } })) : null));
    }

    function NewTrip(props) {
      const { t, onCreate, busy } = props;
      const [dest, setDest] = useState('');
      const [start, setStart] = useState(todayStr());
      const [end, setEnd] = useState(todayStr());
      const [budget, setBudget] = useState('');
      const submit = async (e) => {
        e.preventDefault();
        if (!dest.trim()) return;
        const ok = await onCreate({ action: 'create_trip', destination: dest.trim(), startDate: start, endDate: end < start ? start : end, budget: budget ? Number(budget) : 0 });
        if (ok) { setDest(''); setBudget(''); }
      };
      return h('form', { className: 'lp-bar tp-new', onSubmit: submit },
        h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'plane', size: 18 })),
        h('input', { className: 'lp-bar-input', value: dest, onChange: (e) => setDest(e.target.value), placeholder: t('destPh'), 'aria-label': t('destination') }),
        h('label', { className: 'lp-field' }, t('start'), h('input', { type: 'date', value: start, onChange: (e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); } })),
        h('label', { className: 'lp-field' }, t('end'), h('input', { type: 'date', value: end, min: start, onChange: (e) => setEnd(e.target.value) })),
        h('label', { className: 'lp-field' }, h(Icon, { name: 'wallet', size: 14 }), h('input', { type: 'number', min: 0, step: 100, value: budget, onChange: (e) => setBudget(e.target.value), placeholder: t('budget'), style: { width: 76 } })),
        h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !dest.trim() }, h(Icon, { name: 'plus', size: 14 }), t('create')));
    }

    function DayBlock(props) {
      const { t, trip, date, index, stops, wxDay, act } = props;
      const [title, setTitle] = useState('');
      const [time, setTime] = useState('');
      const [kind, setKind] = useState('sight');
      const [cost, setCost] = useState('');
      const loc = safeLocale(t);
      const add = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const ok = await act({ action: 'add_stop', tripId: trip.id, date, time: time || undefined, title: title.trim(), kind, cost: cost ? Number(cost) : 0 });
        if (ok) { setTitle(''); setTime(''); setCost(''); }
      };
      return h('section', { className: 'tp-day' + (date === todayStr() ? ' is-today' : '') },
        h('div', { className: 'tp-day-head' },
          h('span', { className: 'tp-day-n' }, t('dayN', { n: index + 1 })),
          h('span', { className: 'tp-day-date' }, fmtDate(date, loc, { month: 'long', day: 'numeric', weekday: 'short' })),
          wxDay ? h('span', { className: 'tp-day-wx', title: t('rain', { n: wxDay.rain }) }, wx(wxDay.code) + ' ' + Math.round(wxDay.min) + '° / ' + Math.round(wxDay.max) + '°') : null),
        h('ol', { className: 'tp-stops' },
          stops.length ? stops.map((s) => h('li', { key: s.id, className: 'tp-stop k-' + s.kind },
            h('span', { className: 'tp-stop-dot' }, h(Icon, { name: KIND_ICON[s.kind] || 'pin', size: 13 })),
            h('div', { className: 'tp-stop-body' },
              h('div', { className: 'tp-stop-title' }, s.time ? h('span', { className: 'tp-stop-time' }, s.time) : null, s.title),
              h('div', { className: 'tp-stop-meta' },
                h('span', { className: 'lp-pill' }, t('k_' + s.kind)),
                s.place ? h('span', null, s.place) : null,
                s.cost ? h('span', null, money(s.cost, trip.currency, loc)) : null),
              s.notes ? h('div', { className: 'tp-stop-notes' }, s.notes) : null),
            h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger tp-del', 'aria-label': 'delete', onClick: () => act({ action: 'remove_stop', tripId: trip.id, id: s.id }) }, h(Icon, { name: 'trash', size: 13 }))))
            : h('li', { className: 'tp-stop-empty' }, t('emptyDay'))),
        h('form', { className: 'tp-stop-add', onSubmit: add },
          h('input', { className: 'tp-inline', value: title, onChange: (e) => setTitle(e.target.value), placeholder: t('stopPh'), 'aria-label': t('stopPh') }),
          h('input', { className: 'tp-inline tp-inline-sm', type: 'time', value: time, onChange: (e) => setTime(e.target.value), 'aria-label': t('time') }),
          h('select', { className: 'tp-inline tp-inline-sm', value: kind, onChange: (e) => setKind(e.target.value), 'aria-label': 'kind' }, KINDS.map((k) => h('option', { key: k, value: k }, t('k_' + k)))),
          h('input', { className: 'tp-inline tp-inline-sm', type: 'number', min: 0, value: cost, onChange: (e) => setCost(e.target.value), placeholder: t('cost'), 'aria-label': t('cost') }),
          h('button', { type: 'submit', className: 'lp-round lp-round-sm is-on', disabled: !title.trim(), 'aria-label': t('addStop') }, h(Icon, { name: 'plus', size: 15 }))));
    }

    function Budget(props) {
      const { t, trip, act } = props;
      const [title, setTitle] = useState('');
      const [amount, setAmount] = useState('');
      const [cat, setCat] = useState('food');
      const loc = safeLocale(t);
      const spent = trip.expenses.reduce((a, e) => a + e.amount, 0);
      const planned = trip.itinerary.reduce((a, s) => a + (s.cost || 0), 0);
      const byCat = CATS.map((c) => ({ c, v: trip.expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.v > 0);
      const total = Math.max(trip.budget || 0, spent) || 1;
      const add = async (e) => {
        e.preventDefault();
        const n = Number(amount);
        if (!(n > 0)) return;
        if (await act({ action: 'add_expense', tripId: trip.id, amount: n, title: title.trim(), category: cat })) { setTitle(''); setAmount(''); }
      };
      return h('section', { className: 'lp-card' },
        h('div', { className: 'lp-card-head' }, h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'wallet', className: 'lp-ico' }), t('budgetTitle')),
          h('span', { className: 'tp-big' }, money(spent, trip.currency, loc), trip.budget ? h('small', null, ' / ' + money(trip.budget, trip.currency, loc)) : null)),
        h('div', { className: 'tp-stack' }, byCat.map((x) => h('i', { key: x.c, title: t('c_' + x.c) + ' ' + money(x.v, trip.currency, loc), style: { width: (x.v / total) * 100 + '%', background: 'var(' + CAT_COLOR[x.c] + ')' } }))),
        h('div', { className: 'tp-budget-line' },
          trip.budget ? (spent > trip.budget ? h('span', { className: 'lp-pill tone-error' }, t('over', { a: money(spent - trip.budget, trip.currency, loc) }))
            : h('span', { className: 'lp-pill tone-success' }, t('left', { a: money(trip.budget - spent, trip.currency, loc) }))) : h('span', { className: 'lp-muted' }, t('noBudget')),
          planned ? h('span', { className: 'lp-muted' }, t('planned', { a: money(planned, trip.currency, loc) })) : null),
        byCat.length ? h('div', { className: 'tp-legend' }, byCat.map((x) => h('span', { key: x.c }, h('i', { style: { background: 'var(' + CAT_COLOR[x.c] + ')' } }), t('c_' + x.c), ' ', money(x.v, trip.currency, loc)))) : null,
        h('form', { className: 'tp-exp-add', onSubmit: add },
          h('select', { className: 'lp-select', value: cat, onChange: (e) => setCat(e.target.value), 'aria-label': 'category' }, CATS.map((c) => h('option', { key: c, value: c }, t('c_' + c)))),
          h('input', { className: 'lp-input', value: title, onChange: (e) => setTitle(e.target.value), placeholder: t('expensePh') }),
          h('input', { className: 'lp-input', type: 'number', min: 0, step: '0.01', value: amount, onChange: (e) => setAmount(e.target.value), placeholder: t('amount') }),
          h('button', { type: 'submit', className: 'lp-primary', disabled: !(Number(amount) > 0) }, t('addExpense'))),
        trip.expenses.length ? h('ul', { className: 'tp-exps' }, trip.expenses.slice(0, 30).map((e) => h('li', { key: e.id },
          h('i', { style: { background: 'var(' + CAT_COLOR[e.category] + ')' } }),
          h('span', { className: 'tp-exp-title' }, e.title === '—' ? t('c_' + e.category) : e.title),
          h('span', { className: 'lp-muted' }, fmtDate(e.date, loc, { month: 'numeric', day: 'numeric' })),
          h('span', { className: 'tp-exp-amt' }, money(e.amount, trip.currency, loc)),
          h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger tp-del', 'aria-label': 'delete', onClick: () => act({ action: 'remove_expense', tripId: trip.id, id: e.id }) }, h(Icon, { name: 'x', size: 12 })))))
          : h('div', { className: 'lp-muted tp-none' }, t('emptyExpense')));
    }

    function Packing(props) {
      const { t, trip, act } = props;
      const [text, setText] = useState('');
      const done = trip.packing.filter((p) => p.done).length;
      const add = async (e) => {
        e.preventDefault();
        if (text.trim() && await act({ action: 'add_packing', tripId: trip.id, title: text.trim() })) setText('');
      };
      return h('section', { className: 'lp-card' },
        h('div', { className: 'lp-card-head' }, h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'luggage', className: 'lp-ico' }), t('packing')),
          h('span', { className: 'lp-pill' + (trip.packing.length && done === trip.packing.length ? ' tone-success' : '') }, t('packed', { a: done, b: trip.packing.length }))),
        trip.packing.length ? h('div', { className: 'lp-progress tone-success', style: { marginBottom: 10 } }, h('i', { style: { width: (done / trip.packing.length) * 100 + '%' } })) : null,
        h('ul', { className: 'tp-pack' }, trip.packing.map((p) => h('li', { key: p.id, className: p.done ? 'is-done' : '' },
          h('button', { type: 'button', role: 'checkbox', 'aria-checked': p.done, className: 'tp-check', onClick: () => act({ action: 'toggle_packing', tripId: trip.id, id: p.id }) }, h(Icon, { name: 'check', size: 12, stroke: 2.4 })),
          h('span', null, p.text),
          h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger tp-del', 'aria-label': 'delete', onClick: () => act({ action: 'remove_packing', tripId: trip.id, id: p.id }) }, h(Icon, { name: 'x', size: 12 }))))),
        !trip.packing.length ? h('div', { className: 'lp-muted tp-none' }, t('emptyPack')) : null,
        h('form', { className: 'tp-pack-add', onSubmit: add },
          h('input', { className: 'lp-input', value: text, onChange: (e) => setText(e.target.value), placeholder: t('packPh') }),
          h('button', { type: 'submit', className: 'lp-ghost', disabled: !text.trim() }, h(Icon, { name: 'plus', size: 14 }))));
    }

    function TripView(props) {
      const { t, id, onBack, onChanged } = props;
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [confirm, setConfirm] = useState(false);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'get_trip', tripId: id }); setData(r); setError(null); }
        catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [id, t]);
      useEffect(() => { load(); }, [load]);
      const act = async (body) => {
        try {
          await call(body);
          const r = await call({ action: 'get_trip', tripId: id });
          setData(r); onChanged(); return true;
        } catch (e) { setError(t('saveFailed', { error: e.message })); return false; }
      };
      if (!data) return error ? h(ErrorBar, { error, onRetry: load, retryLabel: t('retry') }) : h('div', { className: 'lp-loading' }, '…');
      const trip = data.trip;
      const loc = safeLocale(t);
      const cd = countdown(trip, t);
      const days = tripDays(trip);
      const wxByDate = {};
      const wxDays = (data.weather && data.weather.available && data.weather.days) || [];
      for (const d of wxDays) wxByDate[d.date] = d;
      const outside = trip.itinerary.filter((s) => s.date < trip.startDate || s.date > trip.endDate);
      const tripWx = days.map((d) => wxByDate[d]).filter(Boolean);
      const showWx = tripWx.length ? tripWx : wxDays.slice(0, 7);
      const del = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try { await call({ action: 'delete_trip', tripId: id }); onChanged(); onBack(); } catch (e) { setError(t('saveFailed', { error: e.message })); }
      };
      const place = trip.location ? [trip.location.admin, trip.location.country].filter(Boolean).join(' · ') : '';
      return h(React.Fragment, null,
        h('div', { className: 'tp-banner', style: { '--tp-hue': hueOf(trip.destination) } },
          h('button', { type: 'button', className: 'lp-ghost tp-back', onClick: onBack }, h(Icon, { name: 'left', size: 14 }), t('back')),
          h('div', { className: 'tp-banner-main' },
            h('span', { className: 'lp-pill ' + (cd.tone || '') }, cd.text),
            h('h1', { className: 'tp-banner-title' }, trip.name),
            h('div', { className: 'tp-banner-meta' },
              h('span', null, h(Icon, { name: 'pin', size: 14 }), trip.destination + (place ? ' · ' + place : '')),
              h('span', null, h(Icon, { name: 'calendar', size: 14 }), fmtDate(trip.startDate, loc, { month: 'long', day: 'numeric' }) + ' – ' + fmtDate(trip.endDate, loc, { month: 'long', day: 'numeric' }) + ' · ' + t('days', { n: days.length })))),
          h('button', { type: 'button', className: 'lp-ghost tp-del-trip' + (confirm ? ' is-confirm' : ''), onClick: del }, h(Icon, { name: 'trash', size: 14 }), confirm ? t('confirmDelete') : t('deleteTrip'))),
        h(ErrorBar, { error, onClose: () => setError(null) }),
        h('section', { className: 'lp-card tp-wx' },
          h('div', { className: 'lp-card-head' }, h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'sun', className: 'lp-ico' }), tripWx.length ? t('weather') : t('weatherNear')),
            !tripWx.length && trip.location ? h('span', { className: 'lp-muted', style: { fontSize: 12 } }, t('weatherNone')) : null),
          !trip.location ? h('div', { className: 'lp-muted' }, t('notLocated'))
            : !showWx.length ? h('div', { className: 'lp-muted' }, (data.weather && data.weather.reason) || '—')
              : h('div', { className: 'tp-wx-row' }, showWx.map((d) => h('div', { key: d.date, className: 'tp-wx-day' + (d.date === todayStr() ? ' is-today' : '') },
                h('span', { className: 'tp-wx-date' }, fmtDate(d.date, loc, { month: 'numeric', day: 'numeric', weekday: 'short' })),
                h('span', { className: 'tp-wx-icon' }, wx(d.code)),
                h('span', { className: 'tp-wx-temp' }, Math.round(d.max) + '°', h('small', null, ' ' + Math.round(d.min) + '°')),
                h('span', { className: 'tp-wx-rain' }, '💧' + d.rain + '%'))))),
        h('div', { className: 'tp-cols' },
          h('section', { className: 'lp-card tp-itin' },
            h('div', { className: 'lp-card-head' }, h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'pin', className: 'lp-ico' }), t('itinerary')),
              h('span', { className: 'lp-pill' }, trip.itinerary.length)),
            days.map((d, i) => h(DayBlock, { key: d, t, trip, date: d, index: i, stops: trip.itinerary.filter((s) => s.date === d), wxDay: wxByDate[d], act })),
            outside.length ? h('section', { className: 'tp-day' }, h('div', { className: 'tp-day-head' }, h('span', { className: 'tp-day-n' }, '?'), h('span', { className: 'tp-day-date' }, outside.length + ' ·')),
              h('ol', { className: 'tp-stops' }, outside.map((s) => h('li', { key: s.id, className: 'tp-stop' }, h('span', { className: 'tp-stop-dot' }, h(Icon, { name: 'alert', size: 13 })),
                h('div', { className: 'tp-stop-body' }, h('div', { className: 'tp-stop-title' }, s.date + ' ' + s.title)),
                h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger tp-del', 'aria-label': 'delete', onClick: () => act({ action: 'remove_stop', tripId: trip.id, id: s.id }) }, h(Icon, { name: 'trash', size: 13 })))))) : null),
          h('div', { className: 'tp-side' }, h(Budget, { t, trip, act }), h(Packing, { t, trip, act }))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [list, setList] = useState(null);
      const [error, setError] = useState(null);
      const [openId, setOpenId] = useState(null);
      const [busy, setBusy] = useState(false);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'list_trips' }); setList(r.trips); setError(null); }
        catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id); }, [load]);
      const onCreate = async (body) => {
        setBusy(true);
        try { const r = await call(body); await load(); setOpenId(r.trip.id); return true; }
        catch (e) { setError(t('saveFailed', { error: e.message })); return false; }
        finally { setBusy(false); }
      };
      const today = todayStr();
      const trips = list || [];
      const upcoming = trips.filter((x) => x.endDate >= today);
      const past = trips.filter((x) => x.endDate < today);
      const next = upcoming.filter((x) => x.startDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      const nowLong = new Date().toLocaleDateString(safeLocale(t), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      return h('div', { className: 'lp-root' },
        h('style', null, KIT_CSS + CSS),
        h('div', { className: 'lp-inner' },
          openId ? h(TripView, { key: openId, t, id: openId, onBack: () => setOpenId(null), onChanged: load })
            : h(React.Fragment, null,
              h('header', { className: 'lp-hero' },
                h('div', null, h('span', { className: 'lp-eyebrow' }, nowLong), h('h1', { className: 'lp-title' }, t('title'))),
                h('div', { className: 'lp-stats' },
                  h(Stat, { icon: 'plane', value: upcoming.length, label: t('statUpcoming'), tone: 'tone-brand' }),
                  h(Stat, { icon: 'calendar', value: next ? dayDiff(next.startDate, today) : t('none'), label: t('statNext'), tone: 'tone-warn' }),
                  h(Stat, { icon: 'pin', value: trips.reduce((a, x) => a + x.stops, 0), label: t('statPlanned'), tone: 'tone-success' }))),
              h(ErrorBar, { error, onRetry: load, retryLabel: t('retry') }),
              h(NewTrip, { t, onCreate, busy }),
              !list && !error ? h('div', { className: 'tp-grid' }, [0, 1, 2].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 210, borderRadius: 18 } })))
                : !trips.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'plane', text: t('emptyTrips') }))
                  : h(React.Fragment, null,
                    upcoming.length ? h('div', { className: 'tp-grid' }, upcoming.map((x) => h(TripCard, { key: x.id, trip: x, t, onOpen: setOpenId }))) : null,
                    past.length ? h('h2', { className: 'tp-section' }, t('past')) : null,
                    past.length ? h('div', { className: 'tp-grid' }, past.map((x) => h(TripCard, { key: x.id, trip: x, t, onOpen: setOpenId }))) : null),
              h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint')))));
    }

    const COVER = 'linear-gradient(135deg,hsl(var(--tp-hue) 72% 58%),hsl(calc(var(--tp-hue) + 45) 70% 42%))';
    const CSS = [
      '.tp-new{margin-bottom:18px;flex-wrap:wrap}',
      '.tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}',
      '.tp-section{margin:26px 0 12px;font-size:13px;font-weight:600;color:' + FG2 + '}',
      '.tp-trip{display:flex;flex-direction:column;padding:0;border-radius:18px;overflow:hidden;border:1px solid ' + B1 + ';background:' + L1 + ';color:inherit;text-align:left;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}',
      '.tp-trip:hover{transform:translateY(-2px);border-color:' + B2 + ';box-shadow:0 10px 26px ' + tint('--dsw-alias-label-primary', 10) + '}',
      '.tp-trip.is-past{opacity:.7}',
      '.tp-trip-cover{position:relative;height:92px;padding:14px 16px;display:flex;align-items:flex-end;background:' + COVER + '}',
      '.tp-trip-cover::after{content:"";position:absolute;right:-18px;top:-26px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.14)}',
      '.tp-trip-dest{position:relative;z-index:1;font-size:22px;font-weight:700;color:#fff;letter-spacing:.01em;text-shadow:0 1px 6px rgba(0,0,0,.18)}',
      '.tp-trip-cd{position:absolute;z-index:1;top:12px;left:14px;background:rgba(255,255,255,.9)!important}',
      '.tp-trip-body{padding:12px 16px 16px;display:flex;flex-direction:column;gap:7px}',
      '.tp-trip-name{font-size:14px;font-weight:650}',
      '.tp-trip-meta,.tp-trip-row{display:flex;align-items:center;gap:6px;font-size:12px;color:' + FG2 + ';flex-wrap:wrap}',
      '.tp-trip-row{gap:14px}',
      '.tp-trip-row span{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}',
      '.tp-banner{position:relative;display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;padding:18px 20px 20px;margin-bottom:16px;border-radius:20px;background:' + COVER + ';color:#fff;overflow:hidden}',
      '.tp-banner::after{content:"";position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.12)}',
      '.tp-banner .lp-ghost{position:relative;z-index:1;border-color:rgba(255,255,255,.45);color:#fff;background:rgba(255,255,255,.12)}',
      '.tp-banner .lp-ghost:hover{background:rgba(255,255,255,.24)}',
      '.tp-back{position:absolute!important;top:14px;left:16px}',
      '.tp-banner-main{position:relative;z-index:1;flex:1;min-width:240px;padding-top:44px;display:flex;flex-direction:column;align-items:flex-start;gap:6px}',
      '.tp-banner-main .lp-pill{background:rgba(255,255,255,.9)}',
      '.tp-banner-title{margin:0;font-size:28px;line-height:36px;font-weight:700;text-shadow:0 1px 8px rgba(0,0,0,.18)}',
      '.tp-banner-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;opacity:.95}',
      '.tp-banner-meta span{display:inline-flex;align-items:center;gap:5px}',
      '.tp-trip-cd:not([class*=tone-]),.tp-banner-main .lp-pill:not([class*=tone-]){color:#495057}',
      '.tp-del-trip.is-confirm{background:rgba(255,255,255,.95)!important;color:var(' + ERR + ')!important}',
      '.tp-wx{margin-bottom:16px}',
      '.tp-wx-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}',
      '.tp-wx-day{flex:1 0 86px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 6px;border-radius:14px;background:' + L2 + '}',
      '.tp-wx-day.is-today{box-shadow:inset 0 0 0 1.5px var(' + BRAND + ')}',
      '.tp-wx-date{font-size:11.5px;color:' + FG2 + ';white-space:nowrap}',
      '.tp-wx-icon{font-size:24px;line-height:30px}',
      '.tp-wx-temp{font-size:14px;font-weight:650;font-variant-numeric:tabular-nums}',
      '.tp-wx-temp small{font-weight:400;color:' + FG2 + '}',
      '.tp-wx-rain{font-size:11px;color:' + FG2 + '}',
      '.tp-cols{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}',
      '@media (max-width:960px){.tp-cols{grid-template-columns:1fr}}',
      '.tp-side{display:flex;flex-direction:column;gap:16px}',
      '.tp-day{padding:12px 0 6px;border-top:1px solid ' + B1 + '}',
      '.tp-day:first-of-type{border-top:0;padding-top:0}',
      '.tp-day-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}',
      '.tp-day-n{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:650;color:var(' + BRAND + ');background:' + tint(BRAND, 12) + '}',
      '.tp-day.is-today .tp-day-n{color:#fff;background:var(' + BRAND + ')}',
      '.tp-day-date{font-size:13px;font-weight:600}',
      '.tp-day-wx{margin-left:auto;font-size:12px;color:' + FG2 + ';font-variant-numeric:tabular-nums}',
      '.tp-stops{list-style:none;margin:0;padding:0 0 0 10px;position:relative}',
      '.tp-stops::before{content:"";position:absolute;left:21px;top:6px;bottom:6px;width:1.5px;background:' + B1 + '}',
      '.tp-stop{position:relative;display:flex;align-items:flex-start;gap:12px;padding:6px 6px 6px 0;border-radius:10px}',
      '.tp-stop-dot{position:relative;z-index:1;flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:' + L1 + ';border:1.5px solid var(' + BRAND + ');color:var(' + BRAND + ')}',
      '.tp-stop.k-food .tp-stop-dot{border-color:var(' + WARN + ');color:var(' + WARN + ')}',
      '.tp-stop.k-transport .tp-stop-dot{border-color:var(' + IDLE + ');color:var(' + IDLE + ')}',
      '.tp-stop.k-hotel .tp-stop-dot{border-color:var(' + OK + ');color:var(' + OK + ')}',
      '.tp-stop.k-activity .tp-stop-dot{border-color:var(' + ERR + ');color:var(' + ERR + ')}',
      '.tp-stop-body{flex:1;min-width:0;padding-top:2px}',
      '.tp-stop-title{font-size:13.5px;line-height:20px;font-weight:500;overflow-wrap:anywhere}',
      '.tp-stop-time{margin-right:8px;font-variant-numeric:tabular-nums;color:var(' + BRAND + ');font-weight:650}',
      '.tp-stop-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:2px;font-size:11.5px;color:' + FG2 + '}',
      '.tp-stop-notes{margin-top:3px;font-size:12px;line-height:18px;color:' + FG2 + '}',
      '.tp-stop-empty{padding:4px 0 4px 36px;font-size:12px;color:' + FG2 + '}',
      '.tp-del{opacity:0;transition:opacity .12s}',
      '.tp-stop:hover .tp-del,.tp-exps li:hover .tp-del,.tp-pack li:hover .tp-del,.tp-del:focus-visible{opacity:1}',
      '@media (hover:none){.tp-del{opacity:1}}',
      '.tp-stop-add{display:flex;align-items:center;gap:6px;margin:6px 0 4px 46px;padding:4px 4px 4px 10px;border-radius:10px;border:1px dashed ' + B2 + '}',
      '.tp-stop-add:focus-within{border-style:solid;border-color:var(' + BRAND + ')}',
      '.tp-inline{flex:1;min-width:0;height:28px;border:0;outline:0;background:transparent;color:' + FG + ';font-size:12.5px;color-scheme:light dark}',
      '.tp-inline::placeholder{color:' + FG2 + '}',
      '.tp-inline-sm{flex:0 0 auto;width:84px;padding:0 6px;border-radius:7px;background:' + L2 + '}',
      '@media (max-width:640px){.tp-stop-add{flex-wrap:wrap;margin-left:0}.tp-inline{flex-basis:100%}}',
      '.tp-big{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.tp-big small{font-size:12px;font-weight:500;color:' + FG2 + '}',
      '.tp-stack{display:flex;height:10px;border-radius:999px;overflow:hidden;background:' + L2 + ';margin-bottom:10px}',
      '.tp-stack i{display:block;height:100%}',
      '.tp-budget-line{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:8px}',
      '.tp-legend{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11.5px;color:' + FG2 + ';margin-bottom:12px}',
      '.tp-legend span{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}',
      '.tp-legend i,.tp-exps i{display:inline-block;width:8px;height:8px;border-radius:3px;flex:none}',
      '.tp-exp-add{display:grid;grid-template-columns:84px 1fr 84px auto;gap:6px;margin-bottom:10px}',
      '.tp-exps,.tp-pack{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}',
      '.tp-exps li{display:flex;align-items:center;gap:8px;padding:5px 4px 5px 6px;border-radius:9px;font-size:12.5px}',
      '.tp-exps li:hover,.tp-pack li:hover{background:' + L2 + '}',
      '.tp-exp-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tp-exp-amt{font-weight:600;font-variant-numeric:tabular-nums}',
      '.tp-none{font-size:12px;padding:6px 2px}',
      '.tp-pack{max-height:320px;overflow:auto}',
      '.tp-pack li{display:flex;align-items:center;gap:10px;padding:5px 4px 5px 6px;border-radius:9px;font-size:13px}',
      '.tp-pack li > span{flex:1;min-width:0}',
      '.tp-pack li.is-done > span{text-decoration:line-through;color:' + FG2 + '}',
      '.tp-check{flex:none;width:18px;height:18px;padding:0;border-radius:6px;border:1.5px solid ' + B2 + ';background:transparent;color:transparent;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}',
      '.tp-check:hover{border-color:var(' + OK + ')}',
      '.tp-check[aria-checked=true]{background:var(' + OK + ');border-color:var(' + OK + ');color:#fff}',
      '.tp-pack-add{display:flex;gap:6px;margin-top:10px}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'travel-planner: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 23, label: () => t('panel'), locale: NS,
        }, PanelGlyph('plane')));
      },
    };
  },
});
