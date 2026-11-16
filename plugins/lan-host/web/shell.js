/*
 * LAN shell. Plugin bundles are written for the Harness page: each calls window.__ModuleLoader__.load({ id, factory })
 * and its factory returns { apply(ctx) } that registers a sidebar icon, a main panel and a locale dictionary.
 * This file provides just enough of that surface (React, ctx.effect, ctx.locale, ctx.slots, ctx.get('layout'))
 * to run those bundles unchanged on another device.
 */
(function () {
  'use strict';
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const h = React.createElement;
  window.__DSH_LAN__ = true; // lets a plugin skip features that only make sense on the computer

  const lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  const TEXT = {
    zh: { loading: '正在载入…', empty: '没有可用的面板', emptyHint: '请在电脑上的「局域网」面板里打开至少一个面板。', locked: '配对已失效', lockedHint: '电脑上重新生成了密钥。请在电脑的「局域网」面板里重新扫描二维码。', failed: '载入失败', broken: '这个面板出错了', retry: '重试' },
    en: { loading: 'Loading…', empty: 'No panels available', emptyHint: 'Allow at least one panel in the LAN panel on the computer.', locked: 'Pairing expired', lockedHint: 'The key was rotated on the computer. Scan the QR code in the LAN panel again.', failed: 'Failed to load', broken: 'This panel crashed', retry: 'Retry' },
  }[lang];

  const dicts = new Map(); // locale namespace -> { zh, en }
  const queue = [];
  const mains = new Map(); // panel key -> { Comp, ns }
  const rail = []; // { id, order, label, Icon, ns }
  const overlays = [];
  const problems = [];
  window.__ModuleLoader__ = { load(def) { queue.push(def); } };

  function bind(ns) {
    return function t(key, params) {
      const d = dicts.get(ns) || {};
      let s = (d[lang] || {})[key];
      if (s === undefined) s = (d.en || {})[key];
      if (s === undefined) s = (d.zh || {})[key];
      if (s === undefined) return key;
      return params ? String(s).replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : params[k])) : s;
    };
  }

  const listeners = new Set();
  let active = null;
  try { active = localStorage.getItem('dsh.lan.panel'); } catch { /* storage blocked */ }
  function select(id) {
    if (!mains.has(id)) return;
    active = id;
    try { localStorage.setItem('dsh.lan.panel', id); } catch { /* ignore */ }
    listeners.forEach((fn) => fn());
  }

  function makeCtx(name) {
    const guard = (fn) => { try { return fn(); } catch (error) { problems.push(name + ': ' + (error && error.message)); console.error(name, error); return undefined; } };
    return {
      effect(fn) { guard(fn); },
      get(key) { return key === 'layout' ? { selectPanel: select } : null; },
      locale: { register(ns, d) { dicts.set(ns, d); return () => {}; }, bind },
      slots: {
        inject(slot, fn) { guard(fn); },
        register(opts, Comp) {
          if (opts.name === 'main') mains.set(opts.key, { Comp, ns: opts.locale });
          else if (opts.name === 'sidebar.panellist') rail.push({ id: opts.id, order: opts.order || 0, label: opts.label, Icon: Comp, ns: opts.locale });
          else if (opts.name === 'shell.overlay') overlays.push({ id: opts.id, order: opts.order || 0, Comp });
          return () => {};
        },
      },
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = () => resolve(queue.splice(0));
      el.onerror = () => reject(new Error('could not load ' + src));
      document.head.appendChild(el);
    });
  }

  async function boot() {
    const res = await fetch('/_lan/manifest', { credentials: 'same-origin' });
    if (res.status === 401) { const e = new Error('locked'); e.locked = true; throw e; }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { plugins } = await res.json();
    const groups = await Promise.all(plugins.map((p) => loadScript(p.src).then((defs) => ({ name: p.name, defs }), (error) => { problems.push(p.name + ': ' + error.message); return { name: p.name, defs: [] }; })));
    for (const { name, defs } of groups) {
      for (const def of defs) {
        try {
          const mod = def.factory((id) => { if (id === 'react') return React; throw new Error('unsupported module ' + id); });
          if (mod && typeof mod.apply === 'function') mod.apply(makeCtx(name));
        } catch (error) { problems.push(name + ': ' + (error && error.message)); console.error(name, error); }
      }
    }
    rail.sort((a, b) => a.order - b.order);
    overlays.sort((a, b) => a.order - b.order);
    if (!mains.has(active)) active = (rail.find((r) => mains.has(r.id)) || {}).id || null;
  }

  class Boundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { console.error(error); }
    render() {
      if (!this.state.error) return this.props.children;
      if (this.props.quiet) return null;
      return h('div', { className: 'lan-note' }, h('b', null, TEXT.broken), h('span', null, String(this.state.error && this.state.error.message || this.state.error)),
        h('button', { onClick: () => this.setState({ error: null }), style: { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'inherit', fontSize: 14 } }, TEXT.retry));
    }
  }

  function App() {
    const [state, setState] = React.useState({ phase: 'loading', error: null });
    const [, force] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => { listeners.add(force); return () => listeners.delete(force); }, []);
    const start = React.useCallback(() => {
      setState({ phase: 'loading', error: null });
      boot().then(() => setState({ phase: 'ready', error: null }), (error) => setState({ phase: error.locked ? 'locked' : 'error', error }));
    }, []);
    React.useEffect(start, [start]);

    if (state.phase === 'loading') return h('div', { className: 'lan-note' }, h('div', { className: 'lan-spin' }), h('span', null, TEXT.loading));
    if (state.phase === 'locked') return h('div', { className: 'lan-note' }, h('b', null, TEXT.locked), h('span', null, TEXT.lockedHint));
    if (state.phase === 'error') return h('div', { className: 'lan-note' }, h('b', null, TEXT.failed), h('span', null, String(state.error && state.error.message)),
      h('button', { onClick: start, style: { padding: '8px 18px', borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'inherit', fontSize: 14 } }, TEXT.retry));

    const items = rail.filter((r) => mains.has(r.id));
    const cur = mains.get(active);
    return h('div', { className: 'lan-shell' },
      h('nav', { className: 'lan-rail', 'aria-label': 'Panels' }, items.map((r) => {
        const on = r.id === active;
        const label = typeof r.label === 'function' ? r.label() : r.label || r.id;
        return h('button', { key: r.id, className: 'lan-btn' + (on ? ' on' : ''), onClick: () => select(r.id), 'aria-current': on ? 'page' : undefined, title: label },
          h(r.Icon, { size: 22, active: on }), h('span', null, label));
      })),
      h('main', { className: 'lan-main' },
        cur ? h(Boundary, { key: active }, h(cur.Comp, { t: bind(cur.ns) }))
          : h('div', { className: 'lan-note' }, h('b', null, TEXT.empty), h('span', null, TEXT.emptyHint))),
      overlays.map((o) => h(Boundary, { key: o.id, quiet: true }, h(o.Comp))));
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
  window.__DSH_LAN_PROBLEMS__ = problems;
})();
