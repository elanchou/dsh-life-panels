
    function CalcTab(props) {
      const { t } = props;
      const [f, setF] = useState({ price: '', currency: 'USD', costCny: '', shippingCny: '', dutyPct: '', vatPct: '0', platformFeePct: '15', fulfilFee: '', adPct: '', returnPct: '', rate: '', target: '20' });
      const [out, setOut] = useState(null);
      const [err, setErr] = useState(null);
      const [busy, setBusy] = useState(false);
      const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
      const req = (action) => ({
        action, price: numOrU(f.price), currency: f.currency.toUpperCase(), costCny: numOrU(f.costCny), shippingCny: numOrU(f.shippingCny), dutyPct: numOrU(f.dutyPct), vatPct: numOrU(f.vatPct),
        platformFeePct: numOrU(f.platformFeePct), fulfilFee: numOrU(f.fulfilFee), adPct: numOrU(f.adPct), returnPct: numOrU(f.returnPct), rate: numOrU(f.rate), targetMarginPct: numOrU(f.target),
      });
      const go = async (action) => {
        setBusy(true); setErr(null);
        try {
          const r = await call(req(action));
          if (action === 'price_for') { setF((x) => ({ ...x, price: String(r.price) })); setOut(r.result); } else setOut(r.result);
        } catch (e) { setErr(e.message); setOut(null); } finally { setBusy(false); }
      };
      const loc = t('dateLocale'); const cur = f.currency.toUpperCase();
      const rows = out ? [
        [t('netPrice'), fmt(out.netPrice, cur, loc)], ['VAT', fmt(out.vat, cur, loc)], [t('landed'), fmt(out.landed, cur, loc) + '  (' + fmt(out.landedCny, 'CNY', loc) + ')'],
        [t('fee'), fmt(out.platformFee, cur, loc)], [t('fulfil'), fmt(out.fulfilFee, cur, loc)], [t('ads'), fmt(out.ads, cur, loc)], [t('returns'), fmt(out.returns, cur, loc)],
        [t('breakEven'), out.breakEvenPrice === null ? '—' : fmt(out.breakEvenPrice, cur, loc)],
      ] : [];
      return h('div', { className: 'cb-calc' },
        h('div', { className: 'lp-card' },
          h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'calc', size: 15, className: 'lp-ico' }), t('calcTitle'))),
          h('p', { className: 'lp-muted cb-note' }, t('calcHint')),
          h('div', { className: 'cb-grid' },
            h(Field, { label: t('price'), value: f.price, onChange: set('price'), num: true }),
            h(Field, { label: t('currency'), value: f.currency, onChange: set('currency'), max: 5 }),
            h(Field, { label: t('cost'), value: f.costCny, onChange: set('costCny'), num: true }),
            h(Field, { label: t('freight'), value: f.shippingCny, onChange: set('shippingCny'), num: true }),
            h(Field, { label: t('duty'), value: f.dutyPct, onChange: set('dutyPct'), num: true }),
            h(Field, { label: t('vat'), value: f.vatPct, onChange: set('vatPct'), num: true }),
            h(Field, { label: t('fee'), value: f.platformFeePct, onChange: set('platformFeePct'), num: true }),
            h(Field, { label: t('fulfil'), value: f.fulfilFee, onChange: set('fulfilFee'), num: true }),
            h(Field, { label: t('ads'), value: f.adPct, onChange: set('adPct'), num: true }),
            h(Field, { label: t('returns'), value: f.returnPct, onChange: set('returnPct'), num: true }),
            h(Field, { label: t('rate'), value: f.rate, onChange: set('rate'), num: true }),
            h(Field, { label: t('targetMargin'), value: f.target, onChange: set('target'), num: true })),
          h('div', { className: 'cb-form-actions' },
            h('button', { type: 'button', className: 'lp-primary', disabled: busy || !(Number(f.price) > 0), onClick: () => go('calc'), title: Number(f.price) > 0 ? '' : t('needPrice') }, t('calcGo')),
            h('button', { type: 'button', className: 'lp-ghost', disabled: busy, onClick: () => go('price_for') }, t('priceFor')))),
        err ? h('div', { className: 'cb-err' }, h(ErrorBar, { error: err, onClose: () => setErr(null) })) : null,
        out ? h('div', { className: 'lp-card cb-result' },
          h('div', { className: 'cb-result-top' },
            h('b', { className: 'cb-big ' + (out.profit < 0 ? 'is-neg' : 'is-pos') }, fmt(out.profit, cur, loc)),
            h('span', { className: 'lp-muted' }, t('unit') + ' · ' + fmt(out.profitCny, 'CNY', loc)),
            h('span', { className: 'lp-pill ' + pctTone(out.marginPct) }, t('margin') + ' ' + out.marginPct + '%'),
            out.roiPct !== null ? h('span', { className: 'lp-pill' }, t('roi') + ' ' + out.roiPct + '%') : null),
          h('dl', { className: 'cb-dl' }, rows.map(([k, v]) => h('div', { key: k }, h('dt', { className: 'lp-muted' }, k), h('dd', null, v))))) : null);
    }
