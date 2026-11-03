window.__ModuleLoader__.load({
  id: '@local/cloud-sync',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'cloud-sync';
    const NS = 'cloud-sync';
    const call = makeCall('/plugin-api/cloud-sync');

    const zh = {
      dateLocale: 'zh-CN', panel: '云同步', title: '云同步',
      intro: '把日历、新闻订阅、稍后读、旅行、播客、单词和专注数据同步到你自己的 GitHub 私有仓库。每次同步是一次提交，可以在 GitHub 上查看历史和回滚。',
      statFiles: '个数据文件', statLast: '上次同步', statState: '状态', never: '从未', ok: '正常', failed: '出错', off: '未连接',
      connectTitle: '连接 GitHub', token: '访问令牌（Fine-grained token）', tokenPh: 'github_pat_…', tokenKeep: '已保存令牌，留空则继续使用',
      owner: '所有者', ownerPh: '默认是令牌对应的账号', repo: '仓库名', create: '仓库不存在时自动创建（私有）', connect: '连接并同步', cancel: '取消', connecting: '连接中…',
      howTitle: '如何获取令牌', how1: '打开 GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token',
      how2: 'Repository access 选 “Only select repositories”，选中同步仓库（要自动创建就先选 “All repositories”，创建后再收窄）',
      how3: 'Permissions → Repository permissions → Contents 设为 “Read and write”；Metadata 只读会自动勾选', how4: '自动创建仓库还需要账号级 Administration 写权限，否则请先在 GitHub 手动建一个私有仓库',
      openGithub: '打开令牌页面', secure: '令牌保存在 Harness 凭据存储里，不写入数据文件，也不会发给 Agent。',
      repoCard: '同步仓库', viewCommits: '查看提交历史', syncNow: '立即同步', syncing: '同步中…', disconnect: '断开', disconnectConfirm: '断开后本机不再同步，并删除保存的令牌。GitHub 上的数据不会删除。确定吗？',
      auto: '自动同步', everyPre: '每', everySuffix: '分钟一次；本地有修改时约 1.5 分钟后同步', device: '本机：{name}',
      filesCard: '数据文件', logCard: '同步记录', noLog: '还没有同步记录',
      'file.calendar-reminders': '日历和提醒', 'file.news-feeds': '新闻订阅源', 'file.reading-list': '稍后读', 'file.travel-planner': '旅行计划', 'file.podcasts': '播客订阅和进度', 'file.vocabulary': '单词进度', 'file.focus': '专注记录',
      'st.uploaded': '已上传', 'st.downloaded': '已拉取', 'st.merged': '已合并', 'st.unchanged': '无变化', 'st.empty': '无数据', 'st.error': '出错', 'st.pending': '待同步',
      conflicts: '{n} 处冲突已按较新修改处理',
      'reason.manual': '手动', 'reason.startup': '启动', 'reason.interval': '定时', 'reason.local change': '本地修改', 'reason.connect': '连接',
      nothingChanged: '无变化', justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
      loadFailed: '加载失败：{error}', retry: '重试', loading: '加载中…',
      hint: '多台电脑装同样的插件、连同一个仓库即可互相同步。可以在对话里问“同步状态怎么样”。',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Cloud sync', title: 'Cloud sync',
      intro: 'Sync calendar, news feeds, reading list, travel, podcast, vocabulary and focus data to your own private GitHub repository. Each sync is a commit, so history and rollback live on GitHub.',
      statFiles: 'data files', statLast: 'last sync', statState: 'status', never: 'never', ok: 'OK', failed: 'error', off: 'not connected',
      connectTitle: 'Connect GitHub', token: 'Fine-grained access token', tokenPh: 'github_pat_…', tokenKeep: 'A token is saved; leave empty to keep it',
      owner: 'Owner', ownerPh: 'defaults to the token account', repo: 'Repository', create: 'Create it (private) if missing', connect: 'Connect and sync', cancel: 'Cancel', connecting: 'Connecting…',
      howTitle: 'Getting a token', how1: 'GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token',
      how2: 'Repository access: “Only select repositories” and pick the sync repo (choose “All repositories” to auto-create, then narrow it)',
      how3: 'Repository permissions → Contents: “Read and write”; Metadata read-only is added automatically', how4: 'Auto-creating also needs account Administration write; otherwise create a private repo on GitHub first',
      openGithub: 'Open token page', secure: 'The token is kept in the Harness credential store, not in data files, and is never sent to the agent.',
      repoCard: 'Repository', viewCommits: 'View commits', syncNow: 'Sync now', syncing: 'Syncing…', disconnect: 'Disconnect', disconnectConfirm: 'This device stops syncing and the saved token is removed. Data on GitHub stays. Continue?',
      auto: 'Automatic sync', everyPre: 'every', everySuffix: 'min, and about 1.5 min after a local edit', device: 'This device: {name}',
      filesCard: 'Data files', logCard: 'Sync log', noLog: 'No syncs yet',
      'file.calendar-reminders': 'Calendar & reminders', 'file.news-feeds': 'News feeds', 'file.reading-list': 'Reading list', 'file.travel-planner': 'Trips', 'file.podcasts': 'Podcasts & progress', 'file.vocabulary': 'Vocabulary progress', 'file.focus': 'Focus sessions',
      'st.uploaded': 'uploaded', 'st.downloaded': 'pulled', 'st.merged': 'merged', 'st.unchanged': 'unchanged', 'st.empty': 'no data', 'st.error': 'error', 'st.pending': 'pending',
      conflicts: '{n} conflicts resolved by newest edit',
      'reason.manual': 'manual', 'reason.startup': 'startup', 'reason.interval': 'scheduled', 'reason.local change': 'local edit', 'reason.connect': 'connect',
      nothingChanged: 'no changes', justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
      loadFailed: 'Failed to load: {error}', retry: 'Retry', loading: 'Loading…',
      hint: 'Install the same plugins on another computer and connect the same repository to sync both. Ask in chat: “How is sync doing?”',
    };

    Object.assign(ICONS, {
      cloud: ['M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z'],
      sync: ['M4 12a8 8 0 0 1 14-5.3L20 9', 'M20 4v5h-5', 'M20 12a8 8 0 0 1-14 5.3L4 15', 'M4 20v-5h5'],
      lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
      github: ['M9 19c-4 1.3-4-2-5.5-2.5', 'M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.6 5.6 2.9 5.6 2.9a4.3 4.3 0 0 0-.1 3.2 4.6 4.6 0 0 0-1.3 3.2c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21'],
      file: ['M7 3h7l4 4v14H7z', 'M14 3v4h4'],
    });
    const TONE = { uploaded: 'tone-brand', downloaded: 'tone-brand', merged: 'tone-warn', unchanged: '', empty: '', error: 'tone-error', pending: '' };

    function ConnectCard(props) {
      const { t, status, onDone } = props;
      const [token, setToken] = useState('');
      const [owner, setOwner] = useState((status.repo && status.repo.owner) || '');
      const [repo, setRepo] = useState((status.repo && status.repo.repo) || 'dsh-life-data');
      const [create, setCreate] = useState(true);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);
      const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try { await call({ action: 'connect', token: token.trim() || undefined, owner: owner.trim() || undefined, repo: repo.trim(), create }); setToken(''); onDone(); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
      };
      return h('div', { className: 'cs-grid' },
        h('form', { className: 'lp-card cs-connect', onSubmit: submit },
          h('div', { className: 'lp-card-head' }, h('span', { className: 'lp-card-title' }, h(Icon, { name: 'github', size: 16 }), t('connectTitle'))),
          h(ErrorBar, { error, onClose: () => setError(null) }),
          h('label', { className: 'cs-label' }, t('token'),
            h('input', { className: 'lp-input', type: 'password', autoComplete: 'off', spellCheck: false, value: token, onChange: (e) => setToken(e.target.value), placeholder: status.tokenSaved ? t('tokenKeep') : t('tokenPh') })),
          h('div', { className: 'cs-row' },
            h('label', { className: 'cs-label' }, t('owner'), h('input', { className: 'lp-input', value: owner, onChange: (e) => setOwner(e.target.value), placeholder: t('ownerPh') })),
            h('label', { className: 'cs-label' }, t('repo'), h('input', { className: 'lp-input', value: repo, onChange: (e) => setRepo(e.target.value), required: true }))),
          h('label', { className: 'cs-check' }, h('input', { type: 'checkbox', checked: create, onChange: (e) => setCreate(e.target.checked) }), t('create')),
          h('button', { type: 'submit', className: 'lp-primary cs-submit', disabled: busy || (!token.trim() && !status.tokenSaved) || !repo.trim() },
            busy ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'sync', size: 14 }), busy ? t('connecting') : t('connect')),
          props.onCancel ? h('button', { type: 'button', className: 'lp-ghost cs-submit', onClick: props.onCancel }, t('cancel')) : null,
          h('p', { className: 'cs-secure' }, h(Icon, { name: 'lock', size: 13 }), t('secure'))),
        h('div', { className: 'lp-card cs-how' },
          h('div', { className: 'lp-card-head' }, h('span', { className: 'lp-card-title' }, t('howTitle'))),
          h('ol', null, ['how1', 'how2', 'how3', 'how4'].map((k) => h('li', { key: k }, t(k)))),
          h('a', { className: 'lp-ghost cs-link', href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener noreferrer' }, h(Icon, { name: 'external', size: 13 }), t('openGithub'))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [editing, setEditing] = useState(false);
      const alive = useRef(true);
      const load = useCallback(async () => {
        try { const s = await call({ action: 'status' }); if (alive.current) { setStatus(s); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => {
        alive.current = true; load();
        const id = setInterval(load, 15000);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);
      const act = async (body) => {
        setBusy(true);
        try { const s = await call(body); if (alive.current) { setStatus((prev) => ({ ...prev, ...s })); setError(null); } }
        catch (e) { if (alive.current) setError(e.message); } finally { if (alive.current) setBusy(false); }
      };

      const s = status;
      const syncing = busy || (s && s.syncing);
      const stateLabel = !s || !s.connected ? t('off') : s.lastError ? t('failed') : t('ok');
      const stateTone = !s || !s.connected ? '' : s.lastError ? 'tone-error' : 'tone-success';
      let body;
      if (!s) body = h('div', { className: 'lp-loading' }, t('loading'));
      else if (!s.connected || editing) body = h(ConnectCard, { t, status: s, onDone: () => { setEditing(false); load(); }, onCancel: s.connected ? () => setEditing(false) : null });
      else {
        body = h('div', { className: 'cs-grid' },
          h('div', { className: 'cs-col' },
            h('div', { className: 'lp-card cs-repo' },
              h('div', { className: 'cs-repo-main' },
                h('span', { className: 'cs-repo-icon' }, h(Icon, { name: 'github', size: 22 })),
                h('div', { className: 'cs-repo-body' },
                  h('div', { className: 'cs-repo-name' }, s.repo.owner + '/' + s.repo.repo, h('span', { className: 'lp-pill' }, h(Icon, { name: 'lock', size: 11 }), s.repo.branch)),
                  h('div', { className: 'cs-sub' }, t('device', { name: s.device })))),
              s.lastError ? h('div', { className: 'lp-error cs-err' }, h(Icon, { name: 'alert', size: 15 }), h('span', null, s.lastError)) : null,
              h('div', { className: 'cs-actions' },
                h('button', { type: 'button', className: 'lp-primary', disabled: syncing, onClick: () => act({ action: 'sync' }) },
                  h(Icon, { name: 'sync', size: 14, className: syncing ? 'lp-spin' : '' }), syncing ? t('syncing') : t('syncNow')),
                h('a', { className: 'lp-ghost cs-link', href: s.repo.url, target: '_blank', rel: 'noopener noreferrer' }, h(Icon, { name: 'external', size: 13 }), t('viewCommits')),
                h('span', { className: 'cs-spacer' }),
                h('button', { type: 'button', className: 'lp-ghost', onClick: () => setEditing(true) }, h(Icon, { name: 'settings', size: 13 })),
                h('button', { type: 'button', className: 'lp-ghost cs-danger', onClick: () => { if (window.confirm(t('disconnectConfirm'))) act({ action: 'disconnect' }); } }, t('disconnect'))),
              h('label', { className: 'cs-auto' },
                h('input', { type: 'checkbox', checked: !!s.auto, onChange: (e) => act({ action: 'settings', auto: e.target.checked }) }),
                h('span', null, h('b', null, t('auto')), ' · ', t('everyPre'), ' ',
                  h('select', { className: 'cs-interval', value: s.intervalMin, disabled: !s.auto, onChange: (e) => act({ action: 'settings', intervalMin: Number(e.target.value) }), 'aria-label': t('auto') },
                    [5, 10, 30, 60, 240].concat([5, 10, 30, 60, 240].includes(s.intervalMin) ? [] : [s.intervalMin]).map((n) => h('option', { key: n, value: n }, n))),
                  ' ', t('everySuffix')))),
            h('div', { className: 'lp-card' },
              h('div', { className: 'lp-card-head' }, h('span', { className: 'lp-card-title' }, t('filesCard'))),
              h('ul', { className: 'cs-files' }, s.files.map((f) => {
                const st = f.error ? 'error' : f.status || 'pending';
                return h('li', { key: f.name, className: 'cs-file' },
                  h('span', { className: 'cs-file-icon' }, h(Icon, { name: 'file', size: 15 })),
                  h('span', { className: 'cs-file-body' },
                    h('span', { className: 'cs-file-name' }, t('file.' + f.name)),
                    h('span', { className: 'cs-sub', title: f.error || '' }, f.error ? f.error : f.at ? ago(f.at, t) + (f.conflicts ? ' · ' + t('conflicts', { n: f.conflicts }) : '') : '—')),
                  h('span', { className: 'lp-pill ' + (TONE[st] || '') }, t('st.' + st)));
              })))),
          h('div', { className: 'lp-card cs-log' },
            h('div', { className: 'lp-card-head' }, h('span', { className: 'lp-card-title' }, t('logCard'))),
            !s.log.length ? h(Empty, { icon: 'clock', text: t('noLog') })
              : h('ul', { className: 'cs-log-list' }, s.log.map((e, i) => h('li', { key: e.at + i, className: 'cs-log-item' + (e.error ? ' is-error' : '') },
                h('span', { className: 'cs-dot' }),
                h('span', { className: 'cs-log-body' },
                  h('span', { className: 'cs-log-head' }, ago(e.at, t), h('span', { className: 'cs-sub' }, ' · ' + t('reason.' + e.reason))),
                  e.error ? h('span', { className: 'cs-log-err' }, e.error)
                    : h('span', { className: 'cs-sub' }, e.changes.length ? e.changes.map((c) => t('file.' + c.name) + ' ' + t('st.' + c.status) + (c.conflicts ? ' (' + c.conflicts + ')' : '')).join('，') : t('nothingChanged'))))))));
      }

      return h('div', { className: 'lp-root cs-root' },
        h('style', null, KIT_CSS + CSS),
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, 'GitHub'), h('h1', { className: 'lp-title' }, t('title')), h('p', { className: 'cs-intro' }, t('intro'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'file', value: s ? s.files.length : '–', label: t('statFiles'), tone: 'tone-brand' }),
              h(Stat, { icon: 'clock', value: s && s.lastSyncAt ? ago(s.lastSyncAt, t) : t('never'), label: t('statLast'), tone: 'tone-warn' }),
              h(Stat, { icon: 'cloud', value: stateLabel, label: t('statState'), tone: stateTone }))),
          h(ErrorBar, { error, onRetry: load, retryLabel: t('retry'), onClose: () => setError(null) }),
          body,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint'))));
    }

    const CSS = [
      '.cs-root{--lp-amb-b:var(' + BRAND + ');--lp-amb-c:var(' + OK + ')}',
      '.cs-intro{margin:6px 0 0;max-width:560px;font-size:12.5px;line-height:20px;color:' + FG2 + '}',
      '.cs-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:start}',
      '@media (max-width:860px){.cs-grid{grid-template-columns:1fr}}',
      '.cs-col{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.cs-connect{display:flex;flex-direction:column;gap:12px}',
      '.cs-label{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;font-size:12px;font-weight:600;color:' + FG2 + '}',
      '.cs-row{display:flex;gap:12px;flex-wrap:wrap}',
      '.cs-check,.cs-auto{display:flex;align-items:center;gap:8px;font-size:12.5px;color:' + FG2 + ';cursor:pointer}',
      '.cs-check input,.cs-auto input{accent-color:var(' + BRAND + ')}',
      '.cs-auto{margin-top:14px;padding-top:14px;border-top:1px solid ' + B1 + '}',
      '.cs-auto b{color:' + FG + ';font-weight:600}',
      '.cs-interval{height:24px;margin:0 2px;padding:0 4px;border-radius:6px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:' + FG + ';font-size:12px}',
      '.cs-submit{align-self:flex-start}',
      '.cs-secure{display:flex;align-items:flex-start;gap:6px;margin:0;font-size:11.5px;line-height:17px;color:' + FG2 + '}',
      '.cs-secure svg{margin-top:2px;color:var(' + OK + ')}',
      '.cs-how ol{margin:0 0 14px;padding-left:20px;font-size:12.5px;line-height:21px;color:' + FG2 + '}',
      '.cs-how li + li{margin-top:6px}',
      '.cs-link{text-decoration:none}',
      '.cs-repo-main{display:flex;align-items:center;gap:14px}',
      '.cs-repo-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:' + tint(BRAND, 12) + ';color:var(' + BRAND + ');flex:none}',
      '.cs-repo-body{min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.cs-repo-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:15px;font-weight:650;word-break:break-all}',
      '.cs-sub{font-size:11.5px;color:' + FG2 + '}',
      '.cs-err{margin:14px 0 0}',
      '.cs-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px}',
      '.cs-spacer{flex:1}',
      '.cs-danger{color:var(' + ERR + ')}',
      '.cs-files{list-style:none;margin:0;padding:0}',
      '.cs-file{display:flex;align-items:center;gap:12px;padding:10px 4px}',
      '.cs-file + .cs-file{border-top:1px solid ' + B1 + '}',
      '.cs-file-icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;' + GLASS_SOFT + ';color:' + FG2 + ';flex:none}',
      '.cs-file-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
      '.cs-file-body .cs-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cs-file-name{font-size:13px;font-weight:600}',
      '.cs-log-list{list-style:none;margin:0;padding:0;max-height:520px;overflow:auto}',
      '.cs-log-item{position:relative;display:flex;gap:12px;padding:0 0 14px 2px}',
      '.cs-log-item::before{content:"";position:absolute;left:6px;top:14px;bottom:0;width:1px;background:' + B1 + '}',
      '.cs-log-item:last-child::before{display:none}',
      '.cs-dot{width:9px;height:9px;margin-top:5px;border-radius:50%;background:var(' + OK + ');box-shadow:0 0 0 3px ' + tint(OK, 18) + ';flex:none}',
      '.cs-log-item.is-error .cs-dot{background:var(' + ERR + ');box-shadow:0 0 0 3px ' + tint(ERR, 18) + '}',
      '.cs-log-body{min-width:0;display:flex;flex-direction:column;gap:2px;font-size:12.5px}',
      '.cs-log-head{font-weight:600}',
      '.cs-log-err{font-size:11.5px;color:var(' + ERR + ');word-break:break-word}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cloud-sync: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 25, label: () => t('panel'), locale: NS,
        }, PanelGlyph('cloud')));
      },
    };
  },
});
