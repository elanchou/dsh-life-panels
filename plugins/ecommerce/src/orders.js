
    function OrderForm(props) {
      const { t, products, onSave, onCancel, busy } = props;
      const [f, setF] = useState({ sku: products[0] ? products[0].sku : '', platform: 'amazon', market: '', qty: '1', price: '', currency: '', date: todayStr(), ref: '', fee: '' });
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const submit = () => onSave({ action: 'add_order', sku: f.sku, platform: f.platform, market: f.market.toUpperCase() || undefined, qty: numOrU(f.qty), price: numOrU(f.price), currency: f.currency.toUpperCase() || undefined, date: f.date, ref: f.ref || undefined, fee: numOrU(f.fee) });
      return h('div', { className: 'lp-card ec-form' },
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('product') }, h(Select, { value: f.sku, label: t('product'), onChange: set('sku'), options: products.map((p) => [p.sku, p.sku + ' · ' + p.title]) })),
          h(Field, { label: t('platform') }, h(Select, { value: f.platform, label: t('platform'), onChange: set('platform'), options: PLATFORMS.map((p) => [p, PLATFORM_NAME[p] || t('other')]) })),
          h(Field, { label: t('market'), value: f.market, onChange: set('market'), max: 12 }),
          h(Field, { label: t('date') }, h('input', { type: 'date', className: 'lp-input', value: f.date, onChange: (e) => set('date')(e.target.value) })),
          h(Field, { label: t('qty'), value: f.qty, onChange: set('qty'), num: true }),
          h(Field, { label: t('unitPriceOpt'), value: f.price, onChange: set('price'), num: true }),
          h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5, placeholder: t('fromListing') }),
          h(Field, { label: t('orderRef'), value: f.ref, onChange: set('ref'), max: 60 }),
          h(Field, { label: t('actualFee'), value: f.fee, onChange: set('fee'), num: true, placeholder: t('estimated') })),
        h('div', { className: 'ec-form-actions' },
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !f.sku || !(Number(f.qty) > 0), onClick: submit }, t('save')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onCancel }, t('cancel'))));
    }

    function ImportBox(props) {
      const { t, onDone, setError, platform } = props;
      const [csv, setCsv] = useState('');
      const [plat, setPlat] = useState(platform || 'amazon');
      const [res, setRes] = useState(null);
      const [run, busy] = useAction(setError);
      const file = (e) => { const fl = e.target.files && e.target.files[0]; if (!fl) return; const rd = new FileReader(); rd.onload = () => { setCsv(String(rd.result || '')); setRes(null); }; rd.readAsText(fl); };
      const go = async (dry) => { const r = await run({ action: 'import_orders', csv, platform: plat, dryRun: dry }); if (r) { setRes(r); if (!dry && r.added) onDone(); } };
      return h('div', { className: 'lp-card ec-form' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'upload', size: 15, className: 'lp-ico' }), t('importOrders'))),
        h('p', { className: 'lp-muted ec-note' }, t('importHelp')),
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('platform') }, h(Select, { value: plat, label: t('platform'), onChange: setPlat, options: PLATFORMS.map((p) => [p, PLATFORM_NAME[p] || t('other')]) })),
          h(Field, { label: t('csvFile') }, h('input', { type: 'file', accept: '.csv,.tsv,.txt', className: 'lp-input', onChange: file }))),
        h('textarea', { className: 'lp-textarea ec-csv', value: csv, onChange: (e) => { setCsv(e.target.value); setRes(null); }, placeholder: t('csvPaste') }),
        h('div', { className: 'ec-form-actions' },
          h('button', { type: 'button', className: 'lp-ghost', disabled: busy || !csv.trim(), onClick: () => go(true) }, t('preview')),
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !csv.trim(), onClick: () => go(false) }, t('importNow'))),
        res ? h('div', { className: 'ec-import-res' },
          h('b', null, (res.dryRun ? t('wouldAdd') : t('imported')) + ' ' + res.added + ' / ' + res.rows),
          res.duplicates ? h('span', { className: 'lp-muted' }, t('dupes', { n: res.duplicates })) : null,
          Object.keys(res.unknownSkus).length ? h('div', { className: 'ec-warn' }, t('unknownSkus') + ' ' + Object.entries(res.unknownSkus).map(([k, v]) => k + ' ×' + v).join(', ')) : null,
          res.skipped.length ? h('div', { className: 'lp-muted' }, t('skipped') + ': ' + res.skipped.slice(0, 5).map((s) => '#' + s.line + ' ' + s.reason).join('; ') + (res.skipped.length > 5 ? ' …' : '')) : null,
          h('div', { className: 'lp-muted' }, t('mapped') + ': ' + Object.entries(res.mapped).map(([k, v]) => k + '=' + v).join(', '))) : null);
    }

    function OrdersTab(props) {
      const { t, setError } = props;
      const loc = t('dateLocale');
      const [days, setDays] = useState(30);
      const [status, setStatus] = useState('');
      const [query, setQuery] = useState('');
      const [data, setData] = useState(null);
      const [products, setProducts] = useState([]);
      const [mode, setMode] = useState(null); // 'add' | 'import'
      const [run, busy] = useAction(setError);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try {
          const [o, p] = await Promise.all([call({ action: 'list_orders', ...rangeOf(days), status: status || undefined, query: query || undefined, limit: 500 }), call({ action: 'list', limit: 500 })]);
          if (alive.current) { setData(o); setProducts(p.items); }
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [days, status, query, t, setError]);
      useEffect(() => { alive.current = true; const id = setTimeout(load, query ? 250 : 0); return () => { alive.current = false; clearTimeout(id); }; }, [load, query]);
      const act = async (req) => { const r = await run(req); if (r) { setMode(null); load(); } };
      const exportCsv = async () => { const r = await run({ action: 'export_orders', ...rangeOf(days) }); if (r) download('orders-' + todayStr() + '.csv', r.csv); };
      const items = (data && data.items) || [];
      const total = items.reduce((a, o) => a + o.finance.profitCny, 0);
      return h('div', { className: 'ec-page' },
        h('div', { className: 'ec-bar' },
          h(Tabs, { value: String(days), onChange: (v) => setDays(Number(v)), items: [{ id: '7', label: t('d7') }, { id: '30', label: t('d30') }, { id: '90', label: t('d90') }] }),
          h(Select, { value: status, label: t('status'), onChange: setStatus, options: [['', t('allStatus')], ...ORDER_STATUS.map((s) => [s, t('os_' + s)])] }),
          h('label', { className: 'lp-field ec-search' }, h(Icon, { name: 'search', size: 14 }), h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('searchOrders'), 'aria-label': t('searchOrders') })),
          h('span', { className: 'ec-spacer' }),
          h('button', { type: 'button', className: 'lp-ghost', onClick: exportCsv }, h(Icon, { name: 'download', size: 13 }), t('exportCsv')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: () => setMode(mode === 'import' ? null : 'import') }, h(Icon, { name: 'upload', size: 13 }), t('importOrders')),
          h('button', { type: 'button', className: 'lp-primary', disabled: !products.length, onClick: () => setMode(mode === 'add' ? null : 'add'), title: products.length ? '' : t('needProduct') }, h(Icon, { name: 'plus', size: 14 }), t('addOrder'))),
        mode === 'add' ? h(OrderForm, { t, products, busy, onSave: act, onCancel: () => setMode(null) }) : null,
        mode === 'import' ? h(ImportBox, { t, setError, onDone: load }) : null,
        !data ? h('div', { className: 'lp-skel', style: { height: 80, borderRadius: 12 } })
          : !items.length ? h(Empty, { icon: 'cart', text: t('emptyOrders') })
            : h('div', { className: 'lp-card ec-table-wrap' },
              h('table', { className: 'ec-table' },
                h('thead', null, h('tr', null, ['date', 'orderRef', 'sku', 'platform', 'qty', 'unitPrice', 'status', 'profit', ''].map((k, i) => h('th', { key: i, className: k === 'profit' || k === 'qty' || k === 'unitPrice' ? 'is-num' : '' }, k ? t(k) : '')))),
                h('tbody', null, items.map((o) => h('tr', { key: o.id, className: o.status !== 'paid' ? 'is-dim' : '' },
                  h('td', null, o.date), h('td', null, o.ref || '—'), h('td', null, o.sku), h('td', null, platName(o.platform, t) + (o.market ? ' · ' + o.market : '')),
                  h('td', { className: 'is-num' }, o.qty), h('td', { className: 'is-num' }, money(o.price, o.currency, loc)),
                  h('td', null, h(Select, { value: o.status, label: t('status'), onChange: (v) => act({ action: 'update_order', orderId: o.id, status: v, restocked: v === 'returned' ? window.confirm(t('restockAsk')) : undefined }), options: ORDER_STATUS.map((s) => [s, t('os_' + s)]) })),
                  h('td', { className: 'is-num ' + (o.finance.profitCny < 0 ? 'is-neg' : '') }, o.status === 'cancelled' ? '—' : cny(o.finance.profitCny, loc, 2), o.rateSource === 'latest' ? h('span', { className: 'ec-flag', title: t('rateLatest') }, '*') : null),
                  h('td', null, h(Confirm, { label: t('del'), cancel: t('cancel'), text: t('confirmDelOrder'), onYes: () => act({ action: 'remove_order', orderId: o.id }) })))))),
              h('div', { className: 'ec-table-foot lp-muted' }, t('ordersShown', { n: data.matched }) + ' · ' + t('profit') + ' ' + cny(total, loc, 2))));
    }
