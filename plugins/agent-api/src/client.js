window.__ModuleLoader__.load({
  id: '@local/agent-api',
  factory(require) {
    /* @kit */
    /* @suite */

    const PANEL_ID = 'agent-api';
    const NS = 'agent-api';
    const call = makeCall('/plugin-api/agent-api');

    const zh = {
      dateLocale: 'zh-CN', panel: 'Agent 接口', title: 'Agent 接口', eyebrow: 'Muse · Claude · ChatGPT · 脚本',
      intro: '让 DSH 之外的 Agent 读写这些面板：日历、笔记、稍后读、旅行、单词、专注、行情、新闻、播客、YouTube、电视。它们调用的是和面板同一套操作，数据就在这台电脑上，不需要经过 GitHub。',
      on: '开启接口', starting: '启动中…', offTitle: 'Agent 接口已关闭', offHint: '开启后只在本机 127.0.0.1 监听；要给云端 Agent 用，再打开下面的公网地址。',
      local: '本机地址', public: '公网地址', publicOn: '开启公网地址', publicHint: '通过 Cloudflare 临时隧道生成一个 https 地址，不需要账号。每次重启都会换一个新地址；电脑睡眠或关机时不可用。',
      publicMissing: '没有找到 cloudflared，请先运行 brew install cloudflared', publicStarting: '正在申请地址…',
      tokens: '令牌', newToken: '新建令牌', tokenName: '给谁用，例如 muse', read: '只读', write: '可读写', create: '创建',
      tokenOnce: '这是令牌原文，只显示这一次。把它和地址一起交给 Agent：', copy: '复制', copied: '已复制', revoke: '撤销', revokeConfirm: '撤销后使用它的 Agent 立即失效',
      never: '未使用', lastUsed: '最近使用 {t}', noTokens: '还没有令牌。每个 Agent 建一个，方便单独撤销。',
      howTo: '接入方法', mcpCfg: 'MCP 客户端（Claude、Cursor、Muse 等）', httpCfg: '纯 HTTP', urlOnly: '只能填一个地址的客户端，把令牌放进路径：',
      tools: '开放的工具', toolsHint: '云同步、局域网、iCafe 和本接口的设置永远不开放。只读令牌只能用读取类操作。', readOk: '只读可用',
      log: '最近调用', noLog: '还没有外部调用', ok: '成功', fail: '失败',
      warn: '令牌等同于你的数据的钥匙。公网地址任何人都能访问到，只有带正确令牌的请求才会被处理；连续输错会被限速。不用时请关掉公网地址。',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Agent API', title: 'Agent API', eyebrow: 'Muse · Claude · ChatGPT · scripts',
      intro: 'Let agents outside DSH read and change these panels: calendar, notes, reading list, trips, vocabulary, focus, market, news, podcasts, YouTube and TV. They call the same operations as the panels, on the data on this computer, without going through GitHub.',
      on: 'Enable the API', starting: 'Starting…', offTitle: 'The Agent API is off', offHint: 'When on it listens on 127.0.0.1 only; turn on the public URL below for cloud agents.',
      local: 'Local URL', public: 'Public URL', publicOn: 'Public URL', publicHint: 'A Cloudflare quick tunnel gives an https URL without an account. The URL changes on every restart and is down while the computer sleeps.',
      publicMissing: 'cloudflared was not found; run brew install cloudflared', publicStarting: 'Requesting a URL…',
      tokens: 'Tokens', newToken: 'New token', tokenName: 'Who it is for, e.g. muse', read: 'Read only', write: 'Read and write', create: 'Create',
      tokenOnce: 'This is the token. It is shown only once. Give it to the agent together with the URL:', copy: 'Copy', copied: 'Copied', revoke: 'Revoke', revokeConfirm: 'Agents using it stop working at once',
      never: 'never used', lastUsed: 'used {t}', noTokens: 'No tokens yet. Make one per agent so each can be revoked on its own.',
      howTo: 'How to connect', mcpCfg: 'MCP clients (Claude, Cursor, Muse, …)', httpCfg: 'Plain HTTP', urlOnly: 'For clients that take only a URL, put the token in the path:',
      tools: 'Tools offered', toolsHint: 'Cloud sync, LAN, iCafe and this API\'s own settings are never offered. A read-only token gets reading actions only.', readOk: 'read-only OK',
      log: 'Recent calls', noLog: 'No external calls yet', ok: 'ok', fail: 'failed',
      warn: 'A token is a key to your data. Anyone can reach the public URL, but only requests with a valid token are served, and repeated wrong tokens are rate limited. Turn the public URL off when you do not need it.',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
    };

    Object.assign(ICONS, {
      plug: ['M9 3v5', 'M15 3v5', 'M6 8h12v3a6 6 0 0 1-12 0z', 'M12 17v4'],
      key: ['M14.5 9.5a4.5 4.5 0 1 1-9 0a4.5 4.5 0 0 1 9 0z', 'M13 12.5l7 7', 'M17 16.5l2-2'],
      globe: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18', 'M12 3c2.5 3 2.5 15 0 18', 'M12 3c-2.5 3-2.5 15 0 18'],
      copy: ['M9 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z', 'M5 15V6a2 2 0 0 1 2-2h8'],
    });
    const Glyph = PanelGlyph('plug');

    function Switch(props) {
      return h('button', { type: 'button', role: 'switch', 'aria-checked': !!props.on, 'aria-label': props.label, disabled: props.disabled, className: 'aa-switch' + (props.on ? ' is-on' : ''), onClick: () => props.onChange(!props.on) }, h('i'));
    }
    function CopyBox(props) {
      const [done, setDone] = useState(false);
      const copy = async () => { try { await navigator.clipboard.writeText(props.text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* blocked */ } };
      return h('div', { className: 'aa-copy' + (props.block ? ' is-block' : '') },
        props.block ? h('pre', null, props.text) : h('code', null, props.text),
        h('button', { type: 'button', className: 'lp-ghost', onClick: copy }, h(Icon, { name: done ? 'check' : 'copy', size: 13 }), done ? props.t('copied') : props.t('copy')));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [api, setApi] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [name, setName] = useState('');
      const [scope, setScope] = useState('write');
      const [fresh, setFresh] = useState(null);
      const [confirm, setConfirm] = useState(null);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try { const r = await call({ action: 'status' }); if (alive.current) { setApi(r.api); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => { alive.current = true; load(); const id = setInterval(load, 4000); return () => { alive.current = false; clearInterval(id); }; }, [load]);
      const act = async (body) => {
        setBusy(true);
        try { const r = await call(body); if (r.api) setApi(r.api); setError(null); return r; }
        catch (e) { setError(t('saveFailed', { error: e.message })); return null; } finally { setBusy(false); }
      };
      const create = async (e) => {
        e.preventDefault();
        const r = await act({ action: 'create_token', name: name.trim() || 'agent', scope });
        if (r) { setFresh({ token: r.token, id: r.id }); setName(''); }
      };
      const on = !!(api && api.enabled);
      const base = api && (api.tunnel.url || api.local);
      const mcpUrl = base ? base + '/mcp' : '';
      const sampleToken = fresh ? fresh.token : '<token>';
      const mcpJson = JSON.stringify({ mcpServers: { 'elans-stack': { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer ' + sampleToken } } } }, null, 2);
      const curl = 'curl -s ' + (base || '') + '/v1/tools/dashboard_today \\\n  -H "Authorization: Bearer ' + sampleToken + '" \\\n  -H "content-type: application/json" -d \'{"action":"get"}\'';

      return h('div', { className: 'lp-root aa-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, t('eyebrow')), h('h1', { className: 'lp-title' }, t('title'))),
            api ? h('label', { className: 'aa-toggle' }, t('on'), h(Switch, { on, label: t('on'), disabled: busy, onChange: (v) => act({ action: v ? 'enable' : 'disable' }) })) : null),
          h(ErrorBar, { error, onRetry: load, retryLabel: t('retry'), onClose: () => setError(null) }),
          h('p', { className: 'lp-muted aa-p' }, t('intro')),
          !api ? h('div', { className: 'lp-skel', style: { height: 200, borderRadius: 18 } })
            : !on ? h('section', { className: 'lp-card' }, h(Empty, { icon: 'plug', text: t('offTitle') }, h('p', { className: 'lp-muted aa-p' }, t('offHint')),
              h('button', { type: 'button', className: 'lp-primary', disabled: busy, onClick: () => act({ action: 'enable' }) }, busy ? t('starting') : t('on'))))
              : h(React.Fragment, null,
                h('section', { className: 'lp-card aa-card' },
                  h('div', { className: 'aa-row' }, h('span', { className: 'aa-k' }, h(Icon, { name: 'plug', size: 14 }), t('local')), api.mcpLocal ? h(CopyBox, { t, text: api.mcpLocal }) : h('span', { className: 'lp-muted' }, api.error || t('starting'))),
                  h('div', { className: 'aa-row' },
                    h('span', { className: 'aa-k' }, h(Icon, { name: 'globe', size: 14 }), t('public')),
                    api.tunnel.url ? h(CopyBox, { t, text: api.tunnel.mcp }) : h('span', { className: 'lp-muted' }, !api.tunnel.available ? t('publicMissing') : api.tunnel.wanted ? (api.tunnel.error || t('publicStarting')) : ''),
                    h(Switch, { on: api.tunnel.wanted, label: t('publicOn'), disabled: busy || !api.tunnel.available, onChange: (v) => act({ action: 'tunnel', on: v }) })),
                  h('p', { className: 'lp-muted aa-p' }, t('publicHint'))),
                h('section', { className: 'lp-card aa-card' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'key', className: 'lp-ico' }), t('tokens'))),
                  h('form', { className: 'aa-new', onSubmit: create },
                    h('input', { className: 'aa-in', value: name, onChange: (e) => setName(e.target.value), placeholder: t('tokenName'), maxLength: 40, 'aria-label': t('tokenName') }),
                    h('select', { className: 'aa-in aa-sel', value: scope, onChange: (e) => setScope(e.target.value), 'aria-label': t('write') }, h('option', { value: 'write' }, t('write')), h('option', { value: 'read' }, t('read'))),
                    h('button', { type: 'submit', className: 'lp-primary', disabled: busy }, h(Icon, { name: 'plus', size: 14 }), t('create'))),
                  fresh ? h('div', { className: 'aa-fresh' }, h('p', null, t('tokenOnce')), h(CopyBox, { t, text: fresh.token })) : null,
                  !api.tokens.length ? h('p', { className: 'lp-muted aa-p' }, t('noTokens'))
                    : h('ul', { className: 'aa-list' }, api.tokens.map((tk) => h('li', { key: tk.id, className: 'aa-tk' },
                      h('div', { className: 'aa-tk-main' }, h('b', null, tk.name), h('span', { className: 'lp-pill' + (tk.scope === 'write' ? ' tone-warn' : '') }, tk.scope === 'write' ? t('write') : t('read')), h('code', { className: 'lp-muted' }, tk.hint)),
                      h('span', { className: 'lp-muted aa-used' }, tk.lastUsedAt ? t('lastUsed', { t: ago(tk.lastUsedAt, t) }) : t('never')),
                      confirm === tk.id ? h('span', { className: 'aa-confirm' }, h('span', { className: 'lp-muted' }, t('revokeConfirm')),
                        h('button', { type: 'button', className: 'lp-ghost', onClick: async () => { setConfirm(null); if (fresh && fresh.id === tk.id) setFresh(null); await act({ action: 'revoke_token', id: tk.id }); } }, t('revoke')))
                        : h('button', { type: 'button', className: 'lp-ghost', onClick: () => setConfirm(tk.id) }, t('revoke')))))),
                h('section', { className: 'lp-card aa-card' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'book', className: 'lp-ico' }), t('howTo'))),
                  h('h4', { className: 'aa-h4' }, t('mcpCfg')), h(CopyBox, { t, text: mcpJson, block: true }),
                  h('p', { className: 'lp-muted aa-p' }, t('urlOnly')), h(CopyBox, { t, text: (base || '') + '/mcp/' + sampleToken }),
                  h('h4', { className: 'aa-h4' }, t('httpCfg')), h(CopyBox, { t, text: curl, block: true })),
                h('section', { className: 'lp-card aa-card' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'settings', className: 'lp-ico' }), t('tools'))),
                  h('p', { className: 'lp-muted aa-p' }, t('toolsHint')),
                  h('div', { className: 'aa-tools' }, api.tools.map((x) => h('span', { key: x.name, className: 'aa-tool' }, h('code', null, x.name), x.read ? h('i', null, t('readOk')) : null)))),
                h('section', { className: 'lp-card aa-card' },
                  h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'clock', className: 'lp-ico' }), t('log'))),
                  !api.log.length ? h('p', { className: 'lp-muted aa-p' }, t('noLog'))
                    : h('ul', { className: 'aa-list aa-log' }, api.log.slice(0, 20).map((e, i) => {
                      const tk = api.tokens.find((x) => x.id === e.token);
                      return h('li', { key: i }, h('span', { className: 'lp-muted' }, ago(e.at, t)), h('b', null, tk ? tk.name : '?'), h('code', null, e.tool + (e.action ? '.' + e.action : '')),
                        h('span', { className: e.ok ? 'aa-ok' : 'aa-bad' }, e.ok ? t('ok') : t('fail') + (e.error ? ': ' + e.error.slice(0, 80) : '')), h('span', { className: 'lp-muted' }, e.ms + ' ms'));
                    }))),
                h('p', { className: 'lp-muted aa-p aa-warn' }, h(Icon, { name: 'alert', size: 14 }), ' ', t('warn')))),
        h('style', null, KIT_CSS + CSS));
    }

    const CSS = [
      '.aa-root{--lp-amb-a:var(' + OK + ');--lp-amb-b:var(' + BRAND + ');--lp-amb-c:var(' + WARN + ')}',
      '.aa-p{margin:0 2px 12px;font-size:12.5px;line-height:19px}',
      '.aa-toggle{display:inline-flex;align-items:center;gap:10px;font-size:13px;cursor:pointer}',
      '.aa-switch{position:relative;flex:none;width:44px;height:26px;padding:0;border:0;border-radius:999px;background:var(' + IDLE + ');cursor:pointer;transition:background .15s}',
      '.aa-switch i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}',
      '.aa-switch.is-on{background:var(' + OK + ')}', '.aa-switch.is-on i{transform:translateX(18px)}', '.aa-switch:disabled{opacity:.45;cursor:default}',
      '.aa-card{margin-bottom:14px;display:flex;flex-direction:column;gap:10px}',
      '.aa-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.aa-k{display:inline-flex;align-items:center;gap:6px;min-width:90px;font-size:13px;font-weight:600}',
      '.aa-copy{flex:1;min-width:0;display:flex;align-items:center;gap:8px}',
      '.aa-copy code,.aa-copy pre{flex:1;min-width:0;margin:0;padding:6px 10px;border-radius:9px;background:var(--lp-glass-soft);font-family:ui-monospace,Menlo,monospace;font-size:12px;overflow-x:auto;white-space:nowrap}',
      '.aa-copy.is-block{align-items:flex-start}', '.aa-copy.is-block pre{white-space:pre;line-height:18px}',
      '.aa-new{display:flex;gap:8px;flex-wrap:wrap}',
      '.aa-in{height:32px;box-sizing:border-box;padding:0 10px;border-radius:9px;border:1px solid var(--lp-glass-edge);outline:0;background:var(--lp-glass-soft);color:' + FG + ';font:inherit;font-size:13px}',
      '.aa-new .aa-in:first-child{flex:1;min-width:160px}', '.aa-sel{min-width:120px}',
      '.aa-fresh{padding:10px 12px;border-radius:12px;background:' + tint(WARN, 14) + ';display:flex;flex-direction:column;gap:6px}',
      '.aa-fresh p{margin:0;font-size:12.5px}',
      '.aa-list{list-style:none;margin:0;padding:0}',
      '.aa-tk{display:flex;align-items:center;gap:12px;padding:9px 2px;border-top:1px solid var(--lp-glass-edge);flex-wrap:wrap}', '.aa-tk:first-child{border-top:0}',
      '.aa-tk-main{flex:1;min-width:0;display:flex;align-items:center;gap:8px}', '.aa-tk-main code{font-size:11.5px}',
      '.aa-used{font-size:12px}', '.aa-confirm{display:inline-flex;align-items:center;gap:6px;font-size:12px}',
      '.aa-h4{margin:6px 0 0;font-size:12.5px;font-weight:650}',
      '.aa-tools{display:flex;flex-wrap:wrap;gap:6px}',
      '.aa-tool{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;background:var(--lp-glass-soft);font-size:12px}',
      '.aa-tool i{font-style:normal;font-size:10.5px;color:var(' + OK + ')}',
      '.aa-log li{display:grid;grid-template-columns:76px 80px minmax(0,1fr) auto 60px;gap:10px;align-items:center;padding:6px 2px;border-top:1px solid var(--lp-glass-edge);font-size:12px}',
      '.aa-log li:first-child{border-top:0}', '.aa-log code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aa-ok{color:var(' + OK + ')}', '.aa-bad{color:var(' + ERR + ');overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}',
      '.aa-warn{display:flex;align-items:flex-start;gap:4px}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'agent-api: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'settings', order: 30, label: () => t('panel'), icon: Glyph, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 33, label: () => t('panel'), locale: NS,
        }, Glyph)));
      },
    };
  },
});
