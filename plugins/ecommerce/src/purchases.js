
    function PurchaseForm(props) {
      const { t, products, onSave, onCancel, busy } = props;
      const [f, setF] = useState({ sku: products[0] ? products[0].sku : '', qty: '', unitCostCny: '', freightCny: '', supplier: '', eta: '', status: 'ordered', trackingNo: '', carrier: '', paidCny: '' });
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const p = products.find((x) => x.sku === f.sku);
      return h('div', { className: 'lp-card ec-form' },
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('product') }, h(Select, { value: f.sku, label: t('product'), onChange: set('sku'), options: products.map((x) => [x.sku, x.sku + ' · ' + x.title]) })),
          h(Field, { label: t('qty'), value: f.qty, onChange: set('qty'), num: true }),
          h(Field, { label: t('unitCost'), value: f.unitCostCny, onChange: set('unitCostCny'), num: true, placeholder: p ? String(p.costCny || '') : '' }),
          h(Field, { label: t('batchFreight'), value: f.freightCny, onChange: set('freightCny'), num: true }),
          h(Field, { label: t('supplier'), value: f.supplier, onChange: set('supplier'), max: 120, placeholder: p ? p.supplier : '' }),
          h(Field, { label: t('status') }, h(Select, { value: f.status, label: t('status'), onChange: set('status'), options: BATCH_STATUS.map((s) => [s, t('bs_' + s)]) })),
          h(Field, { label: t('eta') }, h('input', { type: 'date', className: 'lp-input', value: f.eta, onChange: (e) => set('eta')(e.target.value) })),
          h(Field, { label: t('trackNo'), value: f.trackingNo, onChange: set('trackingNo'), max: 60 }),
          h(Field, { label: t('carrier'), value: f.carrier, onChange: set('carrier'), max: 60 }),
          h(Field, { label: t('paidCny'), value: f.paidCny, onChange: set('paidCny'), num: true })),
        h('div', { className: 'ec-form-actions' },
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !f.sku || !(Number(f.qty) > 0), onClick: () => onSave({ action: 'add_purchase', sku: f.sku, qty: Number(f.qty), unitCostCny: numOrU(f.unitCostCny), freightCny: numOrU(f.freightCny), supplier: f.supplier || undefined, eta: f.eta || undefined, status: f.status, trackingNo: f.trackingNo || undefined, carrier: f.carrier || undefined, paidCny: numOrU(f.paidCny) }) }, t('save')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onCancel }, t('cancel'))));
    }

    function PurchasesTab(props) {
      const { t, setError, focus } = props;
      const loc = t('dateLocale');
      const [openOnly, setOpenOnly] = useState(true);
      const [data, setData] = useState(null);
      const [products, setProducts] = useState([]);
      const [adding, setAdding] = useState(false);
      const [run, busy] = useAction(setError);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try { const [b, p] = await Promise.all([call({ action: 'list_purchases', openOnly }), call({ action: 'list', limit: 500 })]); if (alive.current) { setData(b); setProducts(p.items); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [openOnly, t, setError]);
      useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
      const act = async (req) => { const r = await run(req); if (r) { setAdding(false); load(); } return r; };
      const items = (data && data.items) || [];
      return h('div', { className: 'ec-page' },
        h('div', { className: 'ec-bar' },
          h('label', { className: 'ec-check' }, h('input', { type: 'checkbox', checked: openOnly, onChange: (e) => setOpenOnly(e.target.checked) }), h('span', null, t('openOnly'))),
          h('span', { className: 'ec-spacer' }),
          h('button', { type: 'button', className: 'lp-primary', disabled: !products.length, onClick: () => setAdding(!adding), title: products.length ? '' : t('needProduct') }, h(Icon, { name: 'plus', size: 14 }), t('addPurchase'))),
        adding ? h(PurchaseForm, { t, products, busy, onSave: act, onCancel: () => setAdding(false) }) : null,
        !data ? h('div', { className: 'lp-skel', style: { height: 80, borderRadius: 12 } })
          : !items.length ? h(Empty, { icon: 'truck', text: t('emptyPurchases') })
            : h('ul', { className: 'ec-ships' }, items.map((b) => h('li', { key: b.id, className: 'lp-card ec-ship-row' + (focus && focus.id === b.id ? ' is-focus' : '') },
              h('div', { className: 'ec-ship-main' },
                h('b', null, b.sku + ' × ' + b.qty), b.supplier ? h('span', { className: 'lp-muted' }, b.supplier) : null,
                h('span', { className: 'lp-pill' }, cny(b.totalCny, loc)),
                b.unpaidCny > 0.5 && b.status !== 'cancelled' ? h('span', { className: 'lp-pill tone-warn' }, t('unpaidN', { v: cny(b.unpaidCny, loc) })) : null,
                b.eta ? h('span', { className: 'lp-pill ' + (b.late ? 'tone-error' : '') }, t('eta') + ' ' + b.eta + (b.late ? ' · ' + t('late') : '')) : null,
                b.stockApplied ? h('span', { className: 'lp-pill tone-success' }, t('inStock')) : null),
              h('div', { className: 'ec-ship-act' },
                b.stockApplied ? h('span', { className: 'lp-muted' }, t('bs_delivered')) : h(Select, { value: b.status, label: t('status'), onChange: (v) => act({ action: 'update_purchase', batchId: b.id, status: v }), options: BATCH_STATUS.map((s) => [s, t('bs_' + s)]) }),
                b.unpaidCny > 0.5 && b.status !== 'cancelled' ? h('button', { type: 'button', className: 'lp-ghost', onClick: () => act({ action: 'update_purchase', batchId: b.id, paidCny: b.totalCny }) }, t('markPaid')) : null,
                b.trackUrl ? h('a', { className: 'lp-ghost', href: b.trackUrl, target: '_blank', rel: 'noreferrer noopener' }, h(Icon, { name: 'external', size: 13 }), t('track')) : null,
                !b.stockApplied ? h(Confirm, { label: t('del'), cancel: t('cancel'), text: t('confirmDelPurchase'), onYes: () => act({ action: 'remove_purchase', batchId: b.id }) }) : null)))),
        h('p', { className: 'lp-muted ec-note' }, t('deliveredNote')));
    }
