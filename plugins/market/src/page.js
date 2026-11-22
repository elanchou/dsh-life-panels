    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [refreshing, setRefreshing] = useState(false);
      const [selected, setSelected] = useState('x:100.SPX');
      const [selectedEx, setSelectedEx] = useState('nyse');
      const [tab, setTab] = useState('indices');
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

      const flip = (next) => { setColors(next); try { localStorage.setItem(LS_COLOR, next); } catch { /* storage blocked */ } };
      const items = (data && data.items) || [];
      const exchanges = (data && data.exchanges) || [];
      const cryptoRows = useMemo(() => ((data && data.crypto) || []).map((q) => ({ key: q.key, kind: 'crypto', name: q.name, nameEn: q.nameEn, quote: q })), [data]);
      const rowOf = useMemo(() => {
        const m = new Map();
        if (data) for (const r of [...data.headline, ...data.indices, ...data.macro, ...cryptoRows, ...items]) m.set(r.key, r);
        return m;
      }, [data, cryptoRows, items]);
      const watched = items.find((i) => i.key === selected) || null;
      const sheet = watched || rowOf.get(selected) || { key: selected, name: selected, nameEn: selected, kind: 'stock', quote: null };

      const select = (key) => {
        setSelected(key);
        const ex = exchanges.find((e) => e.index === key);
        if (ex) setSelectedEx(ex.id);
      };
      const pickExchange = (id) => {
        setSelectedEx(id);
        const ex = exchanges.find((e) => e.id === id);
        if (ex) setSelected(ex.index);
      };
      const addSymbol = async (key) => {
        try { await call({ action: 'add', symbol: key }); await load(); return ''; }
        catch (e) { return t('saveFailed', { error: e.message }); }
      };
      const removeItem = async (item) => {
        try { await call({ action: 'remove', id: item.key }); await load(); } catch (e) { setError(t('saveFailed', { error: e.message })); }
      };

      const tabs = [['indices', t('indices')], ['macro', t('macro')]];
      const listRows = tab === 'indices' ? (data ? data.indices : []) : (data ? data.macro : []);
      const headline = (data && data.headline) || [];
      const at = data ? new Date(data.at).toLocaleTimeString(isZh(t) ? 'zh-CN' : 'en-US', { hour12: false }) : '';

      return h('div', { className: 'mkd', 'data-colors': colors === 'down' ? 'down' : 'up' },
        h('style', null, CSS + CSS2),
        h('div', { className: 'mkd-wrap' },
          h('header', { className: 'mkd-head' },
            h('div', null, h('h2', { className: 'mkd-title' }, t('title')), h('p', { className: 'mkd-sub' }, t('subtitle') + (at ? ' · ' + t('updated', { t: at }) : '') + (data ? ' · ' + t('openNow', { n: data.openCount }) : ''))),
            h('div', { className: 'mkd-bar' },
              h('div', { className: 'mkd-seg', role: 'group', 'aria-label': t('colorTitle'), title: t('colorTitle') },
                [['up', 'colorUp'], ['down', 'colorDown']].map(([c, k]) => h('button', { key: c, type: 'button', 'aria-pressed': colors === c, onClick: () => flip(c) }, t(k)))),
              h('button', { className: 'mkd-btn', type: 'button', disabled: refreshing, onClick: () => load(true) }, t('refresh')))),
          error ? h('div', { className: 'mkd-bad', role: 'alert' }, h('span', null, error), h('button', { type: 'button', onClick: () => load(true) }, t('retry'))) : null,
          data && data.stale ? h('div', { className: 'mkd-note' }, t('stale')) : null,
          !data ? h('div', { className: 'mkd-err' }, '…') : h(React.Fragment, null,
            h(GlobeHero, { t, exchanges, selectedEx, onPick: pickExchange }),
            h('div', { className: 'mkd-idx' }, headline.map((r) => h('button', { key: r.key, type: 'button', className: 'mkd-card', 'aria-pressed': r.key === selected, onClick: () => select(r.key) },
              h('div', { className: 'mkd-cn' }, nameOf(t, r)),
              h('div', { className: 'mkd-cp mkd-num' }, fmtPrice(r.quote)),
              h('div', { className: 'mkd-num ' + (r.quote ? tone(r.quote.pct) : '') }, r.quote ? pctText(r.quote.pct) : '\u00a0')))),
            h('div', { className: 'mkd-cols' },
              h('div', { className: 'mkd-col' },
                h(Detail, { key: sheet.key, t, item: sheet, watched: !!watched, onSaved: () => load(), onRemove: removeItem, onAdd: async (k) => { const f = await addSymbol(k); if (f) setError(f); }, onError: setError }),
                h('section', { className: 'mkd-panel' },
                  h('div', { className: 'mkd-ph' }, h('div', { className: 'mkd-seg', role: 'tablist' }, tabs.map(([k, label]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-pressed': tab === k, onClick: () => setTab(k) }, label)))),
                  h(QuoteRows, { t, rows: listRows, selected, select }))),
              h('div', { className: 'mkd-col' },
                h(Watch, { t, items, selected, select, onAdd: addSymbol }),
                h('section', { className: 'mkd-panel' },
                  h('div', { className: 'mkd-ph' }, h('b', null, t('crypto')), h('span', { className: 'mkd-mu' }, t('crypto24h'))),
                  h(QuoteRows, { t, rows: cryptoRows, selected, select }))))),
          h('p', { className: 'mkd-foot' }, t('delayed')),
          h('p', { className: 'mkd-foot' }, t('hint'))));
    }
