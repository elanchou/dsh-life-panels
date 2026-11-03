    /* ===== life-panels client kit (shared/client/kit.js, inlined by scripts/build.mjs) ===== */
    const React = require('react');
    const { useState, useEffect, useCallback, useRef, useMemo } = React;
    const h = React.createElement;

    function makeCall(api) {
      return async function call(body) {
        const response = await fetch(api, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify(body),
        });
        let data;
        try { data = await response.json(); } catch { data = null; }
        if (!response.ok || !data || data.ok === false) {
          const err = new Error((data && data.error) || ('HTTP ' + response.status));
          err.status = response.status;
          throw err;
        }
        return data;
      };
    }

    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const todayStr = () => ymd(new Date());
    const parseYmd = (s) => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
    const dayDiff = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 86400000);
    function fmtDate(s, locale, opts) {
      if (!s) return '';
      return parseYmd(s).toLocaleDateString(locale, opts || { month: 'short', day: 'numeric', weekday: 'short' });
    }
    function ago(iso, t) {
      if (!iso) return '';
      const ms = Date.now() - Date.parse(iso);
      if (!Number.isFinite(ms)) return '';
      const m = Math.round(ms / 60000);
      if (m < 1) return t('justNow');
      if (m < 60) return t('minutesAgo', { n: m });
      const hrs = Math.round(m / 60);
      if (hrs < 24) return t('hoursAgo', { n: hrs });
      const d = Math.round(hrs / 24);
      if (d < 30) return t('daysAgo', { n: d });
      return new Date(iso).toLocaleDateString(safeLocale(t), { year: 'numeric', month: 'short', day: 'numeric' });
    }
    function safeLocale(t) {
      const l = t('dateLocale');
      try { new Intl.DateTimeFormat(l); return l; } catch { return undefined; }
    }
    function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

    const ICONS = {
      left: ['M15 6l-6 6 6 6'], right: ['M9 6l6 6-6 6'], down: ['M6 9l6 6 6-6'],
      plus: ['M12 5v14', 'M5 12h14'], check: ['M5 12.5l4.5 4.5L19 7'], x: ['M6 6l12 12', 'M18 6L6 18'],
      clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7.5V12l3 2'],
      trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
      calendar: ['M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', 'M4 10h16', 'M8 2.5v3', 'M16 2.5v3'],
      sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'],
      alert: ['M12 8v5', 'M12 16.5v.01', 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0'],
      refresh: ['M20 11a8 8 0 0 0-14.9-3.5', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.9 3.5', 'M20 20v-4h-4'],
      search: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M20 20l-3.5-3.5'],
      external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'],
      bookmark: ['M6 4h12v17l-6-4-6 4z'],
      book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5', 'M8 7h7'],
      settings: ['M4 6h10', 'M18 6h2', 'M4 12h4', 'M12 12h8', 'M4 18h12', 'M20 18h0', 'M14 4v4', 'M8 10v4', 'M16 16v4'],
      rss: ['M5 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M5 11a8 8 0 0 1 8 8', 'M5 5a14 14 0 0 1 14 14'],
      note: ['M5 4h10l4 4v12H5z', 'M15 4v4h4', 'M8 12h8', 'M8 16h5'],
      tag: ['M3 12V4h8l10 10-8 8z', 'M7.5 8.5v.01'],
      pin: ['M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z', 'M12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
      plane: ['M10.5 13.5L3 11l1.5-1.5 8 1L17 6a2.1 2.1 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5', 'M3 21l4-4'],
      wallet: ['M4 7a2 2 0 0 1 2-2h12v4', 'M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z', 'M16 14h.01'],
      luggage: ['M7 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M9 7V4h6v3', 'M9 11v6', 'M15 11v6'],
      sun: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
      edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
    };
    function Icon(props) {
      const size = props.size || 16;
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: props.stroke || 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, className: props.className, style: { display: 'block', flex: 'none' },
      }, (ICONS[props.name] || []).map((d, i) => h('path', { key: i, d })));
    }
    function PanelGlyph(name) {
      return function PanelIcon(props) {
        return h(Icon, { name, size: props.size || 18, stroke: props.active ? 2 : 1.6 });
      };
    }
    function Stat(props) {
      return h('div', { className: 'lp-stat' + (props.tone ? ' ' + props.tone : '') },
        h('span', { className: 'lp-stat-icon' }, h(Icon, { name: props.icon, size: 16 })),
        h('span', { className: 'lp-stat-body' },
          h('span', { className: 'lp-stat-num' }, props.value),
          h('span', { className: 'lp-stat-label' }, props.label)));
    }
    function Empty(props) {
      return h('div', { className: 'lp-empty' },
        h('span', { className: 'lp-empty-icon' }, h(Icon, { name: props.icon || 'sparkle', size: 22 })),
        h('span', null, props.text),
        props.children || null);
    }
    function ErrorBar(props) {
      if (!props.error) return null;
      return h('div', { className: 'lp-error', role: 'alert' },
        h(Icon, { name: 'alert', size: 16 }), h('span', null, props.error),
        props.onRetry ? h('button', { type: 'button', className: 'lp-link', onClick: props.onRetry }, props.retryLabel) : null,
        props.onClose ? h('button', { type: 'button', className: 'lp-round lp-round-sm', onClick: props.onClose, 'aria-label': 'Close' }, h(Icon, { name: 'x', size: 14 })) : null);
    }
    function Tabs(props) {
      return h('div', { className: 'lp-tabs', role: 'tablist' }, props.items.map((it) =>
        h('button', {
          key: it.id, type: 'button', role: 'tab', 'aria-selected': props.value === it.id,
          className: 'lp-tab' + (props.value === it.id ? ' is-active' : ''), onClick: () => props.onChange(it.id),
        }, it.label, it.count !== undefined ? h('span', { className: 'lp-tab-n' }, it.count) : null)));
    }

    const tint = (token, pct) => 'color-mix(in srgb, var(' + token + ') ' + pct + '%, transparent)';
    const BRAND = '--dsw-alias-brand-primary';
    const ERR = '--dsw-alias-state-error-primary';
    const OK = '--dsw-alias-state-success-primary';
    const WARN = '--dsw-alias-state-warn-primary';
    const IDLE = '--dsw-alias-state-idle-primary';
    const L1 = 'var(--dsw-alias-bg-layer-1)';
    const L2 = 'var(--dsw-alias-bg-layer-2)';
    const B1 = 'var(--dsw-alias-border-l1)';
    const B2 = 'var(--dsw-alias-border-l2)';
    const FG = 'var(--dsw-alias-label-primary)';
    const FG2 = 'var(--dsw-alias-label-secondary)';

    /** Shared panel styles; every rule is scoped under .lp-root. */
    const KIT_CSS = [
      '.lp-root{box-sizing:border-box;height:100%;overflow:auto;color:' + FG + ';background:var(--dsw-alias-bg-base);font-size:13px}',
      '.lp-root *,.lp-root *::before,.lp-root *::after{box-sizing:border-box}',
      '.lp-root button,.lp-root input,.lp-root textarea,.lp-root select{font:inherit}',
      '.lp-root :focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:2px}',
      '.lp-inner{max-width:1120px;margin:0 auto;padding:28px 32px 40px}',
      '@media (max-width:820px){.lp-inner{padding:20px 16px 32px}}',
      '.lp-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:20px}',
      '.lp-eyebrow{display:block;font-size:12px;line-height:18px;color:var(' + BRAND + ');font-weight:500;letter-spacing:.02em}',
      '.lp-title{margin:2px 0 0;font-size:24px;line-height:32px;font-weight:650;letter-spacing:-.01em}',
      '.lp-stats{display:flex;gap:10px;flex-wrap:wrap}',
      '.lp-stat{display:flex;align-items:center;gap:10px;min-width:108px;padding:10px 14px 10px 10px;border-radius:14px;background:' + L1 + ';border:1px solid ' + B1 + '}',
      '.lp-stat-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;color:' + FG2 + ';background:' + L2 + '}',
      '.lp-stat-body{display:flex;flex-direction:column;min-width:0}',
      '.lp-stat-num{font-size:18px;line-height:22px;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.lp-stat-label{font-size:11px;line-height:15px;color:' + FG2 + '}',
      '.lp-stat.tone-brand .lp-stat-icon{color:var(' + BRAND + ');background:' + tint(BRAND, 14) + '}',
      '.lp-stat.tone-error .lp-stat-icon{color:var(' + ERR + ');background:' + tint(ERR, 14) + '}',
      '.lp-stat.tone-error .lp-stat-num{color:var(' + ERR + ')}',
      '.lp-stat.tone-success .lp-stat-icon{color:var(' + OK + ');background:' + tint(OK, 14) + '}',
      '.lp-stat.tone-warn .lp-stat-icon{color:var(' + WARN + ');background:' + tint(WARN, 14) + '}',
      '.lp-card{background:' + L1 + ';border:1px solid ' + B1 + ';border-radius:18px;padding:18px}',
      '.lp-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}',
      '.lp-card-title{display:flex;align-items:center;gap:8px;margin:0;font-size:14px;line-height:22px;font-weight:650}',
      '.lp-card-title .lp-ico{color:var(' + BRAND + ')}',
      '.lp-error{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;border-radius:12px;background:' + tint(ERR, 10) + ';color:var(' + ERR + ')}',
      '.lp-error span{flex:1}',
      '.lp-bar{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 14px;border-radius:14px;background:' + L1 + ';border:1px solid ' + B1 + ';transition:border-color .15s,box-shadow .15s}',
      '.lp-bar:focus-within{border-color:var(' + BRAND + ');box-shadow:0 0 0 3px ' + tint(BRAND, 16) + '}',
      '.lp-bar-icon{color:var(' + BRAND + ');display:inline-flex}',
      '.lp-bar-input{flex:1 1 200px;min-width:120px;height:36px;border:0;outline:0;background:transparent;color:' + FG + ';font-size:14px}',
      '.lp-bar-input::placeholder,.lp-input::placeholder,.lp-textarea::placeholder{color:' + FG2 + '}',
      '.lp-root .lp-bar-input:focus-visible{outline:0}',
      '.lp-field{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:9px;background:' + L2 + ';color:' + FG2 + '}',
      '.lp-field input,.lp-field select{border:0;outline:0;background:transparent;color:' + FG + ';font-size:12.5px;font-variant-numeric:tabular-nums;color-scheme:light dark;min-width:0}',
      '.lp-input,.lp-textarea,.lp-select{width:100%;padding:0 10px;height:34px;border-radius:10px;border:1px solid ' + B2 + ';background:' + L1 + ';color:' + FG + ';font-size:13px;color-scheme:light dark}',
      '.lp-textarea{height:auto;min-height:72px;padding:8px 10px;line-height:20px;resize:vertical}',
      '.lp-input:focus,.lp-textarea:focus,.lp-select:focus{outline:0;border-color:var(' + BRAND + ');box-shadow:0 0 0 3px ' + tint(BRAND, 16) + '}',
      '.lp-primary{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 16px;border-radius:10px;border:0;background:var(' + BRAND + ');color:#fff;font-weight:600;cursor:pointer;white-space:nowrap;transition:filter .15s,opacity .15s}',
      '.lp-primary:hover:not(:disabled){filter:brightness(1.08)}',
      '.lp-primary:disabled{opacity:.4;cursor:default}',
      '.lp-ghost{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;border:1px solid ' + B2 + ';background:transparent;color:' + FG + ';font-size:12.5px;cursor:pointer;white-space:nowrap}',
      '.lp-ghost:hover:not(:disabled){background:' + L2 + '}',
      '.lp-ghost:disabled{opacity:.5;cursor:default}',
      '.lp-round{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:0;background:transparent;color:' + FG2 + ';cursor:pointer;flex:none}',
      '.lp-round:hover{background:' + L2 + ';color:' + FG + '}',
      '.lp-round-sm{width:24px;height:24px}',
      '.lp-round.is-danger:hover{color:var(' + ERR + ');background:' + tint(ERR, 12) + '}',
      '.lp-round.is-on{color:var(' + BRAND + ')}',
      '.lp-tabs{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:11px;background:' + L2 + '}',
      '.lp-tab{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:' + FG2 + ';font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap}',
      '.lp-tab.is-active{background:' + L1 + ';color:' + FG + ';box-shadow:0 1px 2px ' + tint('--dsw-alias-label-primary', 12) + '}',
      '.lp-tab-n{font-size:11px;font-variant-numeric:tabular-nums;color:' + FG2 + '}',
      '.lp-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;color:' + FG2 + ';background:' + L2 + ';white-space:nowrap}',
      '.lp-pill.tone-brand{color:var(' + BRAND + ');background:' + tint(BRAND, 14) + '}',
      '.lp-pill.tone-success{color:var(' + OK + ');background:' + tint(OK, 14) + '}',
      '.lp-pill.tone-warn{color:var(' + WARN + ');background:' + tint(WARN, 14) + '}',
      '.lp-pill.tone-error{color:var(' + ERR + ');background:' + tint(ERR, 14) + '}',
      '.lp-muted{color:' + FG2 + '}',
      '.lp-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 12px;color:' + FG2 + ';font-size:12.5px;text-align:center}',
      '.lp-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;color:var(' + BRAND + ');background:' + tint(BRAND, 10) + '}',
      '.lp-link{border:0;background:transparent;padding:0;color:inherit;font-weight:600;text-decoration:underline;cursor:pointer}',
      '.lp-hint{display:flex;align-items:center;gap:6px;justify-content:center;margin:22px 0 0;color:' + FG2 + ';font-size:12px;text-align:center}',
      '.lp-loading{padding:40px 0;text-align:center;color:' + FG2 + '}',
      '.lp-skel{border-radius:8px;background:linear-gradient(90deg,' + L2 + ' 0%,' + tint('--dsw-alias-border-l1', 60) + ' 50%,' + L2 + ' 100%);background-size:200% 100%;animation:lp-shimmer 1.4s ease-in-out infinite}',
      '@keyframes lp-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}',
      '.lp-spin{animation:lp-spin 1s linear infinite}',
      '@keyframes lp-spin{to{transform:rotate(360deg)}}',
      '.lp-progress{height:6px;border-radius:999px;background:' + L2 + ';overflow:hidden}',
      '.lp-progress > i{display:block;height:100%;border-radius:inherit;background:var(' + BRAND + ');transition:width .25s}',
      '.lp-progress.tone-error > i{background:var(' + ERR + ')}',
      '.lp-progress.tone-success > i{background:var(' + OK + ')}',
      '@media (prefers-reduced-motion:reduce){.lp-root *{transition:none!important;animation:none!important}}',
    ].join('');
    /* ===== end kit ===== */
