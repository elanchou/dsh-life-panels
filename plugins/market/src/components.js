    function Detail(props) {
      const { t, item, watched, onSaved, onRemove, onAdd, onError } = props;
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
      useEffect(() => { setShares(item.shares ? String(item.shares) : ''); setCost(item.cost ? String(item.cost) : ''); setNote(item.note || ''); }, [item.key]);
      const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try { await call({ action: 'update', id: item.key, shares: shares.trim(), cost: cost.trim(), note }); setSaved(true); setTimeout(() => setSaved(false), 1500); onSaved(); }
        catch (err) { onError(t('saveFailed', { error: err.message })); } finally { setBusy(false); }
      };
      const facts = !q ? [] : q.kind === 'crypto'
        ? [[t('rank'), '#' + (q.rank || '—')], [t('cap'), '$' + compact(q.cap)], [t('volume'), '$' + compact(q.volume)], [t('h1'), pctText(q.pct1h)], [t('h24'), pctText(q.pct)], [t('d7'), pctText(q.pct7d)]]
        : [[t('prev'), fmt(q.prev, priceDigits(q.prev))], [t('open'), fmt(q.open, priceDigits(q.open))], [t('hi'), fmt(q.high, priceDigits(q.high))], [t('lo'), fmt(q.low, priceDigits(q.low))]];
      const pos = item.position;
      return h('section', { className: 'mkd-panel' },
        h('div', { className: 'mkd-ph' },
          h('div', null, h('div', { className: 'mkd-big' }, nameOf(t, item)), h('div', { className: 'mkd-mu' }, (q ? q.code : item.key) + (q && q.currency ? ' · ' + q.currency : ''))),
          h('div', { className: 'mkd-r' },
            h('div', { className: 'mkd-big mkd-num' }, fmtPrice(q)),
            q ? h('div', { className: 'mkd-num ' + tone(q.pct) }, sign(q.change) + fmt(q.change, q.kind === 'fx' ? 4 : priceDigits(q.price)) + '  (' + pctText(q.pct) + ')') : null)),
        h('div', { className: 'mkd-seg', role: 'group' }, [20, 60, 120, 250].map((n) => h('button', { key: n, type: 'button', 'aria-pressed': days === n, onClick: () => setDays(n) }, n + 'd'))),
        hist === null ? h('div', { className: 'mkd-err' }, '…') : hist === false ? h('div', { className: 'mkd-err' }, t('histFail')) : hist.length < 2 ? h('div', { className: 'mkd-err' }, t('histNone')) : h(Chart, { candles: hist }),
        facts.length ? h('div', { className: 'mkd-stats mkd-num' }, facts.map(([k, v]) => h('div', { key: k }, h('span', null, k), v))) : null,
        watched
          ? h('form', { className: 'mkd-pos', onSubmit: save },
            h('b', null, t('position')),
            h('div', { className: 'mkd-pos-row' },
              h('label', null, t('shares'), h('input', { className: 'mkd-in', inputMode: 'decimal', value: shares, onChange: (e) => setShares(e.target.value), placeholder: '0' })),
              h('label', null, t('cost') + (q && q.currency ? ' (' + q.currency + ')' : ''), h('input', { className: 'mkd-in', inputMode: 'decimal', value: cost, onChange: (e) => setCost(e.target.value), placeholder: '0.00' }))),
            pos ? h('div', { className: 'mkd-pnl mkd-num ' + tone(pos.profit) }, h('span', null, t('value') + ' ' + money(pos.value, pos.currency)), h('span', null, t('profit') + ' ' + sign(pos.profit) + money(pos.profit, pos.currency) + ' (' + pctText(pos.pct) + ')')) : null,
            h('label', null, t('note'), h('input', { className: 'mkd-in', value: note, onChange: (e) => setNote(e.target.value), maxLength: 200 })),
            h('div', { className: 'mkd-pos-act' },
              h('button', { className: 'mkd-btn', type: 'submit', disabled: busy }, saved ? t('saved') : t('save')),
              h('button', { className: 'mkd-btn', type: 'button', onClick: () => onRemove(item) }, t('remove'))))
          : h('div', { className: 'mkd-pos-act', style: { marginTop: 12 } }, h('button', { className: 'mkd-btn', type: 'button', onClick: () => onAdd(item.key) }, t('add'))));
    }

    function QuoteRows(props) {
      const { t, rows, selected, select, extra } = props;
      return h('table', { className: 'mkd-tbl' },
        h('thead', null, h('tr', null, h('th', null, t('symbol')), h('th', { className: 'mkd-r' }, t('last')), h('th', { className: 'mkd-r' }, t('change')), extra ? h('th', { className: 'mkd-r' }, extra.head) : null)),
        h('tbody', null, rows.map((it) => {
          const q = it.quote;
          return h('tr', { key: it.key, tabIndex: 0, 'aria-selected': it.key === selected, onClick: () => select(it.key), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(it.key); } } },
            h('td', null, h('b', null, nameOf(t, it)), h('span', { className: 'mkd-nm' }, (q ? q.code : it.key) + (it.note ? ' · ' + it.note : ''))),
            h('td', { className: 'mkd-r mkd-num' }, q ? fmtPrice(q) : t('noData')),
            h('td', { className: 'mkd-r mkd-num ' + (q ? tone(q.pct) : '') }, q ? pctText(q.pct) : ''),
            extra ? h('td', { className: 'mkd-r mkd-num ' + (extra.tone ? extra.tone(it) : '') }, extra.cell(it)) : null);
        })));
    }

    function Watch(props) {
      const { t, items, selected, select, onAdd } = props;
      const [text, setText] = useState('');
      const [busy, setBusy] = useState(false);
      const [hits, setHits] = useState(null);
      const [error, setError] = useState('');
      const submit = async (e) => {
        e.preventDefault();
        const v = text.trim();
        if (!v || busy) return;
        setBusy(true); setError('');
        try { setHits((await call({ action: 'search', query: v })).results); } catch (err) { setError(t('loadFailed', { error: err.message })); } finally { setBusy(false); }
      };
      const add = async (key) => {
        setBusy(true);
        const failure = await onAdd(key);
        setBusy(false);
        if (failure) setError(failure); else { setHits(null); setText(''); }
      };
      return h('section', { className: 'mkd-panel' },
        h('div', { className: 'mkd-ph' }, h('b', null, t('watchlist')),
          h('form', { className: 'mkd-form', onSubmit: submit },
            h('input', { className: 'mkd-in', value: text, placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder'), onChange: (e) => { setText(e.target.value); setError(''); }, autoComplete: 'off', spellCheck: false }),
            h('button', { className: 'mkd-btn', type: 'submit', disabled: busy }, t('search')))),
        error ? h('div', { className: 'mkd-addErr', role: 'alert' }, error) : null,
        hits ? h('ul', { className: 'mkd-hits' },
          !hits.length ? h('li', { className: 'mkd-mu' }, t('noResults')) : hits.map((r) => h('li', { key: r.key },
            h('span', null, h('b', null, nameOf(t, r)), h('span', { className: 'mkd-nm' }, r.code)),
            r.watched ? h('span', { className: 'mkd-mu' }, t('watching')) : h('button', { className: 'mkd-btn', type: 'button', disabled: busy, onClick: () => add(r.key) }, t('add'))))) : null,
        items.length
          ? h(QuoteRows, { t, rows: items, selected, select, extra: { head: t('profit'), cell: (it) => (it.position ? sign(it.position.profit) + money(it.position.profit, it.position.currency) : ''), tone: (it) => (it.position ? tone(it.position.profit) : '') } })
          : h('div', { className: 'mkd-err' }, t('empty')));
    }

    function GlobeHero(props) {
      const { t, exchanges, selectedEx, onPick } = props;
      const ref = useRef(null);
      const api = useRef(null);
      const pick = useRef(onPick); pick.current = onPick;
      const [failed, setFailed] = useState(false);
      const ranked = exchanges.filter((e) => e.quote && e.quote.pct !== null).slice().sort((a, b) => b.quote.pct - a.quote.pct);
      const upCount = ranked.filter((e) => e.quote.pct >= 0).length;
      const maxAbs = Math.max(0.5, ...ranked.map((e) => Math.abs(e.quote.pct)));
      const markers = (list) => list.map((e) => ({ symbol: e.id, lat: e.lat, lon: e.lon, name: isZh(t) ? e.cityZh : e.city, pct: e.quote && e.quote.pct !== null ? e.quote.pct : null }));
      useEffect(() => {
        let dead = false; let g = null;
        loadGlobe().then((lib) => {
          if (dead || !ref.current) return;
          g = lib.createGlobe(ref.current, { onSelect: (id) => pick.current(id) });
          if (!g) { setFailed(true); return; }
          api.current = g;
          g.setData(markers(exchanges), selectedEx || '');
        }).catch(() => { if (!dead) setFailed(true); });
        return () => { dead = true; api.current = null; if (g) g.dispose(); };
      }, []);
      useEffect(() => { if (api.current) api.current.setData(markers(exchanges), selectedEx || ''); }, [exchanges, selectedEx, t]);
      if (failed) return h('div', { className: 'mkd-note' }, t('noWebgl'));
      return h('div', { className: 'mkd-hero' },
        h('div', { className: 'mkd-hero-globe', ref }),
        h('div', { className: 'mkd-side' },
          h('div', { className: 'mkd-side-h' },
            h('b', null, t('listTitle')),
            h('div', { className: 'mkd-split' },
              h('i', { style: { width: (ranked.length ? upCount / ranked.length * 100 : 0) + '%' } }),
              h('i', { style: { width: (ranked.length ? (ranked.length - upCount) / ranked.length * 100 : 0) + '%' } })),
            h('div', { className: 'mkd-split-l' },
              h('span', { className: 'mkd-up' }, t('advancing') + ' ' + upCount),
              h('span', { className: 'mkd-dn' }, t('declining') + ' ' + (ranked.length - upCount)))),
          h('div', { className: 'mkd-side-rows' }, ranked.map((e, i) => {
            const dir = e.quote.pct >= 0 ? 'mkd-up' : 'mkd-dn';
            return h('button', { key: e.id, type: 'button', className: 'mkd-row', 'aria-pressed': e.id === selectedEx, onClick: () => pick.current(e.id) },
              h('span', { className: 'mkd-row-n' }, i + 1),
              h('div', { className: 'mkd-row-t' }, h('span', null, isZh(t) ? e.cityZh : e.city), h('em', null, fmtPrice(e.quote) + ' · ' + t('state_' + e.state))),
              h('span', { className: 'mkd-pill ' + dir }, pctText(e.quote.pct)),
              h('div', { className: 'mkd-row-bar ' + dir }, h('i', { style: { width: Math.max(4, Math.abs(e.quote.pct) / maxAbs * 100) + '%' } })));
          }))),
        h('div', { className: 'mkd-hero-hint' }, t('globeHint')));
    }
