window.__ModuleLoader__.load({
  id: '@local/ecommerce',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'ecommerce';
    const NS = 'ecommerce';
    const call = makeCall('/plugin-api/ecommerce');
    /* @include i18n-zh.js */
    /* @include i18n-en.js */
    /* @include ui.js */
    /* @include overview.js */
    /* @include listings.js */
    /* @include products.js */
    /* @include orders.js */
    /* @include purchases.js */
    /* @include finance.js */

    const TABS = ['overview', 'products', 'orders', 'purchases', 'finance', 'calc'];
    const TAB_KEY = 'ecommerce.tab';
    const readTab = () => { try { const v = localStorage.getItem(TAB_KEY); return TABS.includes(v) ? v : 'overview'; } catch { return 'overview'; } };

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [tab, setTab] = useState(readTab);
      const [focus, setFocus] = useState(null);
      const [error, setError] = useState(null);
      const [settings, setSettings] = useState(null);
      const [showSettings, setShowSettings] = useState(false);
      const [products, setProducts] = useState([]);
      const [ratesInfo, setRatesInfo] = useState(null);
      const go = useCallback((to, id) => { setTab(to); setFocus(id ? { id, at: Date.now() } : null); try { localStorage.setItem(TAB_KEY, to); } catch { /* storage blocked */ } }, []);
      useEffect(() => {
        let alive = true;
        call({ action: 'settings' }).then((r) => { if (alive) setSettings(r.settings); }).catch(() => {});
        call({ action: 'list', limit: 500 }).then((r) => { if (alive) { setProducts(r.items); setRatesInfo(r.ratesDate ? { date: r.ratesDate, stale: r.ratesStale } : null); } }).catch(() => {});
        return () => { alive = false; };
      }, [tab]);
      const tabs = [['overview', 'tabOverview'], ['products', 'tabProducts'], ['orders', 'tabOrders'], ['purchases', 'tabPurchases'], ['finance', 'tabFinance'], ['calc', 'tabCalc']];
      return h('div', { className: 'lp-root ec-root' },
        h('div', { className: 'ec-head' },
          h('h1', { className: 'ec-h1' }, t('title')),
          h(Tabs, { value: tab, onChange: (v) => go(v), items: tabs.map(([id, key]) => ({ id, label: t(key) })) }),
          h('span', { className: 'ec-spacer' }),
          h('button', { type: 'button', className: 'lp-round' + (showSettings ? ' is-on' : ''), onClick: () => setShowSettings(!showSettings), title: t('settings'), 'aria-label': t('settings'), 'aria-pressed': showSettings }, h(Icon, { name: 'settings', size: 16 }))),
        error ? h('div', { className: 'ec-err' }, h(ErrorBar, { error, onClose: () => setError(null) })) : null,
        showSettings && settings ? h('div', { className: 'ec-pad' }, h(SettingsBox, { t, settings, setError, onSaved: (s) => { setSettings(s); setShowSettings(false); } })) : null,
        h('div', { className: 'ec-body' },
          tab === 'overview' ? h('div', { className: 'ec-scroll' }, h(Overview, { t, go })) : null,
          tab === 'products' && settings ? h(ProductsTab, { t, focus, settings, setError }) : null,
          tab === 'orders' ? h('div', { className: 'ec-scroll' }, h(OrdersTab, { t, setError })) : null,
          tab === 'purchases' ? h('div', { className: 'ec-scroll' }, h(PurchasesTab, { t, setError, focus })) : null,
          tab === 'finance' ? h('div', { className: 'ec-scroll' }, h(FinanceTab, { t, setError })) : null,
          tab === 'calc' ? h('div', { className: 'ec-scroll' }, h(CalcTab, { t, products, setError })) : null),
        ratesInfo ? h('p', { className: 'lp-hint ec-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint', { date: ratesInfo.date }) + (ratesInfo.stale ? ' · ' + t('ratesStale') : '')) : null,
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      '.ec-root{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + OK + ');display:flex;flex-direction:column;overflow:hidden}',
      '.ec-head{flex:none;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 24px 10px}',
      '.ec-h1{margin:0;font-size:20px;line-height:28px;font-weight:650}.ec-spacer{flex:1}',
      '.ec-err,.ec-pad{padding:0 24px 10px}',
      '.ec-body{flex:1;min-height:0;display:flex;flex-direction:column}',
      '.ec-scroll{flex:1;min-height:0;overflow:auto;padding:6px 24px 18px}',
      '.ec-hint{flex:none;margin:0;padding:6px 24px 10px}',
      '.ec-over,.ec-page,.ec-calc{display:flex;flex-direction:column;gap:14px;max-width:1040px}',
      '.ec-over-bar,.ec-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.ec-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}',
      '.ec-kpi{display:flex;flex-direction:column;gap:6px;padding:14px 16px}.ec-kpi b{font-size:22px;line-height:28px;font-variant-numeric:tabular-nums}',
      '.ec-delta{font-size:12px;font-variant-numeric:tabular-nums}.ec-delta.is-up{color:var(' + OK + ')}.ec-delta.is-down{color:var(' + ERR + ')}',
      '.ec-chart{padding:14px 16px}.ec-bars{width:100%;height:96px;display:block}',
      '.ec-bars-axis{stroke:var(--lp-glass-edge);stroke-width:.3;vector-effect:non-scaling-stroke}',
      '.ec-bars .is-pos{fill:var(' + OK + ')}.ec-bars .is-neg{fill:var(' + ERR + ')}',
      '.ec-attn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px}',
      '.ec-attn{padding:14px 16px}.ec-attn-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}',
      '.ec-link{width:100%;text-align:left;border:0;background:transparent;color:inherit;padding:6px 8px;border-radius:9px;cursor:pointer}.ec-link:hover{' + GLASS_SOFT + '}',
      '.ec-attn-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-variant-numeric:tabular-nums}',
      '.ec-start{padding:16px 18px;display:flex;flex-direction:column;gap:10px}.ec-steps{margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:6px;color:' + FG2 + '}',
      '.ec-split{flex:1;min-height:0;display:flex;border-top:1px solid var(--lp-glass-edge)}',
      '.ec-side{flex:none;width:310px;display:flex;flex-direction:column;gap:10px;padding:14px 12px 8px 18px;border-right:1px solid var(--lp-glass-edge);min-height:0}',
      '.ec-split.is-narrow .ec-side{width:100%;border-right:0}',
      '.ec-side-head{display:flex;gap:8px;align-items:center}.ec-search{flex:1;min-width:140px}.ec-search input{width:100%}',
      '.ec-rows{list-style:none;margin:0;padding:0;overflow:auto;display:flex;flex-direction:column;gap:6px;flex:1;min-height:0}',
      '.ec-row{width:100%;text-align:left;display:flex;flex-direction:column;gap:3px;padding:9px 11px;border-radius:12px;border:1px solid transparent;background:transparent;color:' + FG + ';cursor:pointer}',
      '.ec-row:hover{' + GLASS_SOFT + '}.ec-row.is-active{background:var(--lp-glass-strong);border-color:var(--lp-glass-edge)}',
      '.ec-row-top{display:flex;align-items:center;gap:6px}.ec-row-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}',
      '.ec-row-meta{display:flex;gap:10px;font-size:11.5px;font-variant-numeric:tabular-nums;flex-wrap:wrap}',
      '.is-neg{color:var(' + ERR + ')}.is-pos{color:var(' + OK + ')}',
      '.ec-empty,.ec-pick{padding:28px 8px;text-align:center}.ec-pick{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}',
      '.ec-main{flex:1;min-width:0;min-height:0;overflow:auto}',
      '.ec-editor{display:flex;flex-direction:column;gap:14px;padding:14px 22px 24px}.ec-split.is-narrow .ec-editor{padding:12px 14px 24px}',
      '.ec-ed-bar{display:flex;align-items:center;gap:8px}',
      '.ec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
      '.ec-f{display:flex;flex-direction:column;gap:4px;min-width:0}.ec-f.is-wide{grid-column:1/-1}.ec-f-l{font-size:11.5px;color:' + FG2 + '}',
      '.ec-static{min-height:34px;display:flex;align-items:center;flex-wrap:wrap;font-weight:600;font-variant-numeric:tabular-nums}',
      '.ec-note{margin:0;font-size:12px}.ec-form{display:flex;flex-direction:column;gap:12px}.ec-form-actions{display:flex;gap:8px}',
      '.ec-csv{min-height:110px;font-family:ui-monospace,Menlo,monospace;font-size:12px}',
      '.ec-import-res{display:flex;flex-direction:column;gap:4px;font-size:12.5px}.ec-warn{color:var(' + WARN + ')}',
      '.ec-stock{padding:14px 16px;display:flex;flex-direction:column;gap:8px}.ec-stock-row{display:flex;gap:8px}.ec-count{max-width:180px}',
      '.ec-repl{padding:14px 16px}',
      '.ec-dl{margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 18px}',
      '.ec-dl div{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;border-bottom:1px dashed var(--lp-glass-edge);padding-bottom:4px}',
      '.ec-dl dt,.ec-dl dd{margin:0}.ec-dl dd{font-variant-numeric:tabular-nums;font-weight:550;text-align:right}.ec-dl .is-strong dt,.ec-dl .is-strong dd{font-weight:700;color:' + FG + '}',
      '.ec-listings{display:flex;flex-direction:column;gap:10px}.ec-listing{padding:12px 14px;display:flex;flex-direction:column;gap:8px}.ec-listing-head{display:flex;align-items:center;gap:10px}',
      '.ec-econ-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ec-econ-main b{font-size:18px;font-variant-numeric:tabular-nums}',
      '.ec-econ-sub{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;font-variant-numeric:tabular-nums;margin-top:4px}',
      '.ec-econ-err{display:flex;gap:6px;align-items:center;color:var(' + WARN + ');font-size:12.5px}',
      '.ec-result{display:flex;flex-direction:column;gap:12px}.ec-result-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ec-big{font-size:26px;font-variant-numeric:tabular-nums}',
      '.ec-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer}',
      '.ec-table-wrap{padding:6px 8px 10px;overflow:auto}.ec-table{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}',
      '.ec-table th{text-align:left;font-weight:600;color:' + FG2 + ';padding:8px 10px;border-bottom:1px solid var(--lp-glass-edge);white-space:nowrap}',
      '.ec-table td{padding:7px 10px;border-bottom:1px solid var(--lp-glass-edge);white-space:nowrap}.ec-table .is-num{text-align:right}.ec-table tr.is-dim td{color:' + FG2 + '}',
      '.ec-table .lp-select{height:28px;width:auto;min-width:92px}.ec-table-foot{padding:8px 10px 0;font-size:12px}.ec-flag{color:var(' + WARN + ');margin-left:2px}',
      '.ec-ships{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
      '.ec-ship-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px}.ec-ship-row.is-focus{border-color:var(' + BRAND + ')}',
      '.ec-ship-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}.ec-ship-act{display:flex;align-items:center;gap:8px}.ec-ship-act a{text-decoration:none}.ec-ship-act .lp-select{width:auto;min-width:104px}',
      '.ec-confirm{display:inline-flex;align-items:center;gap:8px;padding:2px 6px;border-radius:9px;background:' + tint(ERR, 10) + ';font-size:12.5px}.ec-danger{background:var(' + ERR + ') !important;height:28px}',
      '.ec-pnl{padding:14px 16px}.ec-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.ec-costs{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:2px}.ec-costs li{display:flex;align-items:center;gap:10px;padding:6px 2px;border-bottom:1px solid var(--lp-glass-edge);font-size:12.5px}',
    ].join('');

    const EcIcon = EcGlyph;
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ecommerce: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, (p) => h(Panel, { ...p, t })));
        // Its own sidebar entry, independent of ElansStack's groups.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => t('panel'), locale: NS,
        }, EcIcon));
      },
    };
  },
});
