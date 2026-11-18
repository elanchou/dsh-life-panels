
    function ListingForm(props) {
      const { t, initial, onSave, onCancel, busy } = props;
      const [f, setF] = useState(() => ({ platform: 'amazon', market: 'US', price: '', currency: 'USD', vatPct: '0', platformFeePct: '15', payFeePct: '0', fulfilFee: '', adPct: '', returnPct: '', rate: '', url: '', ...(initial || {}) }));
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const pick = (k, v) => setF((x) => {
        const n = { ...x, [k]: v };
        if (k === 'market' && MARKETS[v]) { n.currency = MARKETS[v][0]; n.vatPct = String(MARKETS[v][1]); }
        if (k === 'platform' && FEES[v]) { n.platformFeePct = String(FEES[v][0]); n.payFeePct = String(FEES[v][1]); }
        return n;
      });
      const submit = () => onSave({
        listingId: initial && initial.id, platform: f.platform, market: String(f.market || '').toUpperCase(), price: numOrU(f.price), currency: String(f.currency || '').toUpperCase(),
        vatPct: numOrU(f.vatPct), platformFeePct: numOrU(f.platformFeePct), payFeePct: numOrU(f.payFeePct), fulfilFee: numOrU(f.fulfilFee), adPct: numOrU(f.adPct), returnPct: numOrU(f.returnPct),
        rate: f.rate === '' ? '' : numOrU(f.rate), url: f.url,
      });
      return h('div', { className: 'ec-form lp-card' },
        h('div', { className: 'ec-grid' },
          h(Field, { label: t('platform') }, h(Select, { value: f.platform, label: t('platform'), onChange: (v) => pick('platform', v), options: PLATFORMS.map((p) => [p, PLATFORM_NAME[p] || t('other')]) })),
          h(Field, { label: t('market'), value: f.market, onChange: (v) => pick('market', v.toUpperCase()), placeholder: 'US / DE / JP', max: 12 }),
          h(Field, { label: t('price'), value: f.price, onChange: set('price'), num: true }),
          h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5 }),
          h(Field, { label: t('vat'), value: f.vatPct, onChange: set('vatPct'), num: true }),
          h(Field, { label: t('fee'), value: f.platformFeePct, onChange: set('platformFeePct'), num: true }),
          h(Field, { label: t('payFee'), value: f.payFeePct, onChange: set('payFeePct'), num: true }),
          h(Field, { label: t('fulfil'), value: f.fulfilFee, onChange: set('fulfilFee'), num: true }),
          h(Field, { label: t('ads'), value: f.adPct, onChange: set('adPct'), num: true }),
          h(Field, { label: t('returns'), value: f.returnPct, onChange: set('returnPct'), num: true }),
          h(Field, { label: t('rate'), value: f.rate, onChange: set('rate'), num: true }),
          h(Field, { label: t('url'), value: f.url, onChange: set('url'), wide: true })),
        h('p', { className: 'lp-muted ec-note' }, t('defaultsNote')),
        h('div', { className: 'ec-form-actions' },
          h('button', { type: 'button', className: 'lp-primary', disabled: busy || !(Number(f.price) > 0), onClick: submit }, t('save')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onCancel }, t('cancel'))));
    }

    function Economics(props) {
      const { t, e, cur } = props;
      if (!e || !e.ok) return h('div', { className: 'ec-econ-err' }, h(Icon, { name: 'alert', size: 14 }), h('span', null, e ? e.error : ''));
      const loc = t('dateLocale');
      return h('div', { className: 'ec-econ' },
        h('div', { className: 'ec-econ-main' },
          h('b', { className: e.profit < 0 ? 'is-neg' : 'is-pos' }, money(e.profit, cur, loc)),
          h('span', { className: 'lp-pill ' + pctTone(e.marginPct) }, t('margin') + ' ' + e.marginPct + '%'),
          e.roiPct !== null ? h('span', { className: 'lp-pill' }, t('roi') + ' ' + e.roiPct + '%') : null,
          e.breakEvenRoas ? h('span', { className: 'lp-pill', title: t('roasHint') }, t('beRoas') + ' ' + e.breakEvenRoas) : null),
        h('div', { className: 'ec-econ-sub lp-muted' },
          h('span', null, t('landed') + ' ' + money(e.landed, cur, loc)),
          h('span', null, t('breakEven') + ' ' + money(e.breakEvenPrice, cur, loc)),
          h('span', null, t('netPrice') + ' ' + money(e.netPrice, cur, loc))));
    }

    function ListingsBlock(props) {
      const { t, product, run, busy, reload } = props;
      const [form, setForm] = useState(null);
      const save = async (l) => { const r = await run({ action: 'set_listing', id: product.id, ...l }); if (r) { setForm(null); reload(r.product); } };
      const remove = async (l) => { const r = await run({ action: 'remove_listing', id: product.id, listingId: l.id }); if (r) reload(r.product); };
      const asForm = (l) => ({ ...l, price: String(l.price), vatPct: String(l.vatPct), platformFeePct: String(l.platformFeePct), payFeePct: String(l.payFeePct || 0), fulfilFee: String(l.fulfilFee || ''), adPct: String(l.adPct || ''), returnPct: String(l.returnPct || ''), rate: l.rate ? String(l.rate) : '' });
      return h('div', { className: 'ec-listings' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'cart', size: 15, className: 'lp-ico' }), t('listings')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: () => setForm('new') }, h(Icon, { name: 'plus', size: 14 }), t('addListing'))),
        form === 'new' ? h(ListingForm, { t, onSave: save, onCancel: () => setForm(null), busy }) : null,
        !product.listings.length ? (form ? null : h('p', { className: 'lp-muted ec-note' }, t('noListings')))
          : product.listings.map((l) => (form && form.id === l.id
            ? h(ListingForm, { key: l.id, t, initial: asForm(l), onSave: save, onCancel: () => setForm(null), busy })
            : h('div', { key: l.id, className: 'ec-listing lp-card' },
              h('div', { className: 'ec-listing-head' },
                h('b', null, platName(l.platform, t) + (l.market ? ' · ' + l.market : '')), h('span', { className: 'lp-muted' }, money(l.price, l.currency, t('dateLocale'))), h('span', { className: 'ec-spacer' }),
                l.url ? h('a', { className: 'lp-round lp-round-sm', href: l.url, target: '_blank', rel: 'noreferrer noopener', 'aria-label': t('url') }, h(Icon, { name: 'external', size: 13 })) : null,
                h('button', { type: 'button', className: 'lp-round lp-round-sm', onClick: () => setForm(l), title: t('edit'), 'aria-label': t('edit') }, h(Icon, { name: 'edit', size: 13 })),
                h(Confirm, { label: t('del'), cancel: t('cancel'), text: t('confirmDelListing'), onYes: () => remove(l) })),
              h(Economics, { t, e: l.economics, cur: l.currency })))));
    }
