    const fmt = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    const priceDigits = (p) => (p === null || p === undefined ? 2 : Math.abs(p) >= 10 ? 2 : Math.abs(p) >= 1 ? 3 : Math.abs(p) >= 0.1 ? 4 : 6);
    const fmtPrice = (q) => (q ? fmt(q.price, q.kind === 'fx' ? 4 : priceDigits(q.price)) : '—');
    const sign = (n) => (n > 0 ? '+' : '');
    const pctText = (n) => (n === null || n === undefined ? '—' : sign(n) + fmt(n) + '%');
    const tone = (n) => (n > 0 ? 'mkd-up' : n < 0 ? 'mkd-dn' : '');
    const compact = (n) => (n === null || n === undefined ? '—' : n >= 1e12 ? fmt(n / 1e12) + 'T' : n >= 1e9 ? fmt(n / 1e9) + 'B' : n >= 1e6 ? fmt(n / 1e6) + 'M' : fmt(n, 0));
    const money = (n, cur) => (cur === 'USD' ? '$' : cur === 'HKD' ? 'HK$' : '') + fmt(n);
    const isZh = (t) => t('dateLocale') === 'zh-CN';
    const nameOf = (t, o) => (isZh(t) ? o.name : o.nameEn || o.name);
    const readColors = () => { try { return localStorage.getItem(LS_COLOR) === 'down' ? 'down' : 'up'; } catch { return 'up'; } };
    const localClock = (tz, locale) => { try { return new Date().toLocaleTimeString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { return ''; } };

    let globePromise = null;
    function loadGlobe() {
      if (window.MkdGlobe) return Promise.resolve(window.MkdGlobe);
      if (!globePromise) {
        globePromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/plugin-api/market/globe.js';
          s.onload = () => (window.MkdGlobe ? resolve(window.MkdGlobe) : reject(new Error('globe missing')));
          s.onerror = () => { globePromise = null; reject(new Error('globe failed to load')); };
          document.head.appendChild(s);
        });
      }
      return globePromise;
    }

    function Spark(props) {
      const { candles, base } = props;
      if (!candles || candles.length < 2) return null;
      const w = 88; const ht = 24;
      const v = candles.map((c) => c.close);
      const min = Math.min(...v); const span = (Math.max(...v) - min) || 1;
      const d = v.map((y, i) => (i ? 'L' : 'M') + (i / (v.length - 1) * w).toFixed(1) + ',' + (ht - (y - min) / span * ht).toFixed(1)).join('');
      return h('svg', { width: w, height: ht, 'aria-hidden': true }, h('path', { d, fill: 'none', stroke: v[v.length - 1] >= (base ?? v[0]) ? 'var(--mkd-up)' : 'var(--mkd-dn)', strokeWidth: 1.4 }));
    }

    function Chart(props) {
      const { candles } = props;
      const [hover, setHover] = useState(null);
      if (!candles || candles.length < 2) return h('div', { className: 'mkd-err' }, '—');
      const W = 800; const H = 300; const L = 8; const R = 64; const T = 10; const B = 24;
      const ys = candles.map((c) => c.close);
      const min = Math.min(...ys); const max = Math.max(...ys); const pad = (max - min) * 0.08 || 1;
      const y0 = min - pad; const y1 = max + pad; const n = candles.length - 1;
      const X = (i) => L + (i / n) * (W - L - R);
      const Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
      const col = ys[n] >= ys[0] ? 'var(--mkd-up)' : 'var(--mkd-dn)';
      const line = ys.map((y, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(y).toFixed(1)).join('');
      const els = [];
      for (let i = 0; i <= 4; i++) {
        const v = y0 + (y1 - y0) * i / 4; const y = Y(v);
        els.push(h('line', { key: 'g' + i, x1: L, x2: W - R, y1: y, y2: y, stroke: 'var(--dsw-alias-border-l1)' }));
        els.push(h('text', { key: 'y' + i, x: W - R + 6, y: y + 4, fill: 'var(--dsw-alias-label-secondary)', fontSize: 11 }, fmt(v, priceDigits(v))));
        const idx = Math.round(n * i / 4);
        els.push(h('text', { key: 'x' + i, x: X(idx), y: H - 6, fill: 'var(--dsw-alias-label-secondary)', fontSize: 11, textAnchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle' }, candles[idx].date.slice(2)));
      }
      els.push(h('path', { key: 'area', d: line + 'L' + X(n) + ',' + (H - B) + 'L' + X(0) + ',' + (H - B) + 'Z', fill: col, opacity: 0.08 }));
      els.push(h('path', { key: 'line', d: line, fill: 'none', stroke: col, strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke' }));
      if (hover !== null) {
        els.push(h('line', { key: 'hl', x1: X(hover), x2: X(hover), y1: T, y2: H - B, stroke: 'var(--dsw-alias-label-secondary)' }));
        els.push(h('circle', { key: 'hd', cx: X(hover), cy: Y(ys[hover]), r: 4, fill: col }));
      }
      const onMove = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width * W;
        setHover(Math.max(0, Math.min(n, Math.round((mx - L) / (W - L - R) * n))));
      };
      return h('div', { className: 'mkd-chart' },
        h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', onMouseMove: onMove, onMouseLeave: () => setHover(null) }, els),
        hover !== null ? h('div', { className: 'mkd-tip mkd-num', style: { left: Math.min(X(hover) / W * 100, 70) + '%' } }, candles[hover].date + '  ' + fmt(ys[hover], priceDigits(ys[hover]))) : null);
    }
