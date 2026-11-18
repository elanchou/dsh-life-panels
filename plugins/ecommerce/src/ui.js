
    const PLATFORMS = ['amazon', 'shopify', 'tiktok', 'temu', 'aliexpress', 'ebay', 'shopee', 'lazada', 'etsy', 'walmart', 'other'];
    const PLATFORM_NAME = { amazon: 'Amazon', shopify: 'Shopify', tiktok: 'TikTok Shop', temu: 'Temu', aliexpress: 'AliExpress', ebay: 'eBay', shopee: 'Shopee', lazada: 'Lazada', etsy: 'Etsy', walmart: 'Walmart', other: '' };
    const MARKETS = { US: ['USD', 0], UK: ['GBP', 20], DE: ['EUR', 19], FR: ['EUR', 20], ES: ['EUR', 21], IT: ['EUR', 22], NL: ['EUR', 21], JP: ['JPY', 10], AU: ['AUD', 10], CA: ['CAD', 5], SG: ['SGD', 9], MX: ['MXN', 16] };
    const FEES = { amazon: [15, 0], ebay: [13, 0], shopify: [0, 2.9], tiktok: [6, 0], temu: [0, 0], aliexpress: [8, 0], shopee: [8, 0], lazada: [6, 0], etsy: [6.5, 3], walmart: [15, 0], other: [10, 0] };
    const BATCH_STATUS = ['ordered', 'producing', 'shipped', 'customs', 'delivered', 'cancelled'];
    const ORDER_STATUS = ['paid', 'returned', 'cancelled'];
    const COST_KINDS = ['ads', 'shipping', 'software', 'samples', 'platform', 'tax', 'other'];

    Object.assign(ICONS, {
      cart: ['M3 4h2l2.4 11h10.2l2-8H6.2', 'M9 20a1.2 1.2 0 1 0 0.01 0', 'M17 20a1.2 1.2 0 1 0 0.01 0'],
      box: ['M4 8l8-4 8 4v8l-8 4-8-4z', 'M4 8l8 4 8-4', 'M12 12v8'],
      truck: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'M7 18a1.5 1.5 0 1 0 0.01 0', 'M17 18a1.5 1.5 0 1 0 0.01 0'],
      chart: ['M4 20V4', 'M4 20h16', 'M8 16v-4', 'M12 16V8', 'M16 16v-6'],
      calc: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 7h8', 'M8 12h.01', 'M12 12h.01', 'M16 12h.01', 'M8 16h.01', 'M12 16h.01', 'M16 16h.01'],
      upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
      download: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
    });
    const EcGlyph = PanelGlyph('cart');

    const money = (n, cur, loc) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '—';
      try { return new Intl.NumberFormat(loc, { style: 'currency', currency: cur || 'CNY', maximumFractionDigits: cur === 'JPY' || cur === 'KRW' ? 0 : 2 }).format(n); } catch { return String(n); }
    };
    const cny = (n, loc, digits) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '—';
      try { return new Intl.NumberFormat(loc, { style: 'currency', currency: 'CNY', maximumFractionDigits: digits === undefined ? 0 : digits }).format(n); } catch { return String(n); }
    };
    const numOrU = (s) => (s === '' || s === undefined || s === null ? undefined : Number(s));
    const platName = (p, t) => PLATFORM_NAME[p] || t('other');
    const pctTone = (m) => (m === null || m === undefined ? '' : m < 0 ? 'tone-error' : m < 10 ? 'tone-warn' : 'tone-success');
    const signed = (n, loc) => (n > 0 ? '+' : '') + (n === null || n === undefined ? '—' : n + '%');
    const rangeOf = (days) => { const to = todayStr(); const d = new Date(); d.setDate(d.getDate() - (days - 1)); return { from: ymd(d), to }; };

    function Field(props) {
      return h('label', { className: 'ec-f' + (props.wide ? ' is-wide' : '') + (props.narrow ? ' is-narrow' : '') }, h('span', { className: 'ec-f-l' }, props.label),
        props.children || h('input', { className: 'lp-input', value: props.value, inputMode: props.num ? 'decimal' : undefined, placeholder: props.placeholder, maxLength: props.max, type: props.type,
          onChange: (e) => props.onChange(e.target.value) }));
    }
    function Select(props) {
      return h('select', { className: 'lp-select', value: props.value, 'aria-label': props.label, onChange: (e) => props.onChange(e.target.value) },
        props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])));
    }
    function Delta(props) {
      if (props.value === null || props.value === undefined) return null;
      const up = props.value >= 0;
      return h('span', { className: 'ec-delta ' + (up ? 'is-up' : 'is-down'), title: props.title }, (up ? '▲ ' : '▼ ') + Math.abs(props.value) + '%');
    }
    function Bars(props) {
      const data = props.data || [];
      const vals = data.map((d) => d[props.k]);
      const max = Math.max(1, ...vals.map((v) => Math.abs(v)));
      const w = 100 / Math.max(1, data.length);
      return h('svg', { className: 'ec-bars', viewBox: '0 0 100 40', preserveAspectRatio: 'none', role: 'img', 'aria-label': props.label },
        h('line', { x1: 0, x2: 100, y1: 20, y2: 20, className: 'ec-bars-axis' }),
        data.map((d, i) => { const v = d[props.k]; const hgt = Math.max(0.4, Math.abs(v) / max * 19); return h('rect', { key: d.date, x: i * w + w * 0.12, width: w * 0.76, y: v >= 0 ? 20 - hgt : 20, height: hgt, className: v >= 0 ? 'is-pos' : 'is-neg' }, h('title', null, d.date + '  ' + v)); }));
    }
    function Confirm(props) {
      const [on, setOn] = useState(false);
      if (!on) return h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', onClick: () => setOn(true), title: props.label, 'aria-label': props.label }, h(Icon, { name: 'trash', size: 13 }));
      return h('span', { className: 'ec-confirm', role: 'alertdialog' }, h('span', null, props.text),
        h('button', { type: 'button', className: 'lp-primary ec-danger', onClick: () => { setOn(false); props.onYes(); } }, props.label),
        h('button', { type: 'button', className: 'lp-ghost', onClick: () => setOn(false) }, props.cancel));
    }
    /** Run an async call and keep the busy flag and error in one place. */
    function useAction(setError) {
      const [busy, setBusy] = useState(false);
      const run = useCallback(async (req) => {
        setBusy(true);
        try { return await call(req); } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
      }, [setError]);
      return [run, busy];
    }
    function useWidth(ref) {
      const [w, setW] = useState(1000);
      useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver !== 'function') return undefined;
        const ro = new ResizeObserver((x) => setW(x[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
      }, [ref]);
      return w;
    }
    function download(name, text, type) {
      const url = URL.createObjectURL(new Blob([text], { type: type || 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const statusTone = (s) => (s === 'out' ? 'tone-error' : s === 'order_now' ? 'tone-warn' : s === 'slow' ? '' : 'tone-success');
