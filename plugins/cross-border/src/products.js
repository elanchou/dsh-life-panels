
    function Field(props) {
      return h('label', { className: 'cb-f' + (props.wide ? ' is-wide' : '') }, h('span', { className: 'cb-f-l' }, props.label),
        props.children || h('input', { className: 'lp-input', value: props.value, inputMode: props.num ? 'decimal' : undefined, placeholder: props.placeholder, maxLength: props.max,
          onChange: (e) => props.onChange(e.target.value) }));
    }
    const pctTone = (m) => (m === null || m === undefined ? '' : m < 0 ? 'tone-error' : m < 10 ? 'tone-warn' : 'tone-success');

    function Economics(props) {
      const { t, e, cur } = props;
      if (!e || !e.ok) return h('div', { className: 'cb-econ-err' }, h(Icon, { name: 'alert', size: 14 }), h('span', null, e ? e.error : ''));
      const loc = t('dateLocale');
      return h('div', { className: 'cb-econ' },
        h('div', { className: 'cb-econ-main' },
          h('b', { className: e.profit < 0 ? 'is-neg' : 'is-pos' }, fmt(e.profit, cur, loc)),
          h('span', { className: 'lp-pill ' + pctTone(e.marginPct) }, t('margin') + ' ' + e.marginPct + '%'),
          e.roiPct !== null ? h('span', { className: 'lp-pill' }, t('roi') + ' ' + e.roiPct + '%') : null),
        h('div', { className: 'cb-econ-sub lp-muted' },
          h('span', null, t('landed') + ' ' + fmt(e.landed, cur, loc)),
          h('span', null, t('breakEven') + ' ' + fmt(e.breakEvenPrice, cur, loc)),
          h('span', null, t('netPrice') + ' ' + fmt(e.netPrice, cur, loc))));
    }

    function ListingForm(props) {
      const { t, initial, onSave, onCancel, busy } = props;
      const [f, setF] = useState(() => ({ platform: 'amazon', market: 'US', price: '', currency: 'USD', vatPct: '0', platformFeePct: '15', fulfilFee: '', adPct: '', returnPct: '', rate: '', url: '', ...(initial || {}) }));
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const pick = (k, v) => setF((x) => {
        const n = { ...x, [k]: v };
        if (k === 'market' && MARKETS[v]) { n.currency = MARKETS[v][0]; n.vatPct = String(MARKETS[v][1]); }
        if (k === 'platform' && FEE[v] !== undefined) n.platformFeePct = String(FEE[v]);
        return n;
      });
      const submit = () => onSave({
        listingId: initial && initial.id, platform: f.platform, market: String(f.market || '').toUpperCase(), price: numOrU(f.price), currency: String(f.currency || '').toUpperCase(),
        vatPct: numOrU(f.vatPct), platformFeePct: numOrU(f.platformFeePct), fulfilFee: numOrU(f.fulfilFee), adPct: numOrU(f.adPct), returnPct: numOrU(f.returnPct),
        rate: f.rate === '' ? '' : numOrU(f.rate), url: f.url,
      });
      return h('div', { className: 'cb-form lp-card' },
        h('div', { className: 'cb-grid' },
          h(Field, { label: t('platform') }, h('select', { className: 'lp-select', value: f.platform, onChange: (e) => pick('platform', e.target.value) }, PLATFORMS.map((p) => h('option', { key: p, value: p }, PLATFORM_NAME[p] || t('other'))))),
          h(Field, { label: t('market'), value: f.market, onChange: (v) => pick('market', v.toUpperCase()), placeholder: 'US / DE / JP', max: 12 }),
          h(Field, { label: t('price'), value: f.price, onChange: set('price'), num: true }),
          h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5 }),
          h(Field, { label: t('vat'), value: f.vatPct, onChange: set('vatPct'), num: true }),
          h(Field, { label: t('fee'), value: f.platformFeePct, onChange: set('platformFeePct'), num: true }),
          h(Field, { label: t('fulfil'), value: f.fulfilFee, onChange: set('fulfilFee'), num: true }),
          h(Field, { label: t('ads'), value: f.adPct, onChange: set('adPct'), num: true }),
          h(Field, { label: t('returns'), value: f.returnPct, onChange: set('returnPct'), num: true }),
          h(Field, { label: t('rate'), value: f.rate, onChange: set('rate'), num: true }),
          h(Field, { label: t('url'), value: f.url, onChange: set('url'), wide: true })),
        h('div', { className: 'cb-form-actions' },
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !(Number(f.price) > 0), onClick: submit }, t('save')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onCancel }, t('cancel'))));
    }

    function ProductEditor(props) {
      const { t, product, onChange, onDeleted, onError, onBack, narrow } = props;
      const isNew = !product.id;
      const [f, setF] = useState(() => ({
        title: product.title || '', sku: product.sku || '', costCny: product.costCny ?? '', shippingCny: product.shippingCny ?? '', dutyPct: product.dutyPct ?? '',
        stock: product.stock === null || product.stock === undefined ? '' : String(product.stock), reorderAt: product.reorderAt || '', tags: (product.tags || []).join(', '), notes: product.notes || '',
      }));
      const [busy, setBusy] = useState(false);
      const [dirty, setDirty] = useState(isNew);
      const [form, setForm] = useState(null); // null | 'new' | listing
      const [confirm, setConfirm] = useState(false);
      const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };
      const body = () => ({
        title: f.title, sku: f.sku || undefined, costCny: numOrU(f.costCny) ?? 0, shippingCny: numOrU(f.shippingCny) ?? 0, dutyPct: numOrU(f.dutyPct) ?? 0,
        stock: f.stock === '' ? null : numOrU(f.stock), reorderAt: numOrU(f.reorderAt) ?? 0, tags: f.tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean), notes: f.notes,
      });
      const run = async (req, after) => {
        setBusy(true);
        try { const r = await call(req); if (after) after(r); onChange(r.product || null); } catch (e) { onError(e.message); } finally { setBusy(false); }
      };
      const save = () => run(isNew ? { action: 'add_product', ...body() } : { action: 'update_product', id: product.id, ...body() }, () => setDirty(false));
      const saveListing = (l) => run({ action: 'set_listing', id: product.id, ...l }, () => setForm(null));
      const rmListing = (l) => run({ action: 'remove_listing', id: product.id, listingId: l.id });
      const remove = async () => { setBusy(true); try { await call({ action: 'remove_product', id: product.id }); onDeleted(); } catch (e) { onError(e.message); setBusy(false); } };
      const landed = ((Number(f.costCny) || 0) + (Number(f.shippingCny) || 0)) * (1 + (Number(f.dutyPct) || 0) / 100);
      return h('div', { className: 'cb-editor' },
        h('div', { className: 'cb-ed-bar' },
          narrow ? h('button', { type: 'button', className: 'lp-round', onClick: onBack, 'aria-label': t('back'), title: t('back') }, h(Icon, { name: 'left', size: 16 })) : null,
          h('span', { className: 'cb-ed-sku lp-muted' }, product.sku || ''),
          h('span', { className: 'cb-spacer' }),
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !dirty || !f.title.trim(), onClick: save }, busy ? t('saving') : t('save')),
          !isNew ? h('button', { type: 'button', className: 'lp-round is-danger', onClick: () => setConfirm(true), title: t('del'), 'aria-label': t('del') }, h(Icon, { name: 'trash', size: 15 })) : null),
        confirm ? h('div', { className: 'cb-confirm', role: 'alertdialog' }, h('span', null, t('confirmDelP')),
          h('button', { type: 'button', className: 'lp-primary cb-danger', onClick: remove }, t('del')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: () => setConfirm(false) }, t('cancel'))) : null,
        h('div', { className: 'cb-grid' },
          h(Field, { label: t('titleF'), value: f.title, onChange: set('title'), wide: true, max: 200 }),
          h(Field, { label: t('sku'), value: f.sku, onChange: set('sku'), max: 60 }),
          h(Field, { label: t('tags'), value: f.tags, onChange: set('tags') }),
          h(Field, { label: t('cost'), value: f.costCny, onChange: set('costCny'), num: true }),
          h(Field, { label: t('freight'), value: f.shippingCny, onChange: set('shippingCny'), num: true }),
          h(Field, { label: t('duty'), value: f.dutyPct, onChange: set('dutyPct'), num: true }),
          h(Field, { label: t('stock'), value: f.stock, onChange: set('stock'), num: true }),
          h(Field, { label: t('reorder'), value: f.reorderAt, onChange: set('reorderAt'), num: true }),
          h(Field, { label: t('landed') }, h('div', { className: 'cb-static' }, fmt(Math.round(landed * 100) / 100, 'CNY', t('dateLocale')))),
          h(Field, { label: t('notes'), wide: true }, h('textarea', { className: 'lp-textarea', value: f.notes, onChange: (e) => set('notes')(e.target.value), maxLength: 4000 }))),
        isNew ? null : h('div', { className: 'cb-listings' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'globe', size: 15, className: 'lp-ico' }), t('listings')),
            h('button', { type: 'button', className: 'lp-ghost', onClick: () => setForm('new') }, h(Icon, { name: 'plus', size: 14 }), t('addListing'))),
          dirty ? h('p', { className: 'lp-muted cb-note' }, t('unsavedNote')) : null,
          form === 'new' ? h(ListingForm, { t, onSave: saveListing, onCancel: () => setForm(null), busy }) : null,
          !product.listings || !product.listings.length ? (form ? null : h('p', { className: 'lp-muted cb-note' }, t('noListings')))
            : product.listings.map((l) => (form && form.id === l.id
              ? h(ListingForm, { key: l.id, t, initial: { ...l, price: String(l.price), vatPct: String(l.vatPct), platformFeePct: String(l.platformFeePct), fulfilFee: String(l.fulfilFee || ''), adPct: String(l.adPct || ''), returnPct: String(l.returnPct || ''), rate: l.rate ? String(l.rate) : '' }, onSave: saveListing, onCancel: () => setForm(null), busy })
              : h('div', { key: l.id, className: 'cb-listing lp-card' },
                h('div', { className: 'cb-listing-head' },
                  h('b', null, (PLATFORM_NAME[l.platform] || t('other')) + (l.market ? ' · ' + l.market : '')),
                  h('span', { className: 'lp-muted' }, fmt(l.price, l.currency, t('dateLocale'))),
                  h('span', { className: 'cb-spacer' }),
                  l.url ? h('a', { className: 'lp-round lp-round-sm', href: l.url, target: '_blank', rel: 'noreferrer noopener', 'aria-label': t('url') }, h(Icon, { name: 'external', size: 13 })) : null,
                  h('button', { type: 'button', className: 'lp-round lp-round-sm', onClick: () => setForm(l), title: t('editListing'), 'aria-label': t('editListing') }, h(Icon, { name: 'edit', size: 13 })),
                  h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', onClick: () => rmListing(l), title: t('del'), 'aria-label': t('del') }, h(Icon, { name: 'trash', size: 13 }))),
                h(Economics, { t, e: l.economics, cur: l.currency }))))));
    }

    function ProductsTab(props) {
      const { t, data, reload, setError } = props;
      const [query, setQuery] = useState('');
      const [open, setOpen] = useState(null);
      const [show, setShow] = useState(false);
      const [version, setVersion] = useState(0);
      const root = useRef(null);
      const [w, setW] = useState(1000);
      useEffect(() => {
        const el = root.current;
        if (!el || typeof ResizeObserver !== 'function') return undefined;
        const ro = new ResizeObserver((x) => setW(x[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
      }, []);
      const narrow = w < 720;
      const items = ((data && data.items) || []).filter((p) => {
        const q = query.trim().toLowerCase();
        return !q || (p.sku + ' ' + p.title + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q);
      });
      const load = async (id) => {
        try { const r = await call({ action: 'get', id }); setOpen(r.product); setVersion((v) => v + 1); setShow(true); } catch (e) { setError(t('loadFailed', { error: e.message })); }
      };
      const create = () => { setOpen({ id: null, title: '', listings: [], tags: [] }); setVersion((v) => v + 1); setShow(true); };
      const changed = (p) => { if (p) { setOpen(p); if (!open || !open.id) setVersion((v) => v + 1); } reload(); };
      const list = h('aside', { className: 'cb-side' },
        h('div', { className: 'cb-side-head' },
          h('label', { className: 'lp-field cb-search' }, h(Icon, { name: 'search', size: 14 }), h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })),
          h('button', { type: 'button', className: 'lp-primary', onClick: create }, h(Icon, { name: 'plus', size: 14 }), t('newProduct'))),
        !data ? h('div', { className: 'cb-skels' }, [0, 1, 2].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 62, borderRadius: 12 } })))
          : !items.length ? h('div', { className: 'lp-muted cb-empty' }, query ? t('emptyFilter') : t('emptyList'))
            : h('ul', { className: 'cb-rows' }, items.map((p) => h('li', { key: p.id }, h('button', { type: 'button', className: 'cb-row' + (open && open.id === p.id ? ' is-active' : ''), onClick: () => load(p.id) },
              h('span', { className: 'cb-row-top' }, h('b', null, p.title), p.lowStock ? h('span', { className: 'lp-pill tone-warn' }, t('lowStock')) : null),
              h('span', { className: 'cb-row-meta lp-muted' },
                h('span', null, p.sku), h('span', null, t('listings') + ' ' + p.listings),
                p.minMarginPct !== null ? h('span', { className: p.minMarginPct < 0 ? 'cb-neg' : '' }, p.minMarginPct + '%' + (p.maxMarginPct !== p.minMarginPct ? ' ~ ' + p.maxMarginPct + '%' : '')) : null,
                p.stock !== null ? h('span', null, t('stock') + ' ' + p.stock) : null))))));
      const editor = open ? h(ProductEditor, { key: (open.id || 'new') + ':' + version, t, product: open, onChange: changed, onDeleted: () => { setOpen(null); setShow(false); reload(); }, onError: setError, onBack: () => setShow(false), narrow })
        : h('div', { className: 'cb-pick lp-muted' }, h(Icon, { name: 'box', size: 28 }), h('span', null, t('pick')));
      return h('div', { ref: root, className: 'cb-split' + (narrow ? ' is-narrow' : '') },
        !narrow || !show ? list : null,
        !narrow || show ? h('section', { className: 'cb-main' }, editor) : null);
    }
