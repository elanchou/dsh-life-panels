window.__ModuleLoader__.load({
  id: '@local/youtube',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'youtube';
    const NS = 'youtube';
    const call = makeCall('/plugin-api/youtube');

    const zh = {
      dateLocale: 'zh-CN', panel: 'YouTube', title: 'YouTube',
      statChannels: '订阅频道', statNew: '未看新视频', statToday: '24 小时内更新',
      tabVideos: '最新视频', tabChannels: '我的频道',
      addPlaceholder: '粘贴频道链接、@handle，或输入频道名搜索', add: '订阅', search: '搜索',
      all: '全部', unwatchedOnly: '只看未看', filter: '筛选标题', refresh: '刷新', markAll: '全部标为已看',
      subscribe: '订阅', subscribed: '已订阅', unsubscribe: '取消订阅', subscribedOk: '已订阅 {name}', alreadySub: '已经订阅过 {name}',
      noResults: '没有找到频道', closeResults: '收起',
      watched: '已看', markWatched: '标为已看', markUnwatched: '标为未看', openYt: '在 YouTube 打开', close: '关闭',
      lastUpload: '最近更新 {t}', newN: '{n} 个新视频', channelError: '加载失败',
      empty: '还没有订阅频道。粘贴频道链接，或输入名字搜索一个吧', emptyFilter: '没有符合条件的视频',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      playerHint: '如果视频没有开始播放，可以点「在 YouTube 打开」',
      hint: '可以在对话里说“订阅 3Blue1Brown”或“这周我订阅的频道更新了什么”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'YouTube', title: 'YouTube',
      statChannels: 'Channels', statNew: 'Unwatched new', statToday: 'Last 24 hours',
      tabVideos: 'Latest', tabChannels: 'Channels',
      addPlaceholder: 'Paste a channel link or @handle, or type a name to search', add: 'Subscribe', search: 'Search',
      all: 'All', unwatchedOnly: 'Unwatched only', filter: 'Filter titles', refresh: 'Refresh', markAll: 'Mark all watched',
      subscribe: 'Subscribe', subscribed: 'Subscribed', unsubscribe: 'Unsubscribe', subscribedOk: 'Subscribed to {name}', alreadySub: 'Already subscribed to {name}',
      noResults: 'No channels found', closeResults: 'Hide',
      watched: 'Watched', markWatched: 'Mark watched', markUnwatched: 'Mark unwatched', openYt: 'Open on YouTube', close: 'Close',
      lastUpload: 'Last upload {t}', newN: '{n} new', channelError: 'Failed to load',
      empty: 'No subscriptions yet. Paste a channel link, or type a name to search.', emptyFilter: 'No videos match',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      playerHint: 'If the video does not start, use “Open on YouTube”',
      hint: 'Ask in chat: “Subscribe to 3Blue1Brown” or “What did my channels post this week?”',
    };

    Object.assign(ICONS, {
      yt: ['M3 8.5a3.5 3.5 0 0 1 3.5-3.5h11A3.5 3.5 0 0 1 21 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 15.5z', 'M10 9.2v5.6l4.8-2.8z'],
      play: ['M8 5.5v13l11-6.5z'],
      users: ['M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 6.5', 'M18 14a6.5 6.5 0 0 1 3.5 6'],
      eyeoff: ['M3 3l18 18', 'M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.4', 'M6.6 7.6A17 17 0 0 0 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 4.4-1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
    });
    const YtIcon = PanelGlyph('yt');
    const looksLikeChannel = (s) => /^@[^\s/]+$/.test(s) || /^UC[\w-]{22}$/.test(s) || /youtube\.com\//i.test(s);
    const isTyping = (e) => { const tg = (e.target && e.target.tagName) || ''; return /INPUT|TEXTAREA|SELECT/.test(tg) || (e.target && e.target.isContentEditable); };

    function Avatar(props) {
      const { src, name, size } = props;
      const [bad, setBad] = useState(false);
      const letter = (name || '?').trim().charAt(0).toUpperCase();
      return h('span', { className: 'yt-avatar', style: { width: size, height: size, fontSize: Math.round(size * 0.45) } },
        src && !bad ? h('img', { src, alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer', onError: () => setBad(true) }) : letter);
    }

    function VideoCard(props) {
      const { v, t, onPlay, onToggle } = props;
      return h('article', { className: 'yt-card' + (v.watched ? ' is-watched' : '') },
        h('button', { type: 'button', className: 'yt-thumb', onClick: () => onPlay(v), 'aria-label': v.title },
          h('img', { src: v.thumbnail, alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' }),
          v.duration ? h('span', { className: 'yt-dur' }, v.duration) : null,
          v.watched ? h('span', { className: 'yt-seen' }, h(Icon, { name: 'check', size: 12, stroke: 2.4 }), t('watched')) : null,
          h('span', { className: 'yt-play' }, h(Icon, { name: 'play', size: 22 }))),
        h('div', { className: 'yt-meta' },
          h(Avatar, { src: v.channelAvatar, name: v.channel, size: 30 }),
          h('div', { className: 'yt-meta-text' },
            h('button', { type: 'button', className: 'yt-title', onClick: () => onPlay(v), title: v.title }, v.title),
            h('div', { className: 'yt-sub' }, v.channel),
            h('div', { className: 'yt-sub' }, [v.views, v.ago].filter(Boolean).join(' · '))),
          h('button', {
            type: 'button', className: 'lp-round lp-round-sm yt-toggle' + (v.watched ? ' is-on' : ''), onClick: () => onToggle(v),
            title: v.watched ? t('markUnwatched') : t('markWatched'), 'aria-label': v.watched ? t('markUnwatched') : t('markWatched'),
          }, h(Icon, { name: v.watched ? 'eyeoff' : 'check', size: 14 }))));
    }

    function Player(props) {
      const { v, t, onClose, onToggle } = props;
      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);
      const src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.id) + '?autoplay=1&rel=0&playsinline=1&hl=' + (t('dateLocale') === 'zh-CN' ? 'zh-CN' : 'en');
      return h('div', { className: 'yt-overlay', role: 'dialog', 'aria-modal': true, 'aria-label': v.title, onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { className: 'yt-player' },
          h('div', { className: 'yt-frame' },
            h('iframe', {
              src, title: v.title, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write',
              allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin', frameBorder: 0,
            })),
          h('div', { className: 'yt-player-bar' },
            h(Avatar, { src: v.channelAvatar, name: v.channel, size: 34 }),
            h('div', { className: 'yt-player-text' },
              h('div', { className: 'yt-player-title' }, v.title),
              h('div', { className: 'yt-sub' }, [v.channel, v.views, v.ago].filter(Boolean).join(' · '))),
            h('button', { type: 'button', className: 'lp-ghost', onClick: () => onToggle(v) }, h(Icon, { name: v.watched ? 'eyeoff' : 'check', size: 14 }), v.watched ? t('markUnwatched') : t('markWatched')),
            h('a', { className: 'lp-ghost', href: v.url, target: '_blank', rel: 'noreferrer noopener' }, h(Icon, { name: 'external', size: 14 }), t('openYt')),
            h('button', { type: 'button', className: 'lp-round', onClick: onClose, 'aria-label': t('close'), title: t('close') }, h(Icon, { name: 'x', size: 16 }))),
          h('p', { className: 'yt-player-hint' }, t('playerHint'))));
    }

    function SearchResults(props) {
      const { t, results, busyId, onSubscribe, onClose } = props;
      return h('section', { className: 'lp-card yt-results' },
        h('div', { className: 'lp-card-head' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'search', className: 'lp-ico' }), t('search')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: onClose }, t('closeResults'))),
        !results.length ? h(Empty, { icon: 'search', text: t('noResults') })
          : h('ul', { className: 'yt-result-list' }, results.map((r) => h('li', { key: r.id, className: 'yt-result' },
            h(Avatar, { src: r.avatar, name: r.title, size: 44 }),
            h('div', { className: 'yt-result-text' },
              h('div', { className: 'yt-result-title' }, r.title, r.handle ? h('span', { className: 'lp-muted' }, ' ' + r.handle) : null),
              h('div', { className: 'yt-sub' }, r.subscribers),
              r.description ? h('div', { className: 'yt-sub yt-clamp' }, r.description) : null),
            r.subscribed ? h('span', { className: 'lp-pill tone-success' }, h(Icon, { name: 'check', size: 12 }), t('subscribed'))
              : h('button', { type: 'button', className: 'lp-primary yt-sub-btn', disabled: busyId === r.id, onClick: () => onSubscribe(r.id, r.title) },
                busyId === r.id ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: 'plus', size: 14 }), t('subscribe'))))));
    }

    function ChannelList(props) {
      const { t, channels, onOpen, onUnsubscribe } = props;
      return h('ul', { className: 'yt-channels' }, channels.map((c) => h('li', { key: c.id, className: 'lp-card yt-channel' },
        h('button', { type: 'button', className: 'yt-channel-main', onClick: () => onOpen(c.id) },
          h(Avatar, { src: c.avatar, name: c.title, size: 48 }),
          h('div', { className: 'yt-channel-text' },
            h('div', { className: 'yt-result-title' }, c.title),
            h('div', { className: 'yt-sub' }, c.handle || c.id),
            h('div', { className: 'yt-sub' }, c.error ? h('span', { className: 'yt-err' }, t('channelError')) : c.lastUpload ? t('lastUpload', { t: ago(c.lastUpload, t) }) : ''))),
        c.newCount ? h('span', { className: 'lp-pill tone-error' }, t('newN', { n: c.newCount })) : null,
        h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', onClick: () => onUnsubscribe(c), title: t('unsubscribe'), 'aria-label': t('unsubscribe') }, h(Icon, { name: 'trash', size: 14 })))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const [tab, setTab] = useState('videos');
      const [channelId, setChannelId] = useState('');
      const [unwatched, setUnwatched] = useState(false);
      const [query, setQuery] = useState('');
      const [input, setInput] = useState('');
      const [results, setResults] = useState(null);
      const [busy, setBusy] = useState(false);
      const [busyId, setBusyId] = useState(null);
      const [refreshing, setRefreshing] = useState(false);
      const [playing, setPlaying] = useState(null);
      const alive = useRef(true);

      const load = useCallback(async (refresh) => {
        if (refresh) setRefreshing(true);
        try {
          const r = await call({ action: 'latest', limit: 300, refresh: !!refresh });
          if (alive.current) { setData(r); setError(null); }
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
        finally { if (alive.current) setRefreshing(false); }
      }, [t]);
      useEffect(() => {
        alive.current = true; load();
        const id = setInterval(() => load(), 10 * 60000);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);
      useEffect(() => { if (!notice) return undefined; const id = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(id); }, [notice]);

      const setWatched = async (ids, watched) => {
        setData((d) => d && ({ ...d, videos: d.videos.map((v) => (ids.includes(v.id) ? { ...v, watched } : v)) }));
        setPlaying((p) => (p && ids.includes(p.id) ? { ...p, watched } : p));
        try { await call({ action: 'watched', ids, watched }); load(); } catch (e) { setError(t('saveFailed', { error: e.message })); load(); }
      };
      const onPlay = (v) => { setPlaying({ ...v, watched: true }); if (!v.watched) setWatched([v.id], true); };
      const onToggle = (v) => setWatched([v.id], !v.watched);
      const subscribe = async (ref, name) => {
        setBusyId(ref);
        try {
          const r = await call({ action: 'subscribe', channel: ref });
          setNotice(t(r.already ? 'alreadySub' : 'subscribedOk', { name: r.channel.title || name || ref }));
          setResults((rs) => rs && rs.map((x) => (x.id === r.channel.id ? { ...x, subscribed: true } : x)));
          await load();
          return true;
        } catch (e) { setError(t('saveFailed', { error: e.message })); return false; }
        finally { setBusyId(null); }
      };
      const onAdd = async (e) => {
        e.preventDefault();
        const v = input.trim();
        if (!v || busy) return;
        setBusy(true);
        try {
          if (looksLikeChannel(v)) { if (await subscribe(v)) { setInput(''); setResults(null); } }
          else { const r = await call({ action: 'search', query: v }); setResults(r.results); }
        } catch (err) { setError(t('loadFailed', { error: err.message })); }
        finally { setBusy(false); }
      };
      const onUnsubscribe = async (c) => {
        try { await call({ action: 'unsubscribe', id: c.id }); if (channelId === c.id) setChannelId(''); await load(); }
        catch (e) { setError(t('saveFailed', { error: e.message })); }
      };

      const channels = (data && data.channels) || [];
      const all = (data && data.videos) || [];
      const q = query.trim().toLowerCase();
      const visible = all.filter((v) => (!channelId || v.channelId === channelId) && (!unwatched || !v.watched) && (!q || v.title.toLowerCase().includes(q)));
      const dayAgo = Date.now() - 864e5;
      const today = all.filter((v) => v.publishedAt && Date.parse(v.publishedAt) > dayAgo).length;
      const newCount = data ? data.newCount : 0;

      let body;
      if (!data) body = h('div', { className: 'yt-grid' }, [0, 1, 2, 3, 4, 5].map((i) => h('div', { key: i, className: 'yt-card' }, h('div', { className: 'lp-skel yt-skel-thumb' }), h('div', { className: 'lp-skel', style: { height: 14, margin: '10px 4px', width: '80%' } }))));
      else if (!channels.length) body = h('div', { className: 'lp-card' }, h(Empty, { icon: 'yt', text: t('empty') }));
      else if (tab === 'channels') body = h(ChannelList, { t, channels, onOpen: (id) => { setChannelId(id); setTab('videos'); }, onUnsubscribe });
      else {
        body = h(React.Fragment, null,
          h('div', { className: 'yt-chips' },
            h('button', { type: 'button', className: 'yt-chip' + (!channelId ? ' is-active' : ''), onClick: () => setChannelId('') }, t('all')),
            channels.map((c) => h('button', { key: c.id, type: 'button', className: 'yt-chip' + (channelId === c.id ? ' is-active' : ''), onClick: () => setChannelId(channelId === c.id ? '' : c.id), title: c.title },
              h(Avatar, { src: c.avatar, name: c.title, size: 20 }), h('span', null, c.title), c.newCount ? h('i', { className: 'yt-chip-n' }, c.newCount) : null))),
          visible.length ? h('div', { className: 'yt-grid' }, visible.map((v) => h(VideoCard, { key: v.id, v, t, onPlay, onToggle })))
            : h('div', { className: 'lp-card' }, h(Empty, { icon: 'yt', text: t('emptyFilter') })));
      }

      return h('div', { className: 'lp-root yt-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, 'youtube.com'), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'users', value: channels.length, label: t('statChannels'), tone: 'tone-brand' }),
              h(Stat, { icon: 'yt', value: newCount, label: t('statNew'), tone: newCount ? 'tone-error' : undefined }),
              h(Stat, { icon: 'clock', value: today, label: t('statToday'), tone: today ? 'tone-success' : undefined }))),
          h(ErrorBar, { error, onRetry: () => load(true), retryLabel: t('retry'), onClose: () => setError(null) }),
          h('form', { className: 'lp-bar yt-add', onSubmit: onAdd },
            h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'yt', size: 18 })),
            h('input', { className: 'lp-bar-input', value: input, onChange: (e) => setInput(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder') }),
            h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !input.trim() },
              busy ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : h(Icon, { name: looksLikeChannel(input.trim()) ? 'plus' : 'search', size: 14 }),
              looksLikeChannel(input.trim()) ? t('add') : t('search'))),
          results ? h(SearchResults, { t, results, busyId, onSubscribe: subscribe, onClose: () => setResults(null) }) : null,
          channels.length ? h('div', { className: 'yt-toolbar' },
            h(Tabs, { value: tab, onChange: setTab, items: [{ id: 'videos', label: t('tabVideos'), count: all.length }, { id: 'channels', label: t('tabChannels'), count: channels.length }] }),
            h('div', { className: 'yt-tools' },
              tab === 'videos' ? h('label', { className: 'lp-field yt-filter' }, h(Icon, { name: 'search', size: 14 }),
                h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('filter'), 'aria-label': t('filter') })) : null,
              tab === 'videos' ? h('button', { type: 'button', className: 'lp-ghost' + (unwatched ? ' is-on' : ''), onClick: () => setUnwatched(!unwatched), 'aria-pressed': unwatched }, h(Icon, { name: 'eyeoff', size: 14 }), t('unwatchedOnly')) : null,
              tab === 'videos' && visible.some((v) => !v.watched) ? h('button', { type: 'button', className: 'lp-ghost', onClick: () => setWatched(visible.filter((v) => !v.watched).map((v) => v.id), true) }, h(Icon, { name: 'check', size: 14 }), t('markAll')) : null,
              h('button', { type: 'button', className: 'lp-round', onClick: () => load(true), disabled: refreshing, title: t('refresh'), 'aria-label': t('refresh') }, h(Icon, { name: 'refresh', size: 16, className: refreshing ? 'lp-spin' : undefined })))) : null,
          body,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        notice ? h('div', { className: 'yt-toast', role: 'status' }, h(Icon, { name: 'check', size: 14 }), notice) : null,
        playing ? h(Player, { v: playing, t, onClose: () => setPlaying(null), onToggle }) : null,
        h('style', null, KIT_CSS + CSS));
    }

    const YT_RED = '#ff0033';
    const CSS = [
      '.yt-root{--lp-amb-a:' + YT_RED + ';--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + BRAND + ')}',
      '.yt-add{margin-bottom:14px}',
      '.yt-avatar{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:' + tint(ERR, 14) + ';color:var(' + ERR + ');font-weight:650}',
      '.yt-avatar img{width:100%;height:100%;object-fit:cover;display:block}',
      '.yt-sub{font-size:12px;line-height:18px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.yt-clamp{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.yt-results{margin-bottom:14px}',
      '.yt-result-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;max-height:420px;overflow:auto}',
      '.yt-result{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:12px}',
      '.yt-result:hover{' + GLASS_SOFT + '}',
      '.yt-result-text,.yt-channel-text{flex:1;min-width:0}',
      '.yt-result-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.yt-result-title .lp-muted{font-weight:400;font-size:12px}',
      '.yt-sub-btn{height:30px;padding:0 12px}',
      '.yt-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
      '.yt-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.yt-filter{min-width:180px}',
      '.yt-root .lp-ghost.is-on{color:var(' + BRAND + ');border-color:' + tint(BRAND, 40) + '}',
      '.yt-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 10px;margin-bottom:4px;scrollbar-width:thin}',
      '.yt-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px 0 6px;border-radius:999px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:' + FG + ';font-size:12.5px;cursor:pointer;max-width:200px}',
      '.yt-chip:first-child{padding:0 14px}',
      '.yt-chip span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.yt-chip.is-active{background:' + FG + ';color:var(--dsw-alias-bg-base);border-color:transparent}',
      '.yt-chip-n{font-style:normal;font-size:10.5px;line-height:16px;min-width:16px;padding:0 4px;border-radius:999px;background:' + YT_RED + ';color:#fff;text-align:center}',
      '.yt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px 14px}',
      '.yt-card{min-width:0;content-visibility:auto;contain-intrinsic-size:auto 280px}',
      '.yt-thumb{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;border:0;border-radius:14px;overflow:hidden;cursor:pointer;background:' + L2 + '}',
      '.yt-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s}',
      '.yt-thumb:hover img{transform:scale(1.03)}',
      '.yt-dur{position:absolute;right:8px;bottom:8px;padding:1px 6px;border-radius:6px;background:rgba(0,0,0,.78);color:#fff;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.yt-seen{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;gap:3px;padding:1px 7px 1px 5px;border-radius:6px;background:rgba(0,0,0,.66);color:#fff;font-size:11px}',
      '.yt-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.18);opacity:0;transition:opacity .15s}',
      '.yt-play svg{width:52px;height:36px;padding:7px 16px;border-radius:12px;background:' + YT_RED + ';box-sizing:border-box;fill:#fff}',
      '.yt-thumb:hover .yt-play,.yt-thumb:focus-visible .yt-play{opacity:1}',
      '.yt-card.is-watched .yt-thumb img{opacity:.55}',
      '.yt-card.is-watched .yt-title{color:' + FG2 + '}',
      '.yt-meta{display:flex;gap:10px;padding:10px 2px 0;align-items:flex-start}',
      '.yt-meta-text{flex:1;min-width:0}',
      '.yt-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:0;border:0;background:transparent;color:' + FG + ';font-size:14px;line-height:20px;font-weight:600;text-align:left;cursor:pointer;margin-bottom:2px}',
      '.yt-toggle{opacity:0;transition:opacity .12s}',
      '.yt-card:hover .yt-toggle,.yt-toggle:focus-visible{opacity:1}',
      '.yt-skel-thumb{aspect-ratio:16/9;border-radius:14px}',
      '.yt-channels{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}',
      '.yt-channel{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 14px}',
      '.yt-channel-main{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.yt-err{color:var(' + ERR + ')}',
      '.yt-toast{position:sticky;bottom:20px;margin:0 auto;width:max-content;max-width:min(560px,90%);display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:var(--lp-glass-strong);border:1px solid var(--lp-glass-edge);box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 12px 30px -8px ' + tint('--dsw-alias-label-primary', 24) + ';' + GLASS_BLUR + ';font-size:12.5px;color:var(' + OK + ')}',
      '.yt-overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(0,0,0,.55);' + GLASS_BLUR + ';animation:yt-fade .15s ease-out}',
      '@keyframes yt-fade{from{opacity:0}}',
      '.yt-player{width:min(1100px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);box-shadow:0 30px 80px -20px rgba(0,0,0,.6)}',
      '.yt-frame{position:relative;width:100%;aspect-ratio:16/9;max-height:calc(100vh - 170px);background:#000}',
      '.yt-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
      '.yt-player-bar{display:flex;align-items:center;gap:10px;padding:12px 14px}',
      '.yt-player-text{flex:1;min-width:0}',
      '.yt-player-title{font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.yt-player-bar a.lp-ghost{text-decoration:none}',
      '.yt-player-hint{margin:0;padding:0 14px 12px;font-size:11.5px;color:' + FG2 + '}',
      '@media (max-width:700px){.yt-player-bar{flex-wrap:wrap}.yt-overlay{padding:10px}}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'youtube: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 28, label: () => t('panel'), locale: NS,
        }, YtIcon));
      },
    };
  },
});
