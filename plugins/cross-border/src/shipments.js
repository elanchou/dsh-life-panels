
    function ShipmentsTab(props) {
      const { t, products, setError, reloadAll } = props;
      const [data, setData] = useState(null);
      const [openOnly, setOpenOnly] = useState(true);
      const [adding, setAdding] = useState(false);
      const blank = { trackingNo: '', carrier: '', label: '', productId: '', qty: '', eta: '', status: 'in_transit' };
      const [f, setF] = useState(blank);
      const alive = useRef(true);
      useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'list_shipments', openOnly }); if (alive.current) setData(r); } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [openOnly, t, setError]);
      useEffect(() => { load(); }, [load]);
      const act = async (req) => { try { const r = await call(req); if (r.stockAdded) setError(null); await load(); reloadAll(); return r; } catch (e) { setError(e.message); return null; } };
      const add = async () => {
        const r = await act({ action: 'add_shipment', ...f, productId: f.productId || undefined, qty: numOrU(f.qty), eta: f.eta || undefined });
        if (r) { setF(blank); setAdding(false); }
      };
      const today = todayStr();
      const items = (data && data.items) || [];
      return h('div', { className: 'cb-ship' },
        h('div', { className: 'cb-ship-bar' },
          h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: openOnly, onChange: (e) => setOpenOnly(e.target.checked) }), h('span', null, t('openOnly'))),
          h('span', { className: 'cb-spacer' }),
          h('button', { type: 'button', className: 'lp-primary', onClick: () => setAdding(!adding) }, h(Icon, { name: 'plus', size: 14 }), t('shipNew'))),
        adding ? h('div', { className: 'lp-card cb-form' },
          h('div', { className: 'cb-grid' },
            h(Field, { label: t('trackNo'), value: f.trackingNo, onChange: (v) => setF((x) => ({ ...x, trackingNo: v })), max: 60 }),
            h(Field, { label: t('carrier'), value: f.carrier, onChange: (v) => setF((x) => ({ ...x, carrier: v })), max: 60 }),
            h(Field, { label: t('label'), value: f.label, onChange: (v) => setF((x) => ({ ...x, label: v })), max: 120 }),
            h(Field, { label: t('product') }, h('select', { className: 'lp-select', value: f.productId, onChange: (e) => setF((x) => ({ ...x, productId: e.target.value })) },
              h('option', { value: '' }, t('none')), (products || []).map((p) => h('option', { key: p.id, value: p.id }, p.sku + ' · ' + p.title)))),
            h(Field, { label: t('qty'), value: f.qty, onChange: (v) => setF((x) => ({ ...x, qty: v })), num: true }),
            h(Field, { label: t('eta') }, h('input', { type: 'date', className: 'lp-input', value: f.eta, onChange: (e) => setF((x) => ({ ...x, eta: e.target.value })) }))),
          h('div', { className: 'cb-form-actions' },
            h('button', { type: 'button', className: 'lp-primary', disabled: !f.trackingNo.trim() && !f.label.trim(), onClick: add }, t('save')),
            h('button', { type: 'button', className: 'lp-ghost', onClick: () => setAdding(false) }, t('cancel')))) : null,
        !data ? h('div', { className: 'lp-skel', style: { height: 70, borderRadius: 12 } })
          : !items.length ? h(Empty, { icon: 'box', text: t('emptyShip') })
            : h('ul', { className: 'cb-ships' }, items.map((s) => h('li', { key: s.id, className: 'lp-card cb-ship-row' },
              h('div', { className: 'cb-ship-main' },
                h('b', null, s.label || s.trackingNo), s.label && s.trackingNo ? h('span', { className: 'lp-muted' }, s.trackingNo) : null,
                s.carrier ? h('span', { className: 'lp-muted' }, s.carrier) : null,
                s.sku ? h('span', { className: 'lp-pill' }, s.sku + (s.qty ? ' × ' + s.qty : '')) : null,
                s.eta ? h('span', { className: 'lp-pill ' + (s.status !== 'delivered' && s.eta < today ? 'tone-error' : '') }, t('eta') + ' ' + s.eta + (s.status !== 'delivered' && s.eta < today ? ' · ' + t('late') : '')) : null),
              h('div', { className: 'cb-ship-act' },
                h('select', { className: 'lp-select cb-ship-sel', value: s.status, 'aria-label': t('status'), onChange: (e) => act({ action: 'update_shipment', shipmentId: s.id, status: e.target.value }) },
                  SHIP.map((x) => h('option', { key: x, value: x }, t('st_' + x)))),
                s.trackUrl ? h('a', { className: 'lp-ghost', href: s.trackUrl, target: '_blank', rel: 'noreferrer noopener' }, h(Icon, { name: 'external', size: 13 }), t('track')) : null,
                h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', onClick: () => act({ action: 'remove_shipment', shipmentId: s.id }), title: t('del'), 'aria-label': t('del') }, h(Icon, { name: 'trash', size: 13 })))))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [tab, setTab] = useState('products');
      const [data, setData] = useState(null);
      const [sum, setSum] = useState(null);
      const [error, setError] = useState(null);
      const alive = useRef(true);
      const reload = useCallback(async () => {
        try {
          const [l, s] = await Promise.all([call({ action: 'list', limit: 500 }), call({ action: 'summary' })]);
          if (alive.current) { setData(l); setSum(s); setError(null); }
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; }; }, [reload]);
      useEffect(() => { const id = setInterval(() => { if (!document.hidden) reload(); }, 20000); return () => clearInterval(id); }, [reload]);
      return h('div', { className: 'lp-root cb-root' },
        h('div', { className: 'cb-head' },
          h('div', { className: 'cb-head-l' }, h('h1', { className: 'cb-h1' }, t('title')),
            h(Tabs, { value: tab, onChange: setTab, items: [{ id: 'products', label: t('tabProducts') }, { id: 'calc', label: t('tabCalc') }, { id: 'ship', label: t('tabShip'), count: sum ? sum.openShipments : undefined }] })),
          sum ? h('div', { className: 'cb-stats' },
            h(Stat, { icon: 'box', value: sum.products, label: t('products') }),
            h(Stat, { icon: 'globe', value: sum.listings, label: t('listings') }),
            sum.losingListings.length ? h(Stat, { icon: 'alert', value: sum.losingListings.length, label: t('losing'), tone: 'tone-error' }) : null,
            sum.lowStock.length ? h(Stat, { icon: 'alert', value: sum.lowStock.length, label: t('lowStock'), tone: 'tone-warn' }) : null) : null),
        error ? h('div', { className: 'cb-err' }, h(ErrorBar, { error, onRetry: reload, retryLabel: t('retry'), onClose: () => setError(null) })) : null,
        h('div', { className: 'cb-body' },
          tab === 'products' ? h(ProductsTab, { t, data, reload, setError }) : null,
          tab === 'calc' ? h('div', { className: 'cb-scroll' }, h(CalcTab, { t })) : null,
          tab === 'ship' ? h('div', { className: 'cb-scroll' }, h(ShipmentsTab, { t, products: data && data.items, setError, reloadAll: reload })) : null),
        h('p', { className: 'lp-hint cb-hint' }, h(Icon, { name: 'sparkle', size: 13 }),
          data && data.ratesDate ? t('rates', { date: data.ratesDate }) + (data.ratesStale ? ' · ' + t('ratesStale') : '') + ' · ' : '', t('hint')),
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      '.cb-root{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + OK + ');display:flex;flex-direction:column;overflow:hidden}',
      '.cb-head{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:20px 24px 12px}',
      '.cb-head-l{display:flex;flex-direction:column;gap:10px;align-items:flex-start}',
      '.cb-h1{margin:0;font-size:22px;line-height:30px;font-weight:650}',
      '.cb-stats{display:flex;gap:10px;flex-wrap:wrap}',
      '.cb-err{padding:0 24px}',
      '.cb-body{flex:1;min-height:0;display:flex;flex-direction:column}',
      '.cb-scroll{flex:1;min-height:0;overflow:auto;padding:4px 24px 16px;display:flex;flex-direction:column;gap:14px}',
      '.cb-hint{flex:none;margin:0;padding:8px 24px 12px}',
      '.cb-split{flex:1;min-height:0;display:flex;border-top:1px solid var(--lp-glass-edge)}',
      '.cb-side{flex:none;width:300px;display:flex;flex-direction:column;gap:10px;padding:14px 12px 8px 18px;border-right:1px solid var(--lp-glass-edge);min-height:0}',
      '.cb-split.is-narrow .cb-side{width:100%;border-right:0}',
      '.cb-side-head{display:flex;gap:8px;align-items:center}',
      '.cb-search{flex:1;min-width:0}.cb-search input{width:100%}',
      '.cb-rows{list-style:none;margin:0;padding:0;overflow:auto;display:flex;flex-direction:column;gap:6px;flex:1;min-height:0}',
      '.cb-row{width:100%;text-align:left;display:flex;flex-direction:column;gap:3px;padding:9px 11px;border-radius:12px;border:1px solid transparent;background:transparent;color:' + FG + ';cursor:pointer}',
      '.cb-row:hover{' + GLASS_SOFT + '}',
      '.cb-row.is-active{background:var(--lp-glass-strong);border-color:var(--lp-glass-edge)}',
      '.cb-row-top{display:flex;align-items:center;gap:6px}.cb-row-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}',
      '.cb-row-meta{display:flex;gap:10px;font-size:11.5px;font-variant-numeric:tabular-nums;flex-wrap:wrap}',
      '.cb-neg,.is-neg{color:var(' + ERR + ')}.is-pos{color:var(' + OK + ')}',
      '.cb-empty,.cb-pick{padding:28px 8px;text-align:center}',
      '.cb-pick{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}',
      '.cb-main{flex:1;min-width:0;min-height:0;overflow:auto}',
      '.cb-editor{display:flex;flex-direction:column;gap:14px;padding:14px 22px 24px}',
      '.cb-split.is-narrow .cb-editor{padding:12px 14px 24px}',
      '.cb-ed-bar{display:flex;align-items:center;gap:8px}.cb-spacer{flex:1}',
      '.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
      '.cb-f{display:flex;flex-direction:column;gap:4px;min-width:0}.cb-f.is-wide{grid-column:1/-1}',
      '.cb-f-l{font-size:11.5px;color:' + FG2 + '}',
      '.cb-static{height:34px;display:flex;align-items:center;font-weight:600;font-variant-numeric:tabular-nums}',
      '.cb-note{margin:0 0 8px;font-size:12px}',
      '.cb-form{display:flex;flex-direction:column;gap:12px;margin-bottom:10px}',
      '.cb-form-actions{display:flex;gap:8px;margin-top:4px}',
      '.cb-confirm{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:' + tint(ERR, 10) + '}',
      '.cb-danger{background:var(' + ERR + ') !important}',
      '.cb-listings{display:flex;flex-direction:column;gap:10px}',
      '.cb-listing{padding:12px 14px;display:flex;flex-direction:column;gap:8px}',
      '.cb-listing-head{display:flex;align-items:center;gap:10px}',
      '.cb-econ-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cb-econ-main b{font-size:18px;font-variant-numeric:tabular-nums}',
      '.cb-econ-sub{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;font-variant-numeric:tabular-nums;margin-top:4px}',
      '.cb-econ-err{display:flex;gap:6px;align-items:center;color:var(' + WARN + ');font-size:12.5px}',
      '.cb-calc{display:flex;flex-direction:column;gap:14px;max-width:880px}',
      '.cb-result{display:flex;flex-direction:column;gap:12px}',
      '.cb-result-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cb-big{font-size:26px;font-variant-numeric:tabular-nums}',
      '.cb-dl{margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px 18px}',
      '.cb-dl div{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;border-bottom:1px dashed var(--lp-glass-edge);padding-bottom:4px}',
      '.cb-dl dt,.cb-dl dd{margin:0}.cb-dl dd{font-variant-numeric:tabular-nums;font-weight:550}',
      '.cb-ship{display:flex;flex-direction:column;gap:12px;max-width:980px}',
      '.cb-ship-bar{display:flex;align-items:center;gap:10px}',
      '.cb-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer}',
      '.cb-ships{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
      '.cb-ship-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px}',
      '.cb-ship-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}',
      '.cb-ship-act{display:flex;align-items:center;gap:8px}.cb-ship-sel{width:auto;min-width:110px}',
      '.cb-ship-act a{text-decoration:none}',
    ].join('');

    const CbIcon = CbGlyph;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cross-border: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'personal', order: 27, label: () => t('panel'), icon: CbIcon, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 34, label: () => t('panel'), locale: NS,
        }, CbIcon)));
      },
    };
  },
});
