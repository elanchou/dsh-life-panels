window.__ModuleLoader__.load({
  id: '@local/news-feeds',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'news-feeds';
    const NS = 'newsFeeds';
    const call = makeCall('/plugin-api/news-feeds');
    const READING_API = '/plugin-api/reading-list';

    const zh = {
      dateLocale: 'zh-CN', panel: '新闻', title: '新闻速览',
      catAll: '全部', cat_tech: '科技', cat_business: '财经', cat_world: '国际', cat_other: '其他',
      search: '搜索标题或摘要', refresh: '刷新', refreshing: '刷新中', manage: '订阅源',
      updated: '更新于 {time}', statItems: '条资讯', statSources: '个来源', statFailed: '源失败',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
      open: '打开原文', save: '稍后读', saved: '已存入', saveFailed: '保存失败：{error}',
      readingMissing: '需要先安装“阅读”插件', empty: '没有匹配的资讯', loading: '正在获取资讯…',
      loadFailed: '加载失败：{error}', retry: '重试', allSources: '全部来源',
      feedsTitle: '订阅源', addFeed: '添加', feedUrl: 'RSS / Atom 地址', feedName: '名称（可选）',
      remove: '删除', enabled: '启用', failed: '获取失败', items: '{n} 条', close: '收起',
      adding: '添加中…', added: '已添加 {title}',
      hint: '可以在对话里说“总结今天的科技头条”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'News', title: 'News Brief',
      catAll: 'All', cat_tech: 'Tech', cat_business: 'Business', cat_world: 'World', cat_other: 'Other',
      search: 'Search titles or summaries', refresh: 'Refresh', refreshing: 'Refreshing', manage: 'Feeds',
      updated: 'Updated {time}', statItems: 'stories', statSources: 'sources', statFailed: 'failing',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
      open: 'Open article', save: 'Read later', saved: 'Saved', saveFailed: 'Save failed: {error}',
      readingMissing: 'Install the Reading plugin first', empty: 'No matching stories', loading: 'Fetching stories…',
      loadFailed: 'Failed to load: {error}', retry: 'Retry', allSources: 'All sources',
      feedsTitle: 'Feeds', addFeed: 'Add', feedUrl: 'RSS / Atom URL', feedName: 'Name (optional)',
      remove: 'Remove', enabled: 'Enabled', failed: 'Failed', items: '{n} items', close: 'Done',
      adding: 'Adding…', added: 'Added {title}',
      hint: 'Ask in chat: “Summarize today’s tech headlines”',
    };
    const CATS = ['tech', 'business', 'world', 'other'];

    function Story(props) {
      const { item, t, lead, onSave, saved } = props;
      const meta = h('div', { className: 'nf-meta' },
        h('span', { className: 'nf-source' }, item.source),
        item.publishedAt ? h('span', null, ago(item.publishedAt, t)) : null,
      );
      const actions = h('div', { className: 'nf-actions' },
        h('button', {
          type: 'button', className: 'lp-round lp-round-sm' + (saved ? ' is-on' : ''), title: saved ? t('saved') : t('save'),
          'aria-label': saved ? t('saved') : t('save'), onClick: (e) => { e.preventDefault(); e.stopPropagation(); onSave(item); }, disabled: saved,
        }, h(Icon, { name: saved ? 'check' : 'bookmark', size: 14 })),
      );
      return h('a', {
        className: 'nf-story' + (lead ? ' is-lead' : '') + (item.image ? ' has-image' : ''),
        href: item.link, target: '_blank', rel: 'noopener noreferrer', title: t('open'),
      },
        item.image ? h('div', { className: 'nf-thumb' },
          h('img', { src: item.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: (e) => { e.currentTarget.parentNode.style.display = 'none'; } })) : null,
        h('div', { className: 'nf-body' },
          meta,
          h('h3', { className: 'nf-headline' }, item.title),
          item.summary ? h('p', { className: 'nf-summary' }, item.summary) : null,
        ),
        actions,
      );
    }

    function FeedManager(props) {
      const { t, feeds, onChange, onClose, status } = props;
      const [url, setUrl] = useState('');
      const [name, setName] = useState('');
      const [cat, setCat] = useState('tech');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const byId = {};
      for (const s of status || []) byId[s.id] = s;
      const add = async (e) => {
        e.preventDefault();
        if (!url.trim() || busy) return;
        setBusy(true); setMsg(null);
        try {
          const r = await call({ action: 'add_feed', url: url.trim(), title: name.trim(), category: cat });
          setUrl(''); setName(''); setMsg({ ok: true, text: t('added', { title: r.feed.title }) });
          onChange();
        } catch (err) { setMsg({ ok: false, text: err.message }); }
        finally { setBusy(false); }
      };
      const update = async (body) => {
        try { await call(body); onChange(); } catch (err) { setMsg({ ok: false, text: err.message }); }
      };
      return h('section', { className: 'lp-card nf-manager' },
        h('div', { className: 'lp-card-head' },
          h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'rss', className: 'lp-ico' }), t('feedsTitle')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onClose }, t('close'))),
        h('form', { className: 'nf-add', onSubmit: add },
          h('input', { className: 'lp-input', value: url, onChange: (e) => setUrl(e.target.value), placeholder: t('feedUrl'), 'aria-label': t('feedUrl'), type: 'url' }),
          h('input', { className: 'lp-input', value: name, onChange: (e) => setName(e.target.value), placeholder: t('feedName'), 'aria-label': t('feedName') }),
          h('select', { className: 'lp-select', value: cat, onChange: (e) => setCat(e.target.value), 'aria-label': 'category' },
            CATS.map((c) => h('option', { key: c, value: c }, t('cat_' + c)))),
          h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !url.trim() }, busy ? t('adding') : t('addFeed'))),
        msg ? h('div', { className: 'nf-msg' + (msg.ok ? '' : ' is-error') }, msg.text) : null,
        h('div', { className: 'nf-feed-list' }, feeds.map((f) => {
          const s = byId[f.id];
          return h('div', { key: f.id, className: 'nf-feed' + (f.enabled ? '' : ' is-off') },
            h('button', {
              type: 'button', role: 'switch', 'aria-checked': f.enabled, 'aria-label': t('enabled') + ' ' + f.title,
              className: 'nf-switch' + (f.enabled ? ' is-on' : ''), onClick: () => update({ action: 'update_feed', id: f.id, enabled: !f.enabled }),
            }, h('i')),
            h('div', { className: 'nf-feed-body' },
              h('div', { className: 'nf-feed-name' }, f.title, h('span', { className: 'lp-pill' }, t('cat_' + f.category))),
              h('div', { className: 'nf-feed-url' }, f.url)),
            s && s.error ? h('span', { className: 'lp-pill tone-error', title: s.error }, t('failed'))
              : s ? h('span', { className: 'lp-pill tone-success' }, t('items', { n: s.count })) : null,
            h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', title: t('remove'), 'aria-label': t('remove') + ' ' + f.title, onClick: () => update({ action: 'remove_feed', id: f.id }) },
              h(Icon, { name: 'trash', size: 14 })));
        })),
      );
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [cat, setCat] = useState('all');
      const [source, setSource] = useState('');
      const [query, setQuery] = useState('');
      const [busy, setBusy] = useState(false);
      const [manage, setManage] = useState(false);
      const [feeds, setFeeds] = useState([]);
      const [saved, setSaved] = useState({});
      const [toast, setToast] = useState(null);
      const alive = useRef(true);

      const load = useCallback(async (refresh) => {
        setBusy(true);
        try {
          const [r, f] = await Promise.all([call({ action: 'headlines', limit: 200, refresh: !!refresh }), call({ action: 'feeds' })]);
          if (!alive.current) return;
          setData({ ...r, at: Date.now() }); setFeeds(f.feeds); setError(null);
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
        finally { if (alive.current) setBusy(false); }
      }, [t]);

      useEffect(() => {
        alive.current = true;
        load(false);
        const id = setInterval(() => load(false), 15 * 60 * 1000);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);

      useEffect(() => {
        if (!toast) return undefined;
        const id = setTimeout(() => setToast(null), 2600);
        return () => clearTimeout(id);
      }, [toast]);

      const onSave = async (item) => {
        try {
          const response = await fetch(READING_API, {
            method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ action: 'add', url: item.link, title: item.title, source: item.source, summary: item.summary }),
          });
          if (response.status === 404) throw new Error(t('readingMissing'));
          const body = await response.json().catch(() => null);
          if (!response.ok || !body || body.ok === false) throw new Error((body && body.error) || 'HTTP ' + response.status);
          setSaved((s) => ({ ...s, [item.id]: true }));
          setToast({ ok: true, text: t('saved') + ' · ' + item.title });
        } catch (e) { setToast({ ok: false, text: t('saveFailed', { error: e.message }) }); }
      };

      const items = (data && data.items) || [];
      const catOf = useMemo(() => { const m = {}; for (const f of feeds) m[f.id] = f.category; return m; }, [feeds]);
      const q = query.trim().toLowerCase();
      const visible = items.filter((i) => (cat === 'all' || (catOf[i.feedId] || i.category) === cat)
        && (!source || i.feedId === source)
        && (!q || (i.title + ' ' + i.summary).toLowerCase().includes(q)));
      const catCounts = {};
      for (const i of items) { const c = catOf[i.feedId] || i.category; catCounts[c] = (catCounts[c] || 0) + 1; }
      const enabledFeeds = feeds.filter((f) => f.enabled);
      const failed = ((data && data.feeds) || []).filter((f) => f.error).length;
      const sourcesInCat = enabledFeeds.filter((f) => cat === 'all' || f.category === cat);
      const lead = visible.filter((i) => i.image).slice(0, 2);
      const leadIds = new Set(lead.map((i) => i.id));
      const rest = visible.filter((i) => !leadIds.has(i.id));
      const nowLong = new Date().toLocaleDateString(safeLocale(t), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const timeStr = data ? new Date(data.at).toLocaleTimeString(safeLocale(t), { hour: '2-digit', minute: '2-digit' }) : '';

      const tabs = [{ id: 'all', label: t('catAll'), count: items.length }]
        .concat(CATS.filter((c) => catCounts[c]).map((c) => ({ id: c, label: t('cat_' + c), count: catCounts[c] })));

      return h('div', { className: 'lp-root' },
        h('style', null, KIT_CSS + CSS),
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, nowLong), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'rss', value: items.length, label: t('statItems'), tone: 'tone-brand' }),
              h(Stat, { icon: 'book', value: enabledFeeds.length, label: t('statSources'), tone: 'tone-success' }),
              failed ? h(Stat, { icon: 'alert', value: failed, label: t('statFailed'), tone: 'tone-error' }) : null)),
          h(ErrorBar, { error, onRetry: () => load(true), retryLabel: t('retry') }),
          manage ? h(FeedManager, { t, feeds, status: data && data.feeds, onChange: () => load(false), onClose: () => setManage(false) }) : null,
          h('div', { className: 'nf-toolbar' },
            h(Tabs, { items: tabs, value: cat, onChange: (c) => { setCat(c); setSource(''); } }),
            h('div', { className: 'nf-tools' },
              h('label', { className: 'lp-field nf-search' }, h(Icon, { name: 'search', size: 14 }),
                h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })),
              h('label', { className: 'lp-field' },
                h('select', { value: source, onChange: (e) => setSource(e.target.value), 'aria-label': t('allSources') },
                  h('option', { value: '' }, t('allSources')),
                  sourcesInCat.map((f) => h('option', { key: f.id, value: f.id }, f.title)))),
              h('button', { type: 'button', className: 'lp-ghost', onClick: () => load(true), disabled: busy, title: timeStr ? t('updated', { time: timeStr }) : '' },
                h(Icon, { name: 'refresh', size: 14, className: busy ? 'lp-spin' : '' }), busy ? t('refreshing') : t('refresh')),
              h('button', { type: 'button', className: 'lp-ghost' + (manage ? ' is-active' : ''), onClick: () => setManage(!manage) },
                h(Icon, { name: 'settings', size: 14 }), t('manage')))),
          !data && !error ? h('div', { className: 'nf-skeleton' }, [0, 1, 2, 3, 4, 5].map((i) => h('div', { key: i, className: 'lp-skel nf-skel' })))
            : visible.length === 0 ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'search', text: t('empty') }))
              : h(React.Fragment, null,
                lead.length ? h('div', { className: 'nf-lead' }, lead.map((item) => h(Story, { key: item.id, item, t, lead: true, onSave, saved: !!saved[item.id] }))) : null,
                h('div', { className: 'nf-grid' }, rest.map((item) => h(Story, { key: item.id, item, t, onSave, saved: !!saved[item.id] })))),
          timeStr ? h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint') + ' · ' + t('updated', { time: timeStr })) : null),
        toast ? h('div', { className: 'nf-toast' + (toast.ok ? '' : ' is-error'), role: 'status' }, h(Icon, { name: toast.ok ? 'check' : 'alert', size: 14 }), h('span', null, toast.text)) : null,
      );
    }

    const CSS = [
      '.nf-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px}',
      '.nf-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.nf-search input{width:170px}',
      '.lp-ghost.is-active{border-color:var(' + BRAND + ');color:var(' + BRAND + ')}',
      '.nf-lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:14px}',
      '.nf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}',
      '.lp-root{--lp-amb-b:var(' + IDLE + ')}',
      '.nf-story{position:relative;display:flex;gap:12px;padding:14px;border-radius:16px;' + GLASS + ';color:inherit;text-decoration:none;transition:border-color .15s,transform .15s,box-shadow .15s;min-width:0}',
      '.nf-story:hover{' + GLASS_HOVER + ';transform:translateY(-1px)}',
      '.nf-story.is-lead{flex-direction:column;padding:0;overflow:hidden}',
      '.nf-story.is-lead .nf-body{padding:4px 16px 16px}',
      '.nf-thumb{flex:none;width:84px;height:84px;border-radius:12px;overflow:hidden;' + GLASS_SOFT + '}',
      '.nf-story.is-lead .nf-thumb{width:100%;height:180px;border-radius:0}',
      '.nf-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.nf-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.nf-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;line-height:16px;color:' + FG2 + ';padding-right:28px}',
      '.nf-story.is-lead .nf-meta{padding-top:10px}',
      '.nf-source{font-weight:600;color:var(' + BRAND + ')}',
      '.nf-headline{margin:0;font-size:14px;line-height:21px;font-weight:600;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.nf-story.is-lead .nf-headline{font-size:16.5px;line-height:24px}',
      '.nf-summary{margin:0;font-size:12.5px;line-height:19px;color:' + FG2 + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.nf-actions{position:absolute;top:10px;right:10px;opacity:0;transition:opacity .12s}',
      '.nf-story.is-lead .nf-actions{top:auto;bottom:auto;top:190px}',
      '.nf-story:hover .nf-actions,.nf-actions:focus-within,.nf-actions .is-on{opacity:1}',
      '@media (hover:none){.nf-actions{opacity:1}}',
      '.nf-actions .lp-round{background:var(--lp-glass-strong);border:1px solid var(--lp-glass-edge)}',
      '.nf-skeleton{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}',
      '.nf-skel{height:112px;border-radius:16px}',
      '.nf-manager{margin-bottom:16px}',
      '.nf-add{display:grid;grid-template-columns:2fr 1fr 110px auto;gap:8px;margin-bottom:10px}',
      '@media (max-width:760px){.nf-add{grid-template-columns:1fr}}',
      '.nf-msg{font-size:12px;margin:0 0 10px;color:var(' + OK + ')}',
      '.nf-msg.is-error{color:var(' + ERR + ')}',
      '.nf-feed-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:6px}',
      '.nf-feed{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;' + GLASS_SOFT + '}',
      '.nf-feed.is-off .nf-feed-body{opacity:.5}',
      '.nf-feed-body{flex:1;min-width:0}',
      '.nf-feed-name{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}',
      '.nf-feed-url{font-size:11px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nf-switch{flex:none;position:relative;width:32px;height:18px;padding:0;border-radius:999px;border:0;background:' + B2 + ';cursor:pointer;transition:background .15s}',
      '.nf-switch i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}',
      '.nf-switch.is-on{background:var(' + BRAND + ')}',
      '.nf-switch.is-on i{transform:translateX(14px)}',
      '.nf-toast{position:sticky;bottom:20px;margin:0 auto;width:max-content;max-width:min(560px,90%);display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:var(--lp-glass-strong);border:1px solid var(--lp-glass-edge);box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 12px 30px -8px ' + tint('--dsw-alias-label-primary', 24) + ';' + GLASS_BLUR + ';font-size:12.5px;color:var(' + OK + ')}',
      '.nf-toast span{color:' + FG + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nf-toast.is-error{color:var(' + ERR + ')}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'news-feeds: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 21, label: () => t('panel'), locale: NS,
        }, PanelGlyph('rss')));
      },
    };
  },
});
