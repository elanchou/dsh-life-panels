
    function GroupTable(props) {
      const { t, rows, label } = props;
      const loc = t('dateLocale');
      if (!rows.length) return null;
      return h('div', { className: 'lp-card ec-table-wrap' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, label)),
        h('table', { className: 'ec-table' },
          h('thead', null, h('tr', null, [label, t('orders'), t('units'), t('netRevenue'), t('productCost'), t('feesCol'), t('profit'), t('margin')].map((x, i) => h('th', { key: i, className: i ? 'is-num' : '' }, x)))),
          h('tbody', null, rows.map((r) => h('tr', { key: r.key },
            h('td', null, props.name ? props.name(r.key) : r.key), h('td', { className: 'is-num' }, r.orders), h('td', { className: 'is-num' }, r.units), h('td', { className: 'is-num' }, cny(r.netCny, loc)),
            h('td', { className: 'is-num' }, cny(r.costCny, loc)), h('td', { className: 'is-num' }, cny(r.feeCny, loc)),
            h('td', { className: 'is-num ' + (r.profitCny < 0 ? 'is-neg' : '') }, cny(r.profitCny, loc)), h('td', { className: 'is-num' }, r.marginPct === null ? '—' : r.marginPct + '%'))))));
    }

    function CostForm(props) {
      const { t, products, onSave, busy } = props;
      const [f, setF] = useState({ kind: 'ads', amount: '', currency: 'CNY', date: todayStr(), productId: '', platform: '', note: '' });
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      return h('div', { className: 'lp-card ec-form' },
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('kind') }, h(Select, { value: f.kind, label: t('kind'), onChange: set('kind'), options: COST_KINDS.map((k) => [k, t('ck_' + k)]) })),
          h(Field, { label: t('amount'), value: f.amount, onChange: set('amount'), num: true }),
          h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5 }),
          h(Field, { label: t('date') }, h('input', { type: 'date', className: 'lp-input', value: f.date, onChange: (e) => set('date')(e.target.value) })),
          h(Field, { label: t('product') }, h(Select, { value: f.productId, label: t('product'), onChange: set('productId'), options: [['', t('none')], ...products.map((p) => [p.sku, p.sku])] })),
          h(Field, { label: t('platform') }, h(Select, { value: f.platform, label: t('platform'), onChange: set('platform'), options: [['', t('none')], ...PLATFORMS.map((p) => [p, PLATFORM_NAME[p] || t('other')])] })),
          h(Field, { label: t('note'), value: f.note, onChange: set('note'), wide: true, max: 300 })),
        h('div', { className: 'ec-form-actions' },
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !(Number(f.amount) > 0), onClick: () => onSave({ action: 'add_cost', kind: f.kind, amount: Number(f.amount), currency: f.currency.toUpperCase(), date: f.date, productId: f.productId || undefined, platform: f.platform || undefined, note: f.note || undefined }) }, t('save'))));
    }

    function FinanceTab(props) {
      const { t, setError } = props;
      const loc = t('dateLocale');
      const [days, setDays] = useState(30);
      const [rep, setRep] = useState(null);
      const [costs, setCosts] = useState(null);
      const [products, setProducts] = useState([]);
      const [adding, setAdding] = useState(false);
      const [run, busy] = useAction(setError);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try {
          const range = rangeOf(days);
          const [r, c, p] = await Promise.all([call({ action: 'report', ...range }), call({ action: 'list_costs', ...range }), call({ action: 'list', limit: 500 })]);
          if (alive.current) { setRep(r); setCosts(c); setProducts(p.items); }
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [days, t, setError]);
      useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
      const act = async (req) => { const r = await run(req); if (r) { setAdding(false); load(); } };
      if (!rep) return h('div', { className: 'lp-skel', style: { height: 120, borderRadius: 14 } });
      const kinds = Object.entries(rep.otherCostsByKind);
      return h('div', { className: 'ec-page' },
        h('div', { className: 'ec-bar' }, h(Tabs, { value: String(days), onChange: (v) => setDays(Number(v)), items: [{ id: '7', label: t('d7') }, { id: '30', label: t('d30') }, { id: '90', label: t('d90') }] }), h('span', { className: 'lp-muted' }, rep.from + ' → ' + rep.to)),
        h('div', { className: 'lp-card ec-pnl' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'chart', size: 15, className: 'lp-ico' }), t('pnl'))),
          h('dl', { className: 'ec-dl ec-pnl-dl' },
            [[t('revenueGross'), cny(rep.revenueCny, loc), ''], [t('netRevenue'), cny(rep.netRevenueCny, loc), ''], [t('productCost'), '− ' + cny(rep.productCostCny, loc), ''], [t('platformFees'), '− ' + cny(rep.platformFeesCny, loc), ''],
              [t('fulfilCol'), '− ' + cny(rep.fulfilCny, loc), ''], [t('orderProfit'), cny(rep.orderProfitCny, loc), 'is-strong'], [t('otherCosts'), '− ' + cny(rep.otherCostsCny, loc), ''],
              [t('netProfit'), cny(rep.profitCny, loc), 'is-strong ' + (rep.profitCny < 0 ? 'is-neg' : 'is-pos')], [t('margin'), rep.marginPct === null ? '—' : rep.marginPct + '%', ''],
              [t('orders'), rep.orders + ' (' + rep.units + ' ' + t('unitsShort') + ')', ''], [t('returnRate'), rep.returnRatePct + '%', ''], [t('avgOrder'), cny(rep.avgOrderCny, loc, 2), '']]
              .map(([k, v, cls]) => h('div', { key: k, className: cls }, h('dt', { className: 'lp-muted' }, k), h('dd', null, v))))),
        h(GroupTable, { t, rows: rep.byPlatform, label: t('platform'), name: (k) => platName(k, t) }),
        h(GroupTable, { t, rows: rep.byMarket, label: t('market'), name: (k) => (k === '—' ? t('none') : k) }),
        h(GroupTable, { t, rows: rep.byProduct, label: t('product') }),
        h('div', { className: 'lp-card' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'wallet', size: 15, className: 'lp-ico' }), t('otherCosts') + ' · ' + cny(costs.totalCny, loc)),
            h('button', { type: 'button', className: 'lp-ghost', onClick: () => setAdding(!adding) }, h(Icon, { name: 'plus', size: 14 }), t('addCost'))),
          kinds.length ? h('div', { className: 'ec-chips' }, kinds.map(([k, v]) => h('span', { key: k, className: 'lp-pill' }, t('ck_' + k) + ' ' + cny(v, loc)))) : null,
          adding ? h(CostForm, { t, products, busy, onSave: act }) : null,
          !costs.items.length ? h('p', { className: 'lp-muted ec-note' }, t('emptyCosts'))
            : h('ul', { className: 'ec-costs' }, costs.items.map((x) => h('li', { key: x.id },
              h('span', { className: 'lp-muted' }, x.date), h('b', null, t('ck_' + x.kind)), h('span', { className: 'lp-muted' }, [x.productId ? (products.find((p) => p.id === x.productId) || {}).sku : '', x.platform ? platName(x.platform, t) : '', x.note].filter(Boolean).join(' · ')),
              h('span', { className: 'ec-spacer' }), h('span', null, x.currency !== 'CNY' ? money(x.amount, x.currency, loc) + '  ' : '', cny(x.amountCny, loc, 2)),
              h(Confirm, { label: t('del'), cancel: t('cancel'), text: t('confirmDelCost'), onYes: () => act({ action: 'remove_cost', costId: x.id }) }))))));
    }

    function CalcTab(props) {
      const { t, products, setError } = props;
      const [f, setF] = useState({ id: '', price: '', currency: 'USD', costCny: '', weightG: '', shippingCny: '', dutyPct: '', vatPct: '0', platformFeePct: '15', payFeePct: '0', fulfilFee: '', adPct: '', returnPct: '', rate: '', target: '20' });
      const [out, setOut] = useState(null);
      const [run, busy] = useAction(setError);
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const req = (action) => ({
        action, id: f.id || undefined, price: numOrU(f.price), currency: f.currency.toUpperCase(), vatPct: numOrU(f.vatPct), platformFeePct: numOrU(f.platformFeePct), payFeePct: numOrU(f.payFeePct),
        fulfilFee: numOrU(f.fulfilFee), adPct: numOrU(f.adPct), returnPct: numOrU(f.returnPct), rate: numOrU(f.rate), targetMarginPct: numOrU(f.target),
        ...(f.id ? {} : { costCny: numOrU(f.costCny), weightG: numOrU(f.weightG), shippingCny: numOrU(f.shippingCny), dutyPct: numOrU(f.dutyPct) }),
      });
      const go = async (action) => {
        const r = await run(req(action));
        if (!r) { setOut(null); return; }
        if (action === 'price_for') setF((x) => ({ ...x, price: String(r.price) }));
        setOut({ ...r.result, landedInfo: r.landed, currency: r.currency });
      };
      const pickProduct = (v) => setF((x) => ({ ...x, id: v }));
      const loc = t('dateLocale'); const cur = f.currency.toUpperCase();
      const rows = out ? [[t('netPrice'), money(out.netPrice, cur, loc)], ['VAT', money(out.vat, cur, loc)], [t('landed'), money(out.landed, cur, loc) + '  (' + cny(out.landedCny, loc, 2) + ')'],
        [t('fee') + ' + ' + t('payFee'), money(out.platformFee, cur, loc)], [t('fulfil'), money(out.fulfilFee, cur, loc)], [t('ads'), money(out.ads, cur, loc)], [t('returns'), money(out.returns, cur, loc)],
        [t('breakEven'), out.breakEvenPrice === null ? '—' : money(out.breakEvenPrice, cur, loc)], [t('beRoas'), out.breakEvenRoas === null ? '—' : out.breakEvenRoas]] : [];
      return h('div', { className: 'ec-calc' },
        h('div', { className: 'lp-card' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'calc', size: 15, className: 'lp-ico' }), t('calcTitle'))),
          h('p', { className: 'lp-muted ec-note' }, t('calcHint')),
          h('div', { className: 'ec-grid' },
            h(Field, { label: t('useProduct'), wide: true }, h(Select, { value: f.id, label: t('useProduct'), onChange: pickProduct, options: [['', t('manualCost')], ...products.map((p) => [p.sku, p.sku + ' · ' + p.title + ' (' + cny(p.landedCny, loc, 2) + ')'])] })),
            f.id ? null : h(Field, { label: t('cost'), value: f.costCny, onChange: set('costCny'), num: true }),
            f.id ? null : h(Field, { label: t('weight'), value: f.weightG, onChange: set('weightG'), num: true }),
            f.id ? null : h(Field, { label: t('freightFixed'), value: f.shippingCny, onChange: set('shippingCny'), num: true }),
            f.id ? null : h(Field, { label: t('duty'), value: f.dutyPct, onChange: set('dutyPct'), num: true }),
            h(Field, { label: t('price'), value: f.price, onChange: set('price'), num: true }),
            h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5 }),
            h(Field, { label: t('vat'), value: f.vatPct, onChange: set('vatPct'), num: true }),
            h(Field, { label: t('fee'), value: f.platformFeePct, onChange: set('platformFeePct'), num: true }),
            h(Field, { label: t('payFee'), value: f.payFeePct, onChange: set('payFeePct'), num: true }),
            h(Field, { label: t('fulfil'), value: f.fulfilFee, onChange: set('fulfilFee'), num: true }),
            h(Field, { label: t('ads'), value: f.adPct, onChange: set('adPct'), num: true }),
            h(Field, { label: t('returns'), value: f.returnPct, onChange: set('returnPct'), num: true }),
            h(Field, { label: t('rate'), value: f.rate, onChange: set('rate'), num: true }),
            h(Field, { label: t('targetMargin'), value: f.target, onChange: set('target'), num: true })),
          h('div', { className: 'ec-form-actions' },
            h('button', { type: 'button', className: 'lp-primary', disabled: busy || !(Number(f.price) > 0), onClick: () => go('calc'), title: Number(f.price) > 0 ? '' : t('needPrice') }, t('calcGo')),
            h('button', { type: 'button', className: 'lp-ghost', disabled: busy, onClick: () => go('price_for') }, t('priceFor')))),
        out ? h('div', { className: 'lp-card ec-result' },
          h('div', { className: 'ec-result-top' }, h('b', { className: 'ec-big ' + (out.profit < 0 ? 'is-neg' : 'is-pos') }, money(out.profit, cur, loc)), h('span', { className: 'lp-muted' }, t('unit') + ' · ' + cny(out.profitCny, loc, 2)),
            h('span', { className: 'lp-pill ' + pctTone(out.marginPct) }, t('margin') + ' ' + out.marginPct + '%'), out.roiPct !== null ? h('span', { className: 'lp-pill' }, t('roi') + ' ' + out.roiPct + '%') : null),
          h('dl', { className: 'ec-dl' }, rows.map(([k, v]) => h('div', { key: k }, h('dt', { className: 'lp-muted' }, k), h('dd', null, v))))) : null);
    }

    function SettingsBox(props) {
      const { t, settings, onSaved, setError } = props;
      const keys = ['freightPerKg', 'volDivisor', 'leadDays', 'safetyDays', 'coverDays', 'windowDays', 'lowMarginPct'];
      const [f, setF] = useState(() => Object.fromEntries(keys.map((k) => [k, String(settings[k])])));
      const [run, busy] = useAction(setError);
      const save = async () => { const r = await run({ action: 'settings', settings: Object.fromEntries(keys.map((k) => [k, Number(f[k])])) }); if (r) onSaved(r.settings); };
      return h('div', { className: 'lp-card ec-form' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'settings', size: 15, className: 'lp-ico' }), t('settings'))),
        h('div', { className: 'ec-grid' }, keys.map((k) => h(Field, { key: k, label: t('s_' + k), value: f[k], onChange: (v) => setF((x) => ({ ...x, [k]: v })), num: true }))),
        h('p', { className: 'lp-muted ec-note' }, t('settingsNote')),
        h('div', { className: 'ec-form-actions' }, h('button', { type: 'button', className: 'lp-primary', disabled: busy, onClick: save }, t('save'))));
    }
