window.__ModuleLoader__.load({
  id: '@local/market',
  factory(require) {
    /* @kit */
    /* @suite */

    const PANEL_ID = 'market';
    const NS = 'market';
    const call = makeCall('/plugin-api/market');
    const REFRESH_MS = 10000;
    const LS_COLOR = 'market.colors';

    const zh = {
      panel: '行情', title: '自选行情', eyebrow: '股票 · ETF · 指数',
      statWatch: '自选', statUp: '上涨', statDown: '下跌',
      addPlaceholder: '输入股票、ETF 或指数的名称、拼音或代码',
      add: '添加', search: '搜索', adding: '添加中…', watching: '已关注', refresh: '刷新', close: '关闭', remove: '移除',
      noResults: '没有找到相关的股票、ETF 或指数',
      indices: '大盘', watchlist: '自选',
      empty: '自选里还没有标的。搜索名称或代码添加一个吧', emptyHint: '例如：茅台、腾讯、AAPL、510300',
      colorCn: '红涨绿跌', colorUs: '绿涨红跌',
      price: '现价', change: '涨跌', pct: '涨跌幅', hi: '最高', lo: '最低', open: '今开', prev: '昨收', pe: '市盈率', cap: '总市值(亿)', turnover: '换手率',
      position: '持仓', shares: '持有数量', cost: '成本价', value: '市值', profit: '盈亏', note: '备注', save: '保存', saved: '已保存',
      days: '近 {n} 日', histFail: '走势加载失败', histNone: '暂无走势数据',
      stale: '行情暂时拉取失败，显示的是上次的数据', updated: '更新于 {t}',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      delayed: '数据来自公开接口，可能有延迟，仅供参考，不构成投资建议。',
      hint: '可以在对话里说“把腾讯加进自选”或“我的自选今天怎么样”',
      mkt_cn: 'A股', mkt_hk: '港股', mkt_us: '美股',
    };
    const en = {
      panel: 'Market', title: 'Market watchlist', eyebrow: 'Stocks · ETFs · indices',
      statWatch: 'Watching', statUp: 'Up', statDown: 'Down',
      addPlaceholder: 'Name, pinyin or code of a stock, ETF or index',
      add: 'Add', search: 'Search', adding: 'Adding…', watching: 'Watching', refresh: 'Refresh', close: 'Close', remove: 'Remove',
      noResults: 'No matching stock, ETF or index',
      indices: 'Indices', watchlist: 'Watchlist',
      empty: 'Nothing on the watchlist yet. Search a name or code to add one.', emptyHint: 'For example: Moutai, Tencent, AAPL, 510300',
      colorCn: 'Red up, green down', colorUs: 'Green up, red down',
      price: 'Price', change: 'Change', pct: 'Change %', hi: 'High', lo: 'Low', open: 'Open', prev: 'Prev close', pe: 'P/E', cap: 'Mkt cap (100M)', turnover: 'Turnover',
      position: 'Position', shares: 'Shares', cost: 'Cost basis', value: 'Value', profit: 'P/L', note: 'Note', save: 'Save', saved: 'Saved',
      days: 'Last {n} days', histFail: 'Could not load the chart', histNone: 'No chart data',
      stale: 'Quotes could not be refreshed; showing the last data', updated: 'Updated {t}',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      delayed: 'Data comes from a public endpoint, may be delayed, and is not investment advice.',
      hint: 'Ask in chat: “Add Tencent to my watchlist” or “How is my watchlist today?”',
      mkt_cn: 'China A', mkt_hk: 'Hong Kong', mkt_us: 'US',
    };

    Object.assign(ICONS, {
      chart: ['M4 19V5', 'M4 19h16', 'M7 15l3.5-4 3 2.5L19 7'],
      arrowup: ['M12 19V6', 'M6.5 11.5L12 6l5.5 5.5'],
      arrowdown: ['M12 5v13', 'M6.5 12.5L12 18l5.5-5.5'],
    });
    const MarketGlyph = PanelGlyph('chart');

    /** Red-up/green-down is the China convention; the other way round is the US one. Stored per browser. */
    const readColors = () => { try { return localStorage.getItem(LS_COLOR) === 'us' ? 'us' : 'cn'; } catch { return 'cn'; } };
    const UP = 'var(--mk-up)';
    const DOWN = 'var(--mk-down)';
    const toneOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
    const fmt = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    const fmtPrice = (q) => fmt(q.price, q.price !== null && Math.abs(q.price) < 10 ? 3 : 2);
    const sign = (n) => (n > 0 ? '+' : '');
    const pctText = (n) => (n === null || n === undefined ? '—' : sign(n) + fmt(n) + '%');
    const timeText = (q) => (q.time || '').replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$2-$3 $4:$5').replace(/^\d{4}[-/](\d{2})[-/](\d{2}) (\d{2}:\d{2}).*$/, '$1-$2 $3');

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

    function IndexCard(props) {
      const { i } = props;
      const q = i.quote;
      const tone = q ? toneOf(q.pct) : 'flat';
      return h('div', { className: 'lp-card mk-idx is-' + tone },
        h('div', { className: 'mk-idx-name' }, i.name),
        h('div', { className: 'mk-idx-price' }, q ? fmt(q.price) : '—'),
        h('div', { className: 'mk-idx-chg' }, q ? sign(q.change) + fmt(q.change) + '  ' + pctText(q.pct) : ''));
    }

    function Detail(props) {
      const { t, item, onClose, onSaved, onRemove, onError } = props;
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
      const facts = q ? [[t('open'), fmt(q.open)], [t('prev'), fmt(q.prev)], [t('hi'), fmt(q.high)], [t('lo'), fmt(q.low)]]
        .concat(q.market === 'cn' && q.pe ? [[t('pe'), fmt(q.pe)]] : []).concat(q.market === 'cn' && q.cap ? [[t('cap'), fmt(q.cap)]] : []).concat(q.market === 'cn' && q.turnover ? [[t('turnover'), fmt(q.turnover) + '%']] : []) : [];
      const pos = item.position;
      return h('div', { className: 'mk-overlay', role: 'dialog', 'aria-modal': true, 'aria-label': item.name, onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { className: 'mk-sheet' },
          h('div', { className: 'mk-sheet-head' },
            h('div', null, h('h2', { className: 'mk-sheet-title' }, item.name), h('div', { className: 'lp-muted' }, (q ? q.code : item.key) + (q ? ' · ' + t('mkt_' + q.market) : ''))),
            h('button', { type: 'button', className: 'lp-round', onClick: onClose, 'aria-label': t('close'), title: t('close') }, h(Icon, { name: 'x', size: 16 }))),
          q ? h('div', { className: 'mk-sheet-price is-' + tone }, h('span', { className: 'mk-big' }, fmtPrice(q)), h('span', null, sign(q.change) + fmt(q.change)), h('span', null, pctText(q.pct))) : null,
          h('div', { className: 'mk-chart' },
            hist === null ? h('div', { className: 'lp-skel', style: { height: 140, borderRadius: 12 } })
              : hist === false ? h('div', { className: 'lp-muted mk-chart-note' }, t('histFail'))
                : hist.length < 2 ? h('div', { className: 'lp-muted mk-chart-note' }, t('histNone'))
                  : h(React.Fragment, null, h(Spark, { candles: hist, tone: hist[hist.length - 1].close >= hist[0].close ? 'up' : 'down' }),
                    h('div', { className: 'mk-chart-foot lp-muted' }, h('span', null, hist[0].date), h('span', null, t('days', { n: hist.length })), h('span', null, hist[hist.length - 1].date)))),
          h('div', { className: 'mk-range' }, [20, 60, 120, 250].map((n) => h('button', { key: n, type: 'button', className: 'lp-ghost' + (days === n ? ' is-on' : ''), onClick: () => setDays(n) }, n))),
          facts.length ? h('dl', { className: 'mk-facts' }, facts.map(([k, v]) => h('div', { key: k }, h('dt', null, k), h('dd', null, v)))) : null,
          h('form', { className: 'mk-pos', onSubmit: save },
            h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'wallet', className: 'lp-ico' }), t('position')),
            h('div', { className: 'mk-pos-row' },
              h('label', { className: 'lp-field' }, h('span', null, t('shares')), h('input', { inputMode: 'decimal', value: shares, onChange: (e) => setShares(e.target.value), placeholder: '0' })),
              h('label', { className: 'lp-field' }, h('span', null, t('cost')), h('input', { inputMode: 'decimal', value: cost, onChange: (e) => setCost(e.target.value), placeholder: '0.00' }))),
            pos ? h('div', { className: 'mk-pnl is-' + toneOf(pos.profit) }, h('span', null, t('value') + ' ' + fmt(pos.value)), h('span', null, t('profit') + ' ' + sign(pos.profit) + fmt(pos.profit) + ' (' + pctText(pos.pct) + ')')) : null,
            h('label', { className: 'lp-field' }, h('span', null, t('note')), h('input', { value: note, onChange: (e) => setNote(e.target.value), maxLength: 200 })),
            h('div', { className: 'mk-actions' },
              h('button', { type: 'submit', className: 'lp-primary', disabled: busy }, saved ? t('saved') : t('save')),
              h('button', { type: 'button', className: 'lp-ghost', onClick: () => onRemove(item) }, h(Icon, { name: 'trash', size: 14 }), t('remove'))))));
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
      const [openKey, setOpenKey] = useState(null);
      const [colors, setColors] = useState(readColors);
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

      const flip = () => { const next = colors === 'cn' ? 'us' : 'cn'; setColors(next); try { localStorage.setItem(LS_COLOR, next); } catch { /* storage blocked */ } };
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
        try { await call({ action: 'remove', id: item.key }); setOpenKey(null); await load(); } catch (e) { setError(t('saveFailed', { error: e.message })); }
      };

      const items = (data && data.items) || [];
      const open = items.find((i) => i.key === openKey) || null;
      return h('div', { className: 'lp-root mk-root is-' + colors },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, t('eyebrow')), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'chart', value: items.length, label: t('statWatch'), tone: 'tone-brand' }),
              h(Stat, { icon: 'arrowup', value: data ? data.up : 0, label: t('statUp'), tone: 'mk-stat-up' }),
              h(Stat, { icon: 'arrowdown', value: data ? data.down : 0, label: t('statDown'), tone: 'mk-stat-down' }))),
          h(ErrorBar, { error, onRetry: () => load(true), retryLabel: t('retry'), onClose: () => setError(null) }),
          data && data.stale ? h('div', { className: 'lp-error', role: 'status' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, t('stale'))) : null,
          h('div', { className: 'mk-idx-row' }, !data ? [0, 1, 2, 3].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 78, borderRadius: 16 } })) : data.indices.map((i) => h(IndexCard, { key: i.key, i }))),
          h('form', { className: 'lp-bar mk-add', onSubmit },
            h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'search', size: 18 })),
            h('input', { className: 'lp-bar-input', value: input, onChange: (e) => setInput(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder') }),
            h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !input.trim() }, busy ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'search', size: 14 }), t('search'))),
          results ? h('section', { className: 'lp-card mk-results' },
            h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'search', className: 'lp-ico' }), t('search')), h('button', { type: 'button', className: 'lp-ghost', onClick: () => setResults(null) }, t('close'))),
            !results.length ? h(Empty, { icon: 'search', text: t('noResults') })
              : h('ul', { className: 'mk-hits' }, results.map((r) => h('li', { key: r.key, className: 'mk-hit' },
                h('div', { className: 'mk-hit-main' }, h('b', null, r.name), h('span', { className: 'lp-muted' }, r.code.toUpperCase() + ' · ' + t('mkt_' + (['sh', 'sz', 'bj'].includes(r.market) ? 'cn' : r.market)))),
                r.watched ? h('span', { className: 'lp-pill tone-success' }, h(Icon, { name: 'check', size: 12 }), t('watching'))
                  : h('button', { type: 'button', className: 'lp-primary mk-add-btn', disabled: addingKey === r.key, onClick: () => addSymbol(r.key, r.key) }, addingKey === r.key ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'plus', size: 14 }), t('add')))))) : null,
          h('div', { className: 'mk-listhead' },
            h('h2', { className: 'mk-h2' }, t('watchlist')),
            h('div', { className: 'mk-tools' },
              h('button', { type: 'button', className: 'lp-ghost', onClick: flip, title: t('colorCn') + ' / ' + t('colorUs') }, h('i', { className: 'mk-swatch' }), colors === 'cn' ? t('colorCn') : t('colorUs')),
              h('button', { type: 'button', className: 'lp-round', onClick: () => load(true), disabled: refreshing, title: t('refresh'), 'aria-label': t('refresh') }, h(Icon, { name: 'refresh', size: 16, className: refreshing ? 'lp-spin' : undefined })))),
          !data ? h('div', { className: 'lp-skel', style: { height: 220, borderRadius: 16 } })
            : !items.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'chart', text: t('empty') }, h('p', { className: 'lp-muted' }, t('emptyHint'))))
              : h('ul', { className: 'lp-card mk-list' }, items.map((it) => {
                const q = it.quote; const tone = q ? toneOf(q.pct) : 'flat';
                return h('li', { key: it.key },
                  h('button', { type: 'button', className: 'mk-row is-' + tone, onClick: () => setOpenKey(it.key) },
                    h('span', { className: 'mk-row-name' }, h('b', null, it.name), h('span', { className: 'lp-muted' }, (q ? q.code : it.key) + (it.note ? ' · ' + it.note : ''))),
                    h('span', { className: 'mk-row-pos' }, it.position ? h('span', { className: 'is-' + toneOf(it.position.profit) }, sign(it.position.profit) + fmt(it.position.profit, 0)) : null),
                    h('span', { className: 'mk-row-price' }, q ? fmtPrice(q) : '—'),
                    h('span', { className: 'mk-row-pct' }, q ? pctText(q.pct) : '—')));
              })),
          data ? h('p', { className: 'lp-muted mk-foot' }, t('updated', { t: new Date(data.at).toLocaleTimeString(t('dateLocale') === 'zh-CN' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }), '  ·  ', t('delayed')) : null,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        open ? h(Detail, { t, item: open, onClose: () => setOpenKey(null), onSaved: () => load(), onRemove: removeItem, onError: setError }) : null,
        h('style', null, KIT_CSS + CSS));
    }

    zh.dateLocale = 'zh-CN'; en.dateLocale = 'en-US';

    const CSS = [
      '.mk-root{--mk-up:var(' + ERR + ');--mk-down:var(' + OK + ');--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + ERR + ');--lp-amb-c:var(' + OK + ')}',
      '.mk-root.is-us{--mk-up:var(' + OK + ');--mk-down:var(' + ERR + ')}',
      '.mk-stat-up .lp-stat-icon,.mk-stat-up .lp-stat-num{color:' + UP + '}',
      '.mk-stat-down .lp-stat-icon,.mk-stat-down .lp-stat-num{color:' + DOWN + '}',
      '.mk-idx-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px}',
      '.mk-idx{padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.mk-idx-name{font-size:12px;color:' + FG2 + '}',
      '.mk-idx-price{font-size:18px;font-weight:650;font-variant-numeric:tabular-nums}',
      '.mk-idx-chg{font-size:12px;font-variant-numeric:tabular-nums;white-space:pre}',
      '.mk-idx.is-up .mk-idx-price,.mk-idx.is-up .mk-idx-chg{color:' + UP + '}',
      '.mk-idx.is-down .mk-idx-price,.mk-idx.is-down .mk-idx-chg{color:' + DOWN + '}',
      '.mk-add{margin-bottom:14px}',
      '.mk-results{margin-bottom:14px}',
      '.mk-hits{list-style:none;margin:0;padding:0;max-height:360px;overflow:auto}',
      '.mk-hit{display:flex;align-items:center;gap:12px;padding:9px 6px;border-top:1px solid var(--lp-glass-edge)}',
      '.mk-hit:first-child{border-top:0}',
      '.mk-hit-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.mk-add-btn{height:30px;padding:0 12px}',
      '.mk-listhead{display:flex;align-items:center;justify-content:space-between;margin:6px 2px 10px}',
      '.mk-h2{margin:0;font-size:15px;font-weight:650}',
      '.mk-tools{display:flex;align-items:center;gap:8px}',
      '.mk-swatch{display:inline-block;width:14px;height:14px;border-radius:50%;background:linear-gradient(90deg,' + UP + ' 50%,' + DOWN + ' 50%)}',
      '.mk-list{list-style:none;margin:0;padding:6px}',
      '.mk-list li+li{border-top:1px solid var(--lp-glass-edge)}',
      '.mk-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto 96px 92px;align-items:center;gap:12px;padding:12px 10px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:left;cursor:pointer;font-variant-numeric:tabular-nums}',
      '.mk-row:hover{' + GLASS_SOFT + '}',
      '.mk-row:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:-2px}',
      '.mk-row-name{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.mk-row-name b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mk-row-name .lp-muted{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mk-row-pos{font-size:12px;text-align:right;min-width:44px}',
      '.mk-row-pos .is-up{color:' + UP + '}',
      '.mk-row-pos .is-down{color:' + DOWN + '}',
      '.mk-row-price{font-size:15px;font-weight:600;text-align:right}',
      '.mk-row-pct{font-size:13px;font-weight:600;text-align:center;padding:5px 0;border-radius:8px;background:' + tint(IDLE, 22) + '}',
      '.mk-row.is-up .mk-row-price{color:' + UP + '}',
      '.mk-row.is-down .mk-row-price{color:' + DOWN + '}',
      '.mk-row.is-up .mk-row-pct{background:' + UP + ';color:#fff}',
      '.mk-row.is-down .mk-row-pct{background:' + DOWN + ';color:#fff}',
      '@media (max-width:640px){.mk-row{grid-template-columns:minmax(0,1fr) 84px 76px}.mk-row-pos{display:none}}',
      '.mk-foot{margin:12px 2px 0;font-size:11.5px;line-height:17px}',
      '.mk-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45);' + GLASS_BLUR + '}',
      '.mk-sheet{width:min(560px,100%);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:22px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 30px 80px -20px rgba(0,0,0,.55)}',
      '.mk-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
      '.mk-sheet-title{margin:0;font-size:18px}',
      '.mk-sheet-price{display:flex;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums;font-size:14px;font-weight:600}',
      '.mk-sheet-price.is-up{color:' + UP + '}',
      '.mk-sheet-price.is-down{color:' + DOWN + '}',
      '.mk-big{font-size:30px;font-weight:700}',
      '.mk-spark{display:block;width:100%;height:140px}',
      '.mk-chart-foot{display:flex;justify-content:space-between;font-size:11px;margin-top:4px}',
      '.mk-chart-note{padding:44px 0;text-align:center}',
      '.mk-range{display:flex;gap:6px}',
      '.mk-range .lp-ghost.is-on{color:var(' + BRAND + ');border-color:' + tint(BRAND, 40) + '}',
      '.mk-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px 14px;margin:0}',
      '.mk-facts div{display:flex;flex-direction:column;gap:2px}',
      '.mk-facts dt{font-size:11.5px;color:' + FG2 + '}',
      '.mk-facts dd{margin:0;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.mk-pos{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--lp-glass-edge)}',
      '.mk-pos-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.mk-pnl{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.mk-pnl.is-up{color:' + UP + '}',
      '.mk-pnl.is-down{color:' + DOWN + '}',
      '.mk-actions{display:flex;justify-content:space-between;align-items:center}',
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
