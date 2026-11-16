window.__ModuleLoader__.load({
  id: '@local/lan-host',
  factory(require) {
    /* @kit */
    /* @suite */

    const PANEL_ID = 'lan-host';
    const NS = 'lan-host';
    const call = makeCall('/plugin-api/lan-host');

    const zh = {
      panel: '局域网', title: '局域网访问', eyebrow: 'iPad · 手机 · 另一台电脑',
      intro: '在同一个 Wi-Fi 下，用 iPad 的相机扫描二维码，就能在 iPad 上使用这些面板。数据仍保存在这台电脑上。',
      on: '开启局域网访问', starting: '启动中…',
      offTitle: '局域网访问已关闭', offHint: '开启后，这台电脑会在局域网里开一个端口，iPad 通过二维码配对后访问。',
      scan: '用 iPad 相机扫描', copy: '复制链接', copied: '已复制', rotate: '更换密钥', rotateHint: '更换后所有已配对的设备立即失效，需要重新扫码',
      devices: '{n} 台设备在线', noDevices: '还没有设备连接', otherAddr: '其他地址',
      noLan: '没有找到局域网地址。请先连上 Wi-Fi 或有线网络。',
      shown: '在 iPad 上显示的面板', shownHint: '关闭后该面板对局域网设备不可用。云同步和 iCafe 永远不会开放。', locked: '不开放',
      warnTitle: '安全提示',
      warn: '链接里带有配对密钥，只在你自己的设备上打开。局域网内是明文 HTTP，请不要在公共 Wi-Fi 下开启。电视的代理设置、云同步令牌不会暴露。',
      tvNote: '电视面板的遥控功能在 iPad 上不可用；iPad 自己可以直接播放。',
      port: '端口', portHint: '默认 8765，被占用时自动顺延',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      'p.calendar-reminders': '日历与提醒',
      'p.news-feeds': '新闻速览',
      'p.reading-list': '稍后读',
      'p.travel-planner': '旅行计划',
      'p.podcasts': '播客',
      'p.vocabulary': '背单词',
      'p.focus': '专注',
      'p.youtube': 'YouTube',
      'p.iptv': 'IPTV 电视',
      'p.elans-stack': 'ElansStack（分组入口）',
      hint: '可以在对话里说“开启局域网访问”或“关掉局域网”',
    };
    const en = {
      panel: 'LAN', title: 'LAN access', eyebrow: 'iPad · phone · another computer',
      intro: 'On the same Wi-Fi, scan the QR code with the iPad camera to use these panels there. Your data stays on this computer.',
      on: 'Enable LAN access', starting: 'Starting…',
      offTitle: 'LAN access is off', offHint: 'When on, this computer opens a port on your network. The iPad pairs by scanning a QR code.',
      scan: 'Scan with the iPad camera', copy: 'Copy link', copied: 'Copied', rotate: 'Change key', rotateHint: 'Every paired device stops working until it scans the new code',
      devices: '{n} device(s) online', noDevices: 'No device connected yet', otherAddr: 'Other addresses',
      noLan: 'No LAN address found. Connect to Wi-Fi or Ethernet first.',
      shown: 'Panels shown on the iPad', shownHint: 'A hidden panel is unavailable to LAN devices. Cloud sync and iCafe are never exposed.', locked: 'never shared',
      warnTitle: 'Security',
      warn: 'The link carries the pairing key; open it only on your own devices. Traffic on the LAN is plain HTTP, so do not enable this on public Wi-Fi. The TV proxy setting and the sync token are not exposed.',
      tvNote: 'The TV phone-remote feature is not available on the iPad; the iPad can play channels itself.',
      port: 'Port', portHint: 'Default 8765; the next free port is used when taken',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      'p.calendar-reminders': 'Calendar & reminders',
      'p.news-feeds': 'News',
      'p.reading-list': 'Reading list',
      'p.travel-planner': 'Trips',
      'p.podcasts': 'Podcasts',
      'p.vocabulary': 'Vocabulary',
      'p.focus': 'Focus',
      'p.youtube': 'YouTube',
      'p.iptv': 'TV',
      'p.elans-stack': 'ElansStack (grouped entry)',
      hint: 'Ask in chat: “Turn on LAN access” or “Turn LAN access off”',
    };

    Object.assign(ICONS, {
      lan: ['M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 21h6', 'M12 17v4', 'M8.5 11.5a5 5 0 0 1 7 0', 'M10.4 13.7a2 2 0 0 1 3.2 0'],
      shield: ['M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z', 'M9 12l2 2 4-4'],
      copy: ['M9 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z', 'M5 15V6a2 2 0 0 1 2-2h8'],
      check: ICONS.check || ['M5 12.5l4.5 4.5L19 7'],
    });
    const LanGlyph = PanelGlyph('lan');

    function Switch(props) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': !!props.on, 'aria-label': props.label, disabled: props.disabled,
        className: 'lh-switch' + (props.on ? ' is-on' : ''), onClick: () => props.onChange(!props.on),
      }, h('i'));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [lan, setLan] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [copied, setCopied] = useState(false);
      const alive = useRef(true);
      const apply = useCallback(async (body) => {
        setBusy(true);
        try { const r = await call(body); if (alive.current) { setLan(r.lan); setError(null); } }
        catch (e) { if (alive.current) setError(t('saveFailed', { error: e.message })); }
        finally { if (alive.current) setBusy(false); }
      }, [t]);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'status' }); if (alive.current) { setLan(r.lan); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => { alive.current = true; load(); const id = setInterval(load, 4000); return () => { alive.current = false; clearInterval(id); }; }, [load]);
      const copy = async () => { try { await navigator.clipboard.writeText(lan.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };
      const on = !!(lan && lan.enabled);
      const label = (n) => { const v = t('p.' + n); return v === 'p.' + n ? n : v; };

      return h('div', { className: 'lp-root lh-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, t('eyebrow')), h('h1', { className: 'lp-title' }, t('title'))),
            lan ? h('label', { className: 'lh-toggle' }, t('on'), h(Switch, { on, label: t('on'), disabled: busy, onChange: (v) => apply({ action: v ? 'enable' : 'disable' }) })) : null),
          h(ErrorBar, { error, onRetry: load, retryLabel: t('retry'), onClose: () => setError(null) }),
          !lan ? h('div', { className: 'lp-skel', style: { height: 260, borderRadius: 20 } })
            : !on ? h('section', { className: 'lp-card' }, h(Empty, { icon: 'lan', text: t('offTitle') }, h('p', { className: 'lh-off-hint' }, t('offHint')),
              h('button', { type: 'button', className: 'lp-primary', disabled: busy, onClick: () => apply({ action: 'enable' }) }, busy ? t('starting') : t('on'))))
              : h(React.Fragment, null,
                h('section', { className: 'lp-card lh-pair' },
                  h('div', { className: 'lh-qr' },
                    lan.qr ? h('svg', { viewBox: '0 0 ' + lan.qr.size + ' ' + lan.qr.size, width: 232, height: 232, shapeRendering: 'crispEdges', role: 'img', 'aria-label': lan.url },
                      h('rect', { width: lan.qr.size, height: lan.qr.size, fill: '#fff' }), h('path', { d: lan.qr.d, fill: '#0b0c10' }))
                      : h('div', { className: 'lh-qr-none' }, h(Icon, { name: 'alert', size: 22 }), h('span', null, lan.error || t('noLan')))),
                  h('div', { className: 'lh-info' },
                    h('p', { className: 'lh-scan' }, h(Icon, { name: 'sparkle', size: 15 }), t('scan')),
                    h('p', { className: 'lp-muted lh-intro' }, t('intro')),
                    lan.url ? h('div', { className: 'lh-url' }, h('code', null, lan.url.replace(/\?k=.*/, '')),
                      h('button', { type: 'button', className: 'lp-ghost', onClick: copy }, h(Icon, { name: copied ? 'check' : 'copy', size: 14 }), copied ? t('copied') : t('copy'))) : null,
                    h('div', { className: 'lh-status' + (lan.devices ? ' is-on' : '') }, h('i'), lan.devices ? t('devices', { n: lan.devices }) : t('noDevices')),
                    lan.addresses && lan.addresses.length > 1 ? h('p', { className: 'lp-muted lh-alt' }, t('otherAddr') + '：' + lan.addresses.slice(1).map((a) => a.address + ':' + lan.port).join('  ')) : null,
                    h('button', { type: 'button', className: 'lp-ghost', disabled: busy, title: t('rotateHint'), onClick: () => apply({ action: 'rotate_key' }) }, h(Icon, { name: 'refresh', size: 14 }), t('rotate')))),
                h('section', { className: 'lp-card' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'lan', className: 'lp-ico' }), t('shown'))),
                  h('p', { className: 'lp-muted lh-sub' }, t('shownHint')),
                  h('ul', { className: 'lh-list' }, lan.plugins.map((p) => h('li', { key: p.name, className: 'lh-row' },
                    h('span', { className: 'lh-name' }, label(p.name)),
                    p.locked ? h('span', { className: 'lp-pill' }, t('locked'))
                      : h(Switch, { on: p.shown, label: label(p.name), disabled: busy, onChange: (v) => apply({ action: 'plugin', name: p.name, shown: v }) })))),
                  h('p', { className: 'lp-muted lh-sub' }, t('tvNote'))),
                h('section', { className: 'lp-card lh-warn' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'shield', className: 'lp-ico' }), t('warnTitle'))),
                  h('p', { className: 'lp-muted' }, t('warn')))),
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      '.lh-root{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + OK + ');--lp-amb-c:var(' + WARN + ')}',
      '.lh-toggle{display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer}',
      '.lh-switch{position:relative;flex:none;width:44px;height:26px;padding:0;border:0;border-radius:999px;background:var(' + IDLE + ');cursor:pointer;transition:background .15s}',
      '.lh-switch i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}',
      '.lh-switch.is-on{background:var(' + OK + ')}',
      '.lh-switch.is-on i{transform:translateX(18px)}',
      '.lh-switch:disabled{opacity:.5;cursor:default}',
      '.lh-switch:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:2px}',
      '.lh-off-hint{margin:0 0 14px;max-width:420px;color:' + FG2 + ';line-height:20px}',
      '.lh-pair{display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-bottom:14px}',
      '.lh-qr{flex:none;width:252px;height:252px;padding:10px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 36px -16px rgba(0,0,0,.45)}',
      '.lh-qr svg{display:block;width:100%;height:100%}',
      '.lh-qr-none{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px;text-align:center;color:#5b5e6b;font-size:12.5px}',
      '.lh-info{flex:1;min-width:240px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}',
      '.lh-scan{margin:0;display:flex;align-items:center;gap:6px;font-size:16px;font-weight:650}',
      '.lh-intro,.lh-alt,.lh-sub{margin:0;line-height:20px}',
      '.lh-url{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:100%}',
      '.lh-url code{padding:5px 10px;border-radius:10px;background:var(--lp-glass-soft);font-size:12.5px;word-break:break-all}',
      '.lh-status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:' + FG2 + '}',
      '.lh-status i{width:8px;height:8px;border-radius:50%;background:var(' + IDLE + ')}',
      '.lh-status.is-on{color:var(' + OK + ')}',
      '.lh-status.is-on i{background:var(' + OK + ');box-shadow:0 0 0 4px ' + tint(OK, 22) + '}',
      '.lh-list{list-style:none;margin:8px 0 12px;padding:0}',
      '.lh-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 4px;border-top:1px solid var(--lp-glass-edge)}',
      '.lh-row:first-child{border-top:0}',
      '.lh-name{font-size:14px}',
      '.lh-warn{margin-top:14px}',
      '.lh-warn p{margin:6px 0 0;line-height:20px}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'lan-host: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'settings', order: 20, label: () => t('panel'), icon: LanGlyph, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: () => t('panel'), locale: NS,
        }, LanGlyph)));
      },
    };
  },
});
