
    function AttnList(props) {
      const { title, icon, tone, rows, empty } = props;
      if (!rows.length) return null;
      return h('div', { className: 'lp-card ec-attn' },
        h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: icon, size: 15, className: 'lp-ico' }), title), h('span', { className: 'lp-pill ' + (tone || '') }, rows.length)),
        h('ul', { className: 'ec-attn-rows' }, rows.slice(0, 6).map((r, i) => h('li', { key: i }, r))));
    }

    function Overview(props) {
      const { t, go } = props;
      const loc = t('dateLocale');
      const [days, setDays] = useState(30);
      const [d, setD] = useState(null);
      const [error, setError] = useState(null);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'dashboard', ...rangeOf(days) }); if (alive.current) { setD(r); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [days, t]);
      useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
      useEffect(() => { const id = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(id); }, [load]);
      if (error) return h(ErrorBar, { error, onRetry: load, retryLabel: t('retry') });
      if (!d) return h('div', { className: 'ec-skels' }, [0, 1, 2].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 76, borderRadius: 14 } })));
      const c = d.current; const a = d.attention;
      const fresh = !c.orders && !a.restock.length && !a.losingListings.length && !d.inventoryValueCny;
      const link = (tab, id, children) => h('button', { type: 'button', className: 'ec-link', onClick: () => go(tab, id) }, children);
      return h('div', { className: 'ec-over' },
        h('div', { className: 'ec-over-bar' },
          h(Tabs, { value: String(days), onChange: (v) => setDays(Number(v)), items: [{ id: '7', label: t('d7') }, { id: '30', label: t('d30') }, { id: '90', label: t('d90') }] }),
          h('span', { className: 'lp-muted' }, d.from + ' → ' + d.to)),
        fresh ? h('div', { className: 'lp-card ec-start' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'sparkle', size: 15, className: 'lp-ico' }), t('startTitle')),
          h('ol', { className: 'ec-steps' }, ['start1', 'start2', 'start3', 'start4'].map((k) => h('li', { key: k }, t(k)))),
          h('div', { className: 'ec-start-act' }, h('button', { type: 'button', className: 'lp-primary', onClick: () => go('products', 'new') }, h(Icon, { name: 'plus', size: 14 }), t('newProduct')))) : null,
        h('div', { className: 'ec-kpis' },
          h('div', { className: 'lp-card ec-kpi' }, h('span', { className: 'lp-muted' }, t('netRevenue')), h('b', null, cny(c.netRevenueCny, loc)), h(Delta, { value: d.change.netRevenuePct, title: t('vsPrev') })),
          h('div', { className: 'lp-card ec-kpi' }, h('span', { className: 'lp-muted' }, t('netProfit')), h('b', { className: c.profitCny < 0 ? 'is-neg' : '' }, cny(c.profitCny, loc)), h(Delta, { value: d.change.profitPct, title: t('vsPrev') }),
            c.marginPct !== null ? h('span', { className: 'lp-pill ' + pctTone(c.marginPct) }, t('margin') + ' ' + c.marginPct + '%') : null),
          h('div', { className: 'lp-card ec-kpi' }, h('span', { className: 'lp-muted' }, t('orders')), h('b', null, c.orders), h(Delta, { value: d.change.ordersPct, title: t('vsPrev') }),
            c.returnRatePct ? h('span', { className: 'lp-pill tone-warn' }, t('returnRate') + ' ' + c.returnRatePct + '%') : null),
          h('div', { className: 'lp-card ec-kpi' }, h('span', { className: 'lp-muted' }, t('inventoryValue')), h('b', null, cny(d.inventoryValueCny, loc)), h('span', { className: 'lp-muted' }, t('openPurchases') + ' ' + cny(d.openPurchasesCny, loc)))),
        h('div', { className: 'lp-card ec-chart' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'chart', size: 15, className: 'lp-ico' }), t('dailyProfit'))),
          h(Bars, { data: d.series, k: 'profitCny', label: t('dailyProfit') })),
        h('div', { className: 'ec-attn-grid' },
          h(AttnList, { title: t('needRestock'), icon: 'truck', tone: 'tone-warn', rows: a.restock.map((r) => link('products', r.id,
            h('span', { className: 'ec-attn-line' }, h('b', null, r.sku), h('span', { className: 'lp-pill ' + statusTone(r.status) }, t('st_' + r.status)),
              h('span', { className: 'lp-muted' }, r.daysCover !== null ? t('daysLeft', { n: r.daysCover }) : ''), h('span', null, t('suggest', { n: r.suggestedQty })), h('span', { className: 'lp-muted' }, '≈ ' + cny(r.estCostCny, loc))))) }),
          h(AttnList, { title: t('losing'), icon: 'alert', tone: 'tone-error', rows: a.losingListings.map((r) => link('products', r.sku,
            h('span', { className: 'ec-attn-line' }, h('b', null, r.sku), h('span', { className: 'lp-muted' }, platName(r.platform, t) + ' ' + r.market),
              h('span', { className: 'is-neg' }, money(r.profit, r.currency, loc)), h('span', { className: 'lp-muted' }, t('breakEven') + ' ' + money(r.breakEvenPrice, r.currency, loc))))) }),
          h(AttnList, { title: t('thin'), icon: 'alert', tone: 'tone-warn', rows: a.thinListings.map((r) => link('products', r.sku,
            h('span', { className: 'ec-attn-line' }, h('b', null, r.sku), h('span', { className: 'lp-muted' }, platName(r.platform, t) + ' ' + r.market), h('span', null, r.marginPct + '%')))) }),
          h(AttnList, { title: t('lateBatches'), icon: 'clock', tone: 'tone-error', rows: a.lateBatches.map((r) => link('purchases', r.id,
            h('span', { className: 'ec-attn-line' }, h('b', null, r.sku + ' × ' + r.qty), h('span', { className: 'lp-muted' }, t('bs_' + r.status)), h('span', { className: 'is-neg' }, t('daysLate', { n: r.daysLate }))))) }),
          h(AttnList, { title: t('unpaid'), icon: 'wallet', tone: 'tone-warn', rows: a.unpaidSuppliers.map((r) => link('purchases', r.id,
            h('span', { className: 'ec-attn-line' }, h('b', null, r.sku), h('span', { className: 'lp-muted' }, r.supplier || ''), h('span', null, cny(r.unpaidCny, loc))))) })),
        !fresh && !a.restock.length && !a.losingListings.length && !a.lateBatches.length && !a.unpaidSuppliers.length && !a.thinListings.length
          ? h(Empty, { icon: 'check', text: t('allClear') }) : null);
    }
