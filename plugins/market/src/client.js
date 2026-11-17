window.__ModuleLoader__.load({
  id: '@local/market',
  factory(require) {
    /* @kit */
    /* @suite */

    const PANEL_ID = 'market';
    const NS = 'market';
    const call = makeCall('/plugin-api/market');
    const REFRESH_MS = 12000;
    const LS_COLOR = 'market.updown';

    const zh = {
      panel: '市场', title: '全球市场', eyebrow: '股指 · 商品 · 外汇 · 加密货币',
      statOpen: '开市中', statWatch: '关注', statUp: '上涨', statDown: '下跌',
      addPlaceholder: '搜索股票、币种或指数：AAPL、BTC、Nikkei、黄金',
      search: '搜索', add: '加入关注', watching: '已关注', refresh: '刷新', close: '关闭', remove: '移除关注',
      noResults: '没有找到。试试股票代码（AAPL）、币种（BTC）或指数名（Nikkei）',
      exchanges: '全球交易所', exchangesHint: '拖动地球，点一个城市', indices: '全球股指', macro: '商品与外汇', crypto: '加密货币', watchlist: '我的关注',
      region_americas: '美洲', region_europe: '欧洲', region_apac: '亚太',
      state_open: '开市', state_lunch: '午休', state_closed: '休市', localTime: '当地 {t}', openNow: '{n} 个市场开市中',
      kind_index: '指数', kind_commodity: '商品', kind_fx: '外汇', kind_crypto: '加密货币', kind_stock: '股票',
      empty: '还没有关注的标的。搜索一个加进来', emptyHint: '例如：AAPL、BTC、Tencent、Nikkei',
      colorUp: '涨绿跌红', colorDown: '涨红跌绿',
      price: '现价', change: '涨跌', pct: '涨跌幅', hi: '最高', lo: '最低', open: '今开', prev: '昨收', cap: '市值', volume: '24h 成交额', rank: '排名', h1: '1 小时', d7: '7 天', h24: '24 小时',
      position: '持仓', shares: '持有数量', cost: '成本价', value: '市值', profit: '盈亏', note: '备注', save: '保存', saved: '已保存',
      days: '近 {n} 日', histFail: '走势加载失败', histNone: '暂无走势数据',
      stale: '部分行情暂时拉取失败，显示的是上次的数据', updated: '更新于 {t}',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      delayed: '数据来自公开接口，可能有延迟，休市日（节假日）未纳入，仅供参考，不构成投资建议。',
      hint: '可以在对话里说“把 BTC 加进关注”或“今天全球市场怎么样”',
      noWebgl: '这个浏览器不能显示 3D 地球，下面是交易所列表。',
    };
    const en = {
      panel: 'Markets', title: 'Global markets', eyebrow: 'Indices · commodities · FX · crypto',
      statOpen: 'Open now', statWatch: 'Watching', statUp: 'Up', statDown: 'Down',
      addPlaceholder: 'Search a stock, coin or index: AAPL, BTC, Nikkei, gold',
      search: 'Search', add: 'Watch', watching: 'Watching', refresh: 'Refresh', close: 'Close', remove: 'Remove',
      noResults: 'Nothing found. Try a ticker (AAPL), a coin (BTC) or an index name (Nikkei)',
      exchanges: 'Exchanges worldwide', exchangesHint: 'Drag the globe, tap a city', indices: 'World indices', macro: 'Commodities & FX', crypto: 'Crypto', watchlist: 'Watchlist',
      region_americas: 'Americas', region_europe: 'Europe', region_apac: 'Asia-Pacific',
      state_open: 'Open', state_lunch: 'Lunch break', state_closed: 'Closed', localTime: 'Local {t}', openNow: '{n} markets open',
      kind_index: 'Index', kind_commodity: 'Commodity', kind_fx: 'FX', kind_crypto: 'Crypto', kind_stock: 'Stock',
      empty: 'Nothing on the watchlist yet. Search for something to add.', emptyHint: 'For example: AAPL, BTC, Tencent, Nikkei',
      colorUp: 'Green up, red down', colorDown: 'Red up, green down',
      price: 'Price', change: 'Change', pct: 'Change %', hi: 'High', lo: 'Low', open: 'Open', prev: 'Prev close', cap: 'Market cap', volume: '24h volume', rank: 'Rank', h1: '1h', d7: '7d', h24: '24h',
      position: 'Position', shares: 'Units', cost: 'Cost per unit', value: 'Value', profit: 'P/L', note: 'Note', save: 'Save', saved: 'Saved',
      days: 'Last {n} days', histFail: 'Could not load the chart', histNone: 'No chart data',
      stale: 'Some quotes could not be refreshed; showing the last data', updated: 'Updated {t}',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      delayed: 'Data comes from public endpoints, may be delayed, ignores public holidays, and is not investment advice.',
      hint: 'Ask in chat: “Add BTC to my watchlist” or “How are global markets today?”',
      noWebgl: 'This browser cannot show the 3D globe; the exchange list is below.',
    };
    zh.dateLocale = 'zh-CN'; en.dateLocale = 'en-US';

    Object.assign(ICONS, {
      chart: ['M4 19V5', 'M4 19h16', 'M7 15l3.5-4 3 2.5L19 7'],
      arrowup: ['M12 19V6', 'M6.5 11.5L12 6l5.5 5.5'],
      arrowdown: ['M12 5v13', 'M6.5 12.5L12 18l5.5-5.5'],
      globe: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18', 'M12 3c2.5 3 2.5 15 0 18', 'M12 3c-2.5 3-2.5 15 0 18'],
    });
    const MarketGlyph = PanelGlyph('globe');

    /* @include globe.js */

    /** Colour convention, stored per browser: 'up' = green up/red down (global default), 'down' = red up/green down. */
    const readColors = () => { try { return localStorage.getItem(LS_COLOR) === 'down' ? 'down' : 'up'; } catch { return 'up'; } };
    const UP = 'var(--mk-up)';
    const DOWN = 'var(--mk-down)';
    const toneOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
    const fmt = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    const priceDigits = (p) => (p === null || p === undefined ? 2 : Math.abs(p) >= 1000 ? 2 : Math.abs(p) >= 10 ? 2 : Math.abs(p) >= 1 ? 3 : Math.abs(p) >= 0.1 ? 4 : 6);
    const fmtPrice = (q) => fmt(q.price, q.kind === 'fx' ? 4 : priceDigits(q.price));
    const sign = (n) => (n > 0 ? '+' : '');
    const pctText = (n) => (n === null || n === undefined ? '—' : sign(n) + fmt(n) + '%');
    const compact = (n) => (n === null || n === undefined ? '—' : n >= 1e12 ? fmt(n / 1e12) + 'T' : n >= 1e9 ? fmt(n / 1e9) + 'B' : n >= 1e6 ? fmt(n / 1e6) + 'M' : fmt(n, 0));
    const money = (n, cur) => (cur === 'USD' ? '$' : cur === 'HKD' ? 'HK$' : '') + fmt(n);
    const isZh = (t) => t('dateLocale') === 'zh-CN';
    const nameOf = (t, o) => (isZh(t) ? o.name : o.nameEn || o.name);
    const localClock = (tz, locale) => { try { return new Date().toLocaleTimeString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { return ''; } };

    function Spark(props) {
      const { candles, tone, height } = props;
      const w = 600; const hgt = height || 140; const pad = 6;
      if (!candles || candles.length < 2) return null;
      const closes = candles.map((c) => c.close);
      const lo = Math.min(...candles.map((c) => (c.low ?? c.close))); const hi = Math.max(...candles.map((c) => (c.high ?? c.close)));
      const span = hi - lo || 1;
      const x = (i) => pad + (i / (candles.length - 1)) * (w - pad * 2);
      const y = (v) => pad + (1 - (v - lo) / span) * (hgt - pad * 2);
      const line = closes.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      const area = line + 'L' + x(closes.length - 1).toFixed(1) + ' ' + (hgt - pad) + 'L' + x(0).toFixed(1) + ' ' + (hgt - pad) + 'Z';
      const color = tone === 'up' ? UP : tone === 'down' ? DOWN : 'var(--dsw-alias-label-secondary)';
      return h('svg', { className: 'mk-spark', viewBox: '0 0 ' + w + ' ' + hgt, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'chart' },
        h('path', { d: area, fill: color, opacity: 0.12 }), h('path', { d: line, fill: 'none', stroke: color, strokeWidth: 2, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' }));
    }

    /** One quote as a card: name, price, change. Used for headline indices, commodities and FX. */
    function QuoteCard(props) {
      const { t, row, onOpen } = props;
      const q = row.quote;
      const tone = q ? toneOf(q.pct) : 'flat';
      return h('button', { type: 'button', className: 'mk-qc is-' + tone, onClick: () => onOpen(row) },
        h('span', { className: 'mk-qc-name' }, nameOf(t, row)),
        h('span', { className: 'mk-qc-price' }, q ? fmtPrice(q) : '—'),
        h('span', { className: 'mk-qc-chg' }, q ? pctText(q.pct) : ''));
    }

    function Detail(props) {
      const { t, item, onClose, onSaved, onRemove, onError, watched } = props;
      const q = item.quote;
      const [hist, setHist] = useState(null);
      const [days, setDays] = useState(60);
      const [shares, setShares] = useState(item.shares ? String(item.shares) : '');
      const [cost, setCost] = useState(item.cost ? String(item.cost) : '');
      const [note, setNote] = useState(item.note || '');
      const [busy, setBusy] = useState(false);
      const [saved, setSaved] = useState(false);
      useEffect(() => {
        let live = true; setHist(null);
        call({ action: 'history', id: item.key, days }).then((r) => { if (live) setHist(r.candles || []); }).catch(() => { if (live) setHist(false); });
        return () => { live = false; };
      }, [item.key, days]);
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try { await call({ action: 'update', id: item.key, shares: shares.trim(), cost: cost.trim(), note }); setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved(); }
        catch (err) { onError(t('saveFailed', { error: err.message })); } finally { setBusy(false); }
      };
      const tone = q ? toneOf(q.pct) : 'flat';
      const facts = !q ? [] : q.kind === 'crypto'
        ? [[t('rank'), '#' + (q.rank || '—')], [t('cap'), '$' + compact(q.cap)], [t('volume'), '$' + compact(q.volume)], [t('h1'), pctText(q.pct1h)], [t('h24'), pctText(q.pct)], [t('d7'), pctText(q.pct7d)]]
        : [[t('open'), fmt(q.open, priceDigits(q.open))], [t('prev'), fmt(q.prev, priceDigits(q.prev))], [t('hi'), fmt(q.high, priceDigits(q.high))], [t('lo'), fmt(q.low, priceDigits(q.low))]];
      const pos = item.position;
      const title = nameOf(t, item);
      return h('div', { className: 'mk-overlay', role: 'dialog', 'aria-modal': true, 'aria-label': title, onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { className: 'mk-sheet' },
          h('div', { className: 'mk-sheet-head' },
            h('div', null, h('h2', { className: 'mk-sheet-title' }, title), h('div', { className: 'lp-muted' }, (q ? q.code : item.key) + ' · ' + t('kind_' + (q ? q.kind : item.kind || 'stock')) + (q && q.currency ? ' · ' + q.currency : ''))),
            h('button', { type: 'button', className: 'lp-round', onClick: onClose, 'aria-label': t('close'), title: t('close') }, h(Icon, { name: 'x', size: 16 }))),
          q ? h('div', { className: 'mk-sheet-price is-' + tone }, h('span', { className: 'mk-big' }, fmtPrice(q)), h('span', null, sign(q.change) + fmt(q.change, q.kind === 'fx' ? 4 : priceDigits(q.price))), h('span', null, pctText(q.pct))) : null,
          h('div', { className: 'mk-chart' },
            hist === null ? h('div', { className: 'lp-skel', style: { height: 140, borderRadius: 12 } })
              : hist === false ? h('div', { className: 'lp-muted mk-chart-note' }, t('histFail'))
                : hist.length < 2 ? h('div', { className: 'lp-muted mk-chart-note' }, t('histNone'))
                  : h(React.Fragment, null, h(Spark, { candles: hist, tone: hist[hist.length - 1].close >= hist[0].close ? 'up' : 'down' }),
                    h('div', { className: 'mk-chart-foot lp-muted' }, h('span', null, hist[0].date), h('span', null, t('days', { n: hist.length })), h('span', null, hist[hist.length - 1].date)))),
          h('div', { className: 'mk-range' }, [20, 60, 120, 250].map((n) => h('button', { key: n, type: 'button', className: 'lp-ghost' + (days === n ? ' is-on' : ''), onClick: () => setDays(n) }, n))),
          facts.length ? h('dl', { className: 'mk-facts' }, facts.map(([k, v]) => h('div', { key: k }, h('dt', null, k), h('dd', null, v)))) : null,
          watched ? h('form', { className: 'mk-pos', onSubmit: save },
            h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'wallet', className: 'lp-ico' }), t('position')),
            h('div', { className: 'mk-pos-row' },
              h('label', { className: 'lp-field' }, h('span', null, t('shares')), h('input', { inputMode: 'decimal', value: shares, onChange: (e) => setShares(e.target.value), placeholder: '0' })),
              h('label', { className: 'lp-field' }, h('span', null, t('cost') + (q && q.currency ? ' (' + q.currency + ')' : '')), h('input', { inputMode: 'decimal', value: cost, onChange: (e) => setCost(e.target.value), placeholder: '0.00' }))),
            pos ? h('div', { className: 'mk-pnl is-' + toneOf(pos.profit) }, h('span', null, t('value') + ' ' + money(pos.value, pos.currency)), h('span', null, t('profit') + ' ' + sign(pos.profit) + money(pos.profit, pos.currency) + ' (' + pctText(pos.pct) + ')')) : null,
            h('label', { className: 'lp-field' }, h('span', null, t('note')), h('input', { value: note, onChange: (e) => setNote(e.target.value), maxLength: 200 })),
            h('div', { className: 'mk-actions' },
              h('button', { type: 'submit', className: 'lp-primary', disabled: busy }, saved ? t('saved') : t('save')),
              h('button', { type: 'button', className: 'lp-ghost', onClick: () => onRemove(item) }, h(Icon, { name: 'trash', size: 14 }), t('remove')))) : h('div', { className: 'mk-actions' },
            h('button', { type: 'button', className: 'lp-primary', onClick: () => props.onAdd(item) }, h(Icon, { name: 'plus', size: 14 }), t('add')))));
    }

    /** The globe and the exchange it points at. Falls back to a plain list when WebGL is unavailable. */
    function GlobeBox(props) {
      const { t, exchanges, selectedId, onSelect } = props;
      const host = useRef(null);
      const api = useRef(null);
      const [status, setStatus] = useState('loading'); // loading | ready | failed
      const [tip, setTip] = useState(null);            // { id, x, y }
      const latest = useRef({ exchanges, selectedId });
      latest.current = { exchanges, selectedId };
      const select = useRef(onSelect); select.current = onSelect;

      useEffect(() => {
        let dead = false; let g = null;
        Promise.all([loadThree(), loadLand()]).then(([THREE, land]) => {
          if (dead || !host.current) return;
          try {
            g = buildGlobe(THREE, land, host.current, {
              hover: (id) => setTip(id ? { id, x: 0, y: 0 } : null),
              moveTip: (x, y) => setTip((p) => (p ? (Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5 ? p : { ...p, x, y }) : p)),
              pick: (id) => select.current(id),
            });
            api.current = g;
            g.update(latest.current.exchanges, latest.current.selectedId);
            setStatus('ready');
          } catch { setStatus('failed'); }
        }).catch(() => { if (!dead) setStatus('failed'); });
        return () => { dead = true; api.current = null; if (g) g.dispose(); };
      }, []);
      useEffect(() => { if (api.current) api.current.update(exchanges, selectedId); }, [exchanges, selectedId, status]);
      useEffect(() => {
        const ex = exchanges.find((e) => e.id === selectedId);
        if (api.current && ex) api.current.focus(ex.lat, ex.lon);
      }, [selectedId]);

      const tipEx = tip ? exchanges.find((e) => e.id === tip.id) : null;
      return h('div', { className: 'mk-globe-wrap' },
        h('div', { ref: host, className: 'mk-globe', 'aria-label': t('exchanges') }),
        status === 'loading' ? h('div', { className: 'mk-globe-note lp-muted' }, h(Icon, { name: 'refresh', size: 16, className: 'lp-spin' })) : null,
        status === 'failed' ? h('div', { className: 'mk-globe-note lp-muted' }, t('noWebgl')) : null,
        tipEx ? h('div', { className: 'mk-tip', style: { left: tip.x, top: tip.y } }, h('b', null, isZh(t) ? tipEx.cityZh : tipEx.city), h('span', null, t('state_' + tipEx.state)),
          tipEx.quote ? h('span', { className: 'is-' + toneOf(tipEx.quote.pct) }, pctText(tipEx.quote.pct)) : null) : null);
    }

    function ExchangeList(props) {
      const { t, exchanges, selectedId, onSelect, byKey } = props;
      const groups = ['americas', 'europe', 'apac'].map((r) => [r, exchanges.filter((e) => ((byKey.get(e.index) || {}).region || '') === r)]);
      return h('div', { className: 'mk-ex' }, groups.map(([r, list]) => h('div', { key: r, className: 'mk-ex-group' },
        h('div', { className: 'mk-ex-region' }, t('region_' + r)),
        list.map((e) => {
          const q = e.quote; const tone = q ? toneOf(q.pct) : 'flat';
          return h('button', { key: e.id, type: 'button', className: 'mk-ex-row' + (selectedId === e.id ? ' is-selected' : ''), onClick: () => onSelect(e.id), 'aria-pressed': selectedId === e.id },
            h('i', { className: 'mk-dot is-' + e.state }),
            h('span', { className: 'mk-ex-name' }, h('b', null, isZh(t) ? e.cityZh : e.city), h('span', { className: 'lp-muted' }, t('state_' + e.state) + ' · ' + localClock(e.tz, isZh(t) ? 'zh-CN' : 'en-GB'))),
            h('span', { className: 'mk-ex-pct is-' + tone }, q ? pctText(q.pct) : '—'));
        }))));
    }

    function QuoteTable(props) {
      const { t, rows, onOpen, empty } = props;
      if (!rows.length) return empty || null;
      return h('ul', { className: 'mk-grid' }, rows.map((it) => {
        const q = it.quote; const tone = q ? toneOf(q.pct) : 'flat';
        return h('li', { key: it.key },
          h('button', { type: 'button', className: 'mk-cell is-' + tone, onClick: () => onOpen(it) },
            h('span', { className: 'mk-cell-name' }, h('b', null, nameOf(t, it)), h('span', { className: 'lp-muted' }, (q ? q.code : it.key.replace(/^[xc]:(\d+\.)?/, '')) + (it.note ? ' · ' + it.note : ''))),
            h('span', { className: 'mk-cell-pct' }, q ? pctText(q.pct) : '—'),
            h('span', { className: 'mk-cell-price' }, q ? fmtPrice(q) : '—'),
            it.position ? h('span', { className: 'mk-cell-pos is-' + toneOf(it.position.profit) }, sign(it.position.profit) + money(it.position.profit, it.position.currency)) : h('span', null)));
      }));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [input, setInput] = useState('');
      const [results, setResults] = useState(null);
      const [busy, setBusy] = useState(false);
      const [addingKey, setAddingKey] = useState(null);
      const [refreshing, setRefreshing] = useState(false);
      const [open, setOpen] = useState(null);       // the row shown in the detail sheet
      const [selectedEx, setSelectedEx] = useState(null);
      const [colors, setColors] = useState(readColors);
      const [tab, setTab] = useState('indices');
      const alive = useRef(true);

      const load = useCallback(async (refresh) => {
        if (refresh) setRefreshing(true);
        try { const r = await call({ action: 'quotes', refresh: !!refresh }); if (alive.current) { setData(r); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
        finally { if (alive.current) setRefreshing(false); }
      }, [t]);
      useEffect(() => {
        alive.current = true; load();
        const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);

      const flip = () => { const next = colors === 'up' ? 'down' : 'up'; setColors(next); try { localStorage.setItem(LS_COLOR, next); } catch { /* storage blocked */ } };
      const addSymbol = async (symbol, key) => {
        setAddingKey(key || symbol);
        try { await call({ action: 'add', symbol }); setInput(''); setResults(null); await load(); }
        catch (e) { setError(t('saveFailed', { error: e.message })); } finally { setAddingKey(null); }
      };
      const onSubmit = async (e) => {
        e.preventDefault();
        const v = input.trim();
        if (!v || busy) return;
        setBusy(true);
        try { const r = await call({ action: 'search', query: v }); setResults(r.results); }
        catch (err) { setError(t('loadFailed', { error: err.message })); } finally { setBusy(false); }
      };
      const removeItem = async (item) => {
        try { await call({ action: 'remove', id: item.key }); setOpen(null); await load(); } catch (e) { setError(t('saveFailed', { error: e.message })); }
      };

      const items = (data && data.items) || [];
      const exchanges = (data && data.exchanges) || [];
      const byKey = useMemo(() => new Map(((data && data.indices) || []).map((r) => [r.key, r])), [data]);
      const watched = open ? items.find((i) => i.key === open.key) || null : null;
      const sheet = open ? (watched || { key: open.key, name: open.name, nameEn: open.nameEn, kind: open.kind, quote: open.quote || null, shares: 0, cost: 0, note: '', position: null }) : null;
      const exRow = selectedEx ? exchanges.find((e) => e.id === selectedEx) : null;
      const exIndex = exRow ? byKey.get(exRow.index) : null;
      const cryptoRows = ((data && data.crypto) || []).map((q) => ({ key: q.key, kind: 'crypto', name: q.name, nameEn: q.nameEn, quote: q }));
      const tabs = [['indices', t('indices')], ['macro', t('macro')], ['crypto', t('crypto')]];
      const shownRows = tab === 'indices' ? (data ? data.indices : []) : tab === 'macro' ? (data ? data.macro : []) : cryptoRows;
      const headline = (data && data.headline) || [];

      return h('div', { className: 'lp-root mk-root is-' + colors },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero mk-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, t('eyebrow')), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'mk-hero-r' },
              data ? h('span', { className: 'mk-pill' }, h('i', { className: 'mk-dot is-open' }), t('openNow', { n: data.openCount })) : null,
              items.length ? h('span', { className: 'mk-pill is-quiet' }, t('statWatch') + ' ' + items.length + ' · ' + t('statUp') + ' ' + data.up + ' · ' + t('statDown') + ' ' + data.down) : null,
              h('button', { type: 'button', className: 'lp-ghost', onClick: flip, title: t('colorUp') + ' / ' + t('colorDown') }, h('i', { className: 'mk-swatch' }), colors === 'up' ? t('colorUp') : t('colorDown')),
              h('button', { type: 'button', className: 'lp-round', onClick: () => load(true), disabled: refreshing, title: t('refresh'), 'aria-label': t('refresh') }, h(Icon, { name: 'refresh', size: 16, className: refreshing ? 'lp-spin' : '' })))),
          h(ErrorBar, { error, onRetry: () => load(true), retryLabel: t('retry'), onClose: () => setError(null) }),
          data && data.stale ? h('div', { className: 'mk-note', role: 'status' }, h('i', { className: 'mk-dot is-lunch' }), t('stale')) : null,

          h('section', { className: 'mk-stage' },
            h('div', { className: 'mk-stage-main' },
              h(GlobeBox, { t, exchanges, selectedId: selectedEx, onSelect: (id) => setSelectedEx(id === selectedEx ? null : id) }),
              h('div', { className: 'mk-side' },
                exRow ? h('div', { className: 'mk-focus' },
                  h('div', { className: 'mk-focus-top' }, h('b', null, (isZh(t) ? exRow.cityZh : exRow.city)), h('span', { className: 'mk-state is-' + exRow.state }, t('state_' + exRow.state))),
                  h('div', { className: 'mk-focus-sub' }, t('localTime', { t: localClock(exRow.tz, isZh(t) ? 'zh-CN' : 'en-GB') }) + (exIndex ? ' · ' + nameOf(t, exIndex) : '')),
                  exRow.quote ? h('button', { type: 'button', className: 'mk-focus-q is-' + toneOf(exRow.quote.pct), onClick: () => setOpen(exIndex) }, h('span', null, fmtPrice(exRow.quote)), h('span', null, pctText(exRow.quote.pct))) : null)
                  : h('div', { className: 'mk-focus-hint' }, t('exchangesHint')),
                h(ExchangeList, { t, exchanges, selectedId: selectedEx, onSelect: (id) => setSelectedEx(id === selectedEx ? null : id), byKey }))),
            h('div', { className: 'mk-ticker' }, !data ? [0, 1, 2, 3].map((i) => h('div', { key: i, className: 'lp-skel mk-tick-skel' })) : headline.map((r) => h(QuoteCard, { key: r.key, t, row: r, onOpen: setOpen })))),

          h('form', { className: 'lp-bar mk-add', onSubmit },
            h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'search', size: 18 })),
            h('input', { className: 'lp-bar-input', value: input, onChange: (e) => setInput(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder') }),
            h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !input.trim() }, busy ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'search', size: 14 }), t('search'))),
          results ? h('section', { className: 'lp-card mk-results' },
            h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'search', className: 'lp-ico' }), t('search')), h('button', { type: 'button', className: 'lp-ghost', onClick: () => setResults(null) }, t('close'))),
            !results.length ? h(Empty, { icon: 'search', text: t('noResults') })
              : h('ul', { className: 'mk-hits' }, results.map((r) => h('li', { key: r.key, className: 'mk-hit' },
                h('button', { type: 'button', className: 'mk-hit-main', onClick: () => setOpen({ key: r.key, name: r.name, nameEn: r.nameEn, kind: r.kind, quote: null }) },
                  h('b', null, nameOf(t, r)), h('span', { className: 'lp-muted' }, r.code + ' · ' + t('kind_' + r.kind))),
                r.watched ? h('span', { className: 'lp-pill tone-success' }, h(Icon, { name: 'check', size: 12 }), t('watching'))
                  : h('button', { type: 'button', className: 'lp-primary mk-add-btn', disabled: addingKey === r.key, onClick: () => addSymbol(r.key, r.key) }, addingKey === r.key ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'plus', size: 14 }), t('add')))))) : null,

          h('div', { className: 'mk-listhead' },
            h('div', { className: 'mk-tabs', role: 'tablist' }, tabs.map(([k, label]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k, className: 'mk-tab' + (tab === k ? ' is-on' : ''), onClick: () => setTab(k) }, label)))),
          !data ? h('div', { className: 'lp-skel', style: { height: 220, borderRadius: 16 } }) : h(QuoteTable, { t, rows: shownRows, onOpen: setOpen }),

          h('div', { className: 'mk-listhead' }, h('h2', { className: 'mk-h2' }, t('watchlist'))),
          !data ? null : !items.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'chart', text: t('empty') }, h('p', { className: 'lp-muted' }, t('emptyHint'))))
            : h(QuoteTable, { t, rows: items, onOpen: setOpen }),
          data ? h('p', { className: 'lp-muted mk-foot' }, t('updated', { t: new Date(data.at).toLocaleTimeString(isZh(t) ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }), '  ·  ', t('delayed')) : null,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        sheet ? h(Detail, { key: sheet.key, t, item: sheet, watched: !!watched, onClose: () => setOpen(null), onSaved: () => load(), onRemove: removeItem, onError: setError, onAdd: async (it) => { await addSymbol(it.key, it.key); } }) : null,
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      // Global default: green up, red down. The toggle flips it.
      '.mk-root{--mk-up:var(' + OK + ');--mk-down:var(' + ERR + ');background:var(--dsw-alias-bg-base,#fff)}',
      '.mk-root.is-down{--mk-up:var(' + ERR + ');--mk-down:var(' + OK + ')}',
      '.mk-hero{align-items:flex-end}',
      '.mk-hero-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '.mk-pill{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:600;background:' + tint(OK, 14) + ';color:var(' + OK + ')}',
      '.mk-pill.is-quiet{background:var(--lp-glass-soft);color:' + FG2 + ';font-weight:500}',
      // A flat white stage: a hairline border, no shadows, no gradients. Text and colours follow the theme.
      '.mk-stage{--st-fg:' + FG + ';--st-fg2:' + FG2 + ';--st-edge:var(--dsw-alias-border-l1,rgba(0,0,0,.08));margin-bottom:16px;border-radius:20px;overflow:hidden;color:var(--st-fg);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--st-edge)}',
      '.mk-stage-main{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(250px,.9fr);gap:0;align-items:stretch}',
      '.mk-globe-wrap{position:relative;min-height:420px;height:min(540px,62vh);width:100%}',
      '.mk-globe{position:absolute;inset:0}',
      '.mk-canvas{display:block;width:100%;height:100%;outline:none}',
      '.mk-globe-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:13px;pointer-events:none;color:var(--st-fg2)}',
      '.mk-tip{position:absolute;transform:translate(14px,-50%);display:flex;flex-direction:column;gap:1px;padding:7px 11px;border-radius:10px;font-size:12px;pointer-events:none;white-space:nowrap;color:var(--st-fg);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--st-edge);z-index:2}',
      '.mk-tip b{font-size:13px}', '.mk-tip span{color:var(--st-fg2)}', '.mk-tip .is-up{color:' + UP + '}', '.mk-tip .is-down{color:' + DOWN + '}',
      '.mk-side{display:flex;flex-direction:column;gap:10px;padding:18px 16px 14px 8px;min-width:0;overflow-y:auto;max-height:540px;border-left:1px solid var(--st-edge);scrollbar-width:thin}',
      '.mk-focus{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:14px;background:' + tint(BRAND, 8) + ';border:1px solid ' + tint(BRAND, 18) + '}',
      '.mk-focus-top{display:flex;align-items:center;justify-content:space-between;font-size:16px}',
      '.mk-focus-sub{font-size:12px;color:var(--st-fg2)}',
      '.mk-focus-hint{font-size:12.5px;padding:6px 4px 2px;color:var(--st-fg2)}',
      '.mk-focus-q{display:flex;align-items:baseline;justify-content:space-between;gap:10px;border:0;background:transparent;padding:6px 0 0;color:inherit;font:inherit;font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;cursor:pointer;text-align:left}',
      '.mk-focus-q span:last-child{font-size:14px}', '.mk-focus-q.is-up{color:' + UP + '}', '.mk-focus-q.is-down{color:' + DOWN + '}',
      '.mk-state{font-size:11.5px;padding:3px 10px;border-radius:999px;background:var(--lp-glass-soft);color:var(--st-fg2)}',
      '.mk-state.is-open{background:' + tint(OK, 16) + ';color:var(' + OK + ')}',
      '.mk-ex{display:flex;flex-direction:column;gap:12px}',
      '.mk-ex-region{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--st-fg2);padding:2px 8px 4px}',
      '.mk-ex-row{width:100%;display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:11px;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.mk-ex-row:hover{background:var(--lp-glass-soft)}', '.mk-ex-row.is-selected{background:' + tint(BRAND, 12) + '}',
      '.mk-ex-row:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:-2px}',
      '.mk-ex-name{display:flex;flex-direction:column;min-width:0;line-height:17px}',
      '.mk-ex-name b{font-size:13.5px;font-weight:600}', '.mk-ex-name .lp-muted{font-size:11px;color:var(--st-fg2)}',
      '.mk-ex-pct{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--st-fg2)}',
      '.mk-ex-pct.is-up{color:' + UP + '}', '.mk-ex-pct.is-down{color:' + DOWN + '}',
      '.mk-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:' + tint(IDLE, 60) + '}',
      '.mk-dot.is-open{background:var(' + OK + ')}', '.mk-dot.is-lunch{background:var(' + WARN + ')}',
      '.mk-ticker{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--st-edge)}',
      '.mk-tick-skel{height:74px;border-radius:0}',
      '.mk-qc{display:flex;flex-direction:column;gap:2px;min-width:0;padding:14px 18px;border:0;border-left:1px solid var(--st-edge);background:transparent;text-align:left;cursor:pointer;color:inherit;font:inherit}',
      '.mk-qc:first-child{border-left:0}', '.mk-qc:hover{background:var(--lp-glass-soft)}',
      '.mk-qc-name{font-size:12px;color:var(--st-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mk-qc-price{font-size:19px;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.01em}',
      '.mk-qc-chg{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--st-fg2)}',
      '.mk-qc.is-up .mk-qc-chg{color:' + UP + '}', '.mk-qc.is-down .mk-qc-chg{color:' + DOWN + '}',
      '.mk-add{margin-bottom:14px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));box-shadow:none;border-radius:14px}',
      '.mk-results{margin-bottom:14px;box-shadow:none;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}',
      '.mk-hits{list-style:none;margin:0;padding:0;max-height:360px;overflow:auto}',
      '.mk-hit{display:flex;align-items:center;gap:12px;padding:6px;border-top:1px solid var(--lp-glass-edge)}', '.mk-hit:first-child{border-top:0}',
      '.mk-hit-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:4px 2px}',
      '.mk-add-btn{height:30px;padding:0 12px}',
      '.mk-listhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 2px 10px;flex-wrap:wrap}',
      '.mk-h2{margin:0;font-size:15px;font-weight:650}', '.mk-tools{display:flex;align-items:center;gap:8px}',
      '.mk-tabs{display:inline-flex;padding:3px;border-radius:12px;background:var(--lp-glass-soft)}',
      '.mk-tab{height:28px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:' + FG2 + ';font:inherit;font-size:13px;cursor:pointer}',
      '.mk-tab.is-on{background:var(--dsw-alias-bg-layer-1);color:' + FG + ';font-weight:600}',
      '.mk-swatch{display:inline-block;width:14px;height:14px;border-radius:50%;background:linear-gradient(90deg,' + UP + ' 50%,' + DOWN + ' 50%)}',
      '.mk-grid{list-style:none;margin:0 0 18px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}',
      '.mk-cell{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:6px 10px;align-items:center;padding:13px 15px;border-radius:14px;text-align:left;color:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));transition:border-color .12s,background .12s}',
      '.mk-cell:hover{border-color:' + tint(BRAND, 45) + '}',
      '.mk-cell:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:2px}',
      '.mk-cell-name{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.mk-cell-name b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mk-cell-name .lp-muted{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mk-cell-pct{justify-self:end;padding:3px 9px;border-radius:999px;font-size:12.5px;font-weight:650;font-variant-numeric:tabular-nums;background:var(--lp-glass-soft);color:' + FG2 + '}',
      '.mk-cell.is-up .mk-cell-pct{background:color-mix(in srgb,var(--mk-up) 16%,transparent);color:' + UP + '}',
      '.mk-cell.is-down .mk-cell-pct{background:color-mix(in srgb,var(--mk-down) 16%,transparent);color:' + DOWN + '}',
      '.mk-cell-price{font-size:19px;font-weight:650;letter-spacing:-.01em;font-variant-numeric:tabular-nums}',
      '.mk-cell-pos{justify-self:end;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.mk-cell-pos.is-up{color:' + UP + '}', '.mk-cell-pos.is-down{color:' + DOWN + '}',
      '.mk-note{display:flex;align-items:center;gap:8px;margin:-4px 2px 12px;font-size:12px;color:' + FG2 + '}',
      '.mk-note .mk-dot{background:#fbbf24}',
      '@media (max-width:900px){.mk-stage-main{grid-template-columns:1fr}.mk-globe-wrap{min-height:320px;height:min(400px,56vh)}.mk-side{max-height:none;padding:0 12px 14px}.mk-ex{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 14px}.mk-ex-region{grid-column:1/-1}}',
      '@media (max-width:640px){.mk-hero-r{justify-content:flex-start}.mk-grid{grid-template-columns:1fr}}',
      '.mk-foot{margin:12px 2px 0;font-size:11.5px;line-height:17px}',
      '.mk-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45);' + GLASS_BLUR + '}',
      '.mk-sheet{width:min(560px,100%);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:22px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));box-shadow:0 12px 40px -16px rgba(0,0,0,.28)}',
      '.mk-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}', '.mk-sheet-title{margin:0;font-size:18px}',
      '.mk-sheet-price{display:flex;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums;font-size:14px;font-weight:600;flex-wrap:wrap}',
      '.mk-sheet-price.is-up{color:' + UP + '}', '.mk-sheet-price.is-down{color:' + DOWN + '}', '.mk-big{font-size:30px;font-weight:700}',
      '.mk-spark{display:block;width:100%;height:140px}', '.mk-chart-foot{display:flex;justify-content:space-between;font-size:11px;margin-top:4px}', '.mk-chart-note{padding:44px 0;text-align:center}',
      '.mk-range{display:flex;gap:6px}', '.mk-range .lp-ghost.is-on{color:var(' + BRAND + ');border-color:' + tint(BRAND, 40) + '}',
      '.mk-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px 14px;margin:0}', '.mk-facts div{display:flex;flex-direction:column;gap:2px}',
      '.mk-facts dt{font-size:11.5px;color:' + FG2 + '}', '.mk-facts dd{margin:0;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.mk-pos{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--lp-glass-edge)}', '.mk-pos-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.mk-pnl{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.mk-pnl.is-up{color:' + UP + '}', '.mk-pnl.is-down{color:' + DOWN + '}', '.mk-actions{display:flex;justify-content:space-between;align-items:center}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'market: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'news', order: 15, label: () => t('panel'), icon: MarketGlyph, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 31, label: () => t('panel'), locale: NS,
        }, MarketGlyph)));
      },
    };
  },
});
