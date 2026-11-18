
    function Replenish(props) {
      const { t, r, product } = props;
      if (!r) return null;
      const loc = t('dateLocale');
      return h('div', { className: 'lp-card ec-repl' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'truck', size: 15, className: 'lp-ico' }), t('replenish')), h('span', { className: 'lp-pill ' + statusTone(r.status) }, t('st_' + r.status))),
        h('dl', { className: 'ec-dl' },
          [[t('velocity'), r.velocityPerDay + ' / ' + t('perDay')], [t('daysCover'), r.daysCover === null ? '—' : t('daysN', { n: r.daysCover })],
            [t('pipeline'), t('pipelineVal', { a: r.inTransit, b: r.onOrder })], [t('reorderPoint'), r.reorderPoint],
            [t('suggestQty'), r.suggested + (r.suggested ? '  ≈ ' + cny(r.suggested * (product.costCny || 0), loc) : '')]].map(([k, v]) => h('div', { key: k }, h('dt', { className: 'lp-muted' }, k), h('dd', null, v)))));
    }

    function ProductEditor(props) {
      const { t, product, repl, onChange, onDeleted, onError, onBack, narrow, settings } = props;
      const isNew = !product.id;
      const [f, setF] = useState(() => ({
        title: product.title || '', sku: product.sku || '', costCny: product.costCny ?? '', shippingCny: product.shippingCny || '', dutyPct: product.dutyPct || '', weightG: product.weightG || '',
        l: (product.dims && product.dims.l) || '', w: (product.dims && product.dims.w) || '', hh: (product.dims && product.dims.h) || '', stock: product.stock === null || product.stock === undefined ? '' : String(product.stock),
        tags: (product.tags || []).join(', '), supplier: product.supplier || '', supplierUrl: product.supplierUrl || '', notes: product.notes || '',
      }));
      const [dirty, setDirty] = useState(isNew);
      const [run, busy] = useAction(onError);
      const [count, setCount] = useState('');
      const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };
      const body = () => ({
        title: f.title, sku: f.sku || undefined, costCny: numOrU(f.costCny) ?? 0, shippingCny: numOrU(f.shippingCny) ?? 0, dutyPct: numOrU(f.dutyPct) ?? 0, weightG: numOrU(f.weightG) ?? 0,
        dims: { l: numOrU(f.l) ?? 0, w: numOrU(f.w) ?? 0, h: numOrU(f.hh) ?? 0 }, ...(isNew ? { stock: numOrU(f.stock) ?? 0 } : {}),
        tags: f.tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean), supplier: f.supplier, supplierUrl: f.supplierUrl, notes: f.notes,
      });
      const save = async () => { const r = await run(isNew ? { action: 'add_product', ...body() } : { action: 'update_product', id: product.id, ...body() }); if (r) { setDirty(false); onChange(r.product); } };
      const remove = async () => {
        const r = await call({ action: 'remove_product', id: product.id }).catch((e) => ({ err: e.message }));
        if (r && r.err && /orders/.test(r.err)) { if (window.confirm(r.err)) { const r2 = await run({ action: 'remove_product', id: product.id, force: true }); if (r2) onDeleted(); } } else if (r && r.err) onError(r.err); else onDeleted();
      };
      const adjust = async () => { const r = await run({ action: 'adjust_stock', id: product.id, stock: Number(count) }); if (r) { setCount(''); onChange(null, true); } };
      const kg = Math.max((Number(f.weightG) || 0) / 1000, ((Number(f.l) || 0) * (Number(f.w) || 0) * (Number(f.hh) || 0)) / (settings.volDivisor || 6000));
      const fixed = Number(f.shippingCny) || 0;
      const freight = fixed > 0 ? fixed : kg * (settings.freightPerKg || 0);
      const landed = ((Number(f.costCny) || 0) + freight) * (1 + (Number(f.dutyPct) || 0) / 100);
      const loc = t('dateLocale');
      return h('div', { className: 'ec-editor' },
        h('div', { className: 'ec-ed-bar' },
          narrow ? h('button', { type: 'button', className: 'lp-round', onClick: onBack, 'aria-label': t('back'), title: t('back') }, h(Icon, { name: 'left', size: 16 })) : null,
          h('span', { className: 'lp-muted' }, product.sku || t('newProduct')), h('span', { className: 'ec-spacer' }),
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !dirty || !f.title.trim(), onClick: save }, busy ? t('saving') : t('save')),
          !isNew ? h('button', { type: 'button', className: 'lp-round is-danger', onClick: remove, title: t('del'), 'aria-label': t('del') }, h(Icon, { name: 'trash', size: 15 })) : null),
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('titleF'), value: f.title, onChange: set('title'), wide: true, max: 200 }),
          h(Field, { label: t('sku'), value: f.sku, onChange: set('sku'), max: 60 }),
          h(Field, { label: t('tags'), value: f.tags, onChange: set('tags') }),
          h(Field, { label: t('supplier'), value: f.supplier, onChange: set('supplier'), max: 120 }),
          h(Field, { label: t('supplierUrl'), value: f.supplierUrl, onChange: set('supplierUrl') }),
          h(Field, { label: t('cost'), value: f.costCny, onChange: set('costCny'), num: true }),
          h(Field, { label: t('freightFixed'), value: f.shippingCny, onChange: set('shippingCny'), num: true, placeholder: t('freightAuto') }),
          h(Field, { label: t('duty'), value: f.dutyPct, onChange: set('dutyPct'), num: true }),
          h(Field, { label: t('weight'), value: f.weightG, onChange: set('weightG'), num: true }),
          h(Field, { label: t('dimL'), value: f.l, onChange: set('l'), num: true }), h(Field, { label: t('dimW'), value: f.w, onChange: set('w'), num: true }), h(Field, { label: t('dimH'), value: f.hh, onChange: set('hh'), num: true }),
          isNew ? h(Field, { label: t('stock'), value: f.stock, onChange: set('stock'), num: true }) : null,
          h(Field, { label: t('landed') }, h('div', { className: 'ec-static' }, cny(landed, loc, 2), freight > 0 ? h('span', { className: 'lp-muted' }, ' · ' + t('freightIs', { v: cny(freight, loc, 2), kg: kg.toFixed(2) })) : null)),
          h(Field, { label: t('notes'), wide: true }, h('textarea', { className: 'lp-textarea', value: f.notes, onChange: (e) => set('notes')(e.target.value), maxLength: 4000 }))),
        isNew ? null : h('div', { className: 'lp-card ec-stock' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'box', size: 15, className: 'lp-ico' }), t('stock') + ': ' + (product.stock === null ? '—' : product.stock))),
          h('div', { className: 'ec-stock-row' }, h('input', { className: 'lp-input ec-count', value: count, inputMode: 'numeric', placeholder: t('countedStock'), onChange: (e) => setCount(e.target.value) }),
            h('button', { type: 'button', className: 'lp-ghost', disabled: busy || !/^\d+$/.test(count), onClick: adjust }, t('setStock'))),
          h('p', { className: 'lp-muted ec-note' }, t('stockNote'))),
        isNew ? null : h(Replenish, { t, r: repl, product }),
        isNew ? null : h(ListingsBlock, { t, product, run, busy, reload: (p) => onChange(p) }));
    }

    function ProductsTab(props) {
      const { t, focus, settings, setError } = props;
      const [data, setData] = useState(null);
      const [query, setQuery] = useState('');
      const [open, setOpen] = useState(null);
      const [repl, setRepl] = useState(null);
      const [show, setShow] = useState(false);
      const [version, setVersion] = useState(0);
      const root = useRef(null);
      const narrow = useWidth(root) < 720;
      const alive = useRef(true);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'list', limit: 500 }); if (alive.current) setData(r); } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t, setError]);
      useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
      const openProduct = useCallback(async (id) => {
        try { const r = await call({ action: 'get', id }); setOpen(r.product); setRepl(r.replenishment); setVersion((v) => v + 1); setShow(true); } catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [t, setError]);
      const create = () => { setOpen({ id: null, title: '', listings: [], tags: [] }); setRepl(null); setVersion((v) => v + 1); setShow(true); };
      useEffect(() => { if (focus && focus.id === 'new') create(); else if (focus && focus.id) openProduct(focus.id); }, [focus, openProduct]);
      const changed = async (p, refetch) => {
        if (p) { setOpen(p); if (!open || !open.id) setVersion((v) => v + 1); const r = await call({ action: 'get', id: p.id }).catch(() => null); if (r) { setOpen(r.product); setRepl(r.replenishment); } }
        else if (refetch && open) { await openProduct(open.id); }
        load();
      };
      const q = query.trim().toLowerCase();
      const items = ((data && data.items) || []).filter((p) => !q || (p.sku + ' ' + p.title + ' ' + (p.tags || []).join(' ') + ' ' + p.supplier).toLowerCase().includes(q));
      const list = h('aside', { className: 'ec-side' },
        h('div', { className: 'ec-side-head' },
          h('label', { className: 'lp-field ec-search' }, h(Icon, { name: 'search', size: 14 }), h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })),
          h('button', { type: 'button', className: 'lp-primary', onClick: create }, h(Icon, { name: 'plus', size: 14 }), t('newProduct'))),
        !data ? h('div', { className: 'ec-skels' }, [0, 1, 2].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 62, borderRadius: 12 } })))
          : !items.length ? h('div', { className: 'lp-muted ec-empty' }, query ? t('emptyFilter') : t('emptyProducts'))
            : h('ul', { className: 'ec-rows' }, items.map((p) => h('li', { key: p.id }, h('button', { type: 'button', className: 'ec-row' + (open && open.id === p.id ? ' is-active' : ''), onClick: () => openProduct(p.id) },
              h('span', { className: 'ec-row-top' }, h('b', null, p.title), p.status === 'out' || p.status === 'order_now' ? h('span', { className: 'lp-pill ' + statusTone(p.status) }, t('st_' + p.status)) : null),
              h('span', { className: 'ec-row-meta lp-muted' }, h('span', null, p.sku), p.stock !== null ? h('span', null, t('stock') + ' ' + p.stock) : null,
                p.daysCover !== null ? h('span', null, t('daysN', { n: p.daysCover })) : null,
                p.minMarginPct !== null ? h('span', { className: p.minMarginPct < 0 ? 'is-neg' : '' }, p.minMarginPct + '%' + (p.maxMarginPct !== p.minMarginPct ? ' ~ ' + p.maxMarginPct + '%' : '')) : null))))));
      const editor = open ? h(ProductEditor, { key: (open.id || 'new') + ':' + version, t, product: open, repl, settings, onChange: changed, onDeleted: () => { setOpen(null); setShow(false); load(); }, onError: setError, onBack: () => setShow(false), narrow })
        : h('div', { className: 'ec-pick lp-muted' }, h(Icon, { name: 'box', size: 28 }), h('span', null, t('pickProduct')));
      return h('div', { ref: root, className: 'ec-split' + (narrow ? ' is-narrow' : '') }, !narrow || !show ? list : null, !narrow || show ? h('section', { className: 'ec-main' }, editor) : null);
    }
