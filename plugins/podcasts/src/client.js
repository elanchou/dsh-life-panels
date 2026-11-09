window.__ModuleLoader__.load({
  id: '@local/podcasts',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'podcasts';
    const NS = 'podcasts';
    const call = makeCall('/plugin-api/podcasts');

    const zh = {
      dateLocale: 'zh-CN', panel: '播客', title: '播客',
      tabPicks: '今日推荐', tabLatest: '最新', tabQueue: '播放队列', tabShows: '我的订阅', tabDiscover: '发现',
      statShows: '个订阅', statNew: '本周新节目', statQueue: '待播',
      play: '播放', pause: '暂停', back15: '后退 15 秒', fwd30: '前进 30 秒', speed: '倍速',
      queueAdd: '加入队列', queued: '已在队列', queueRemove: '移出队列', markPlayed: '标为已听', markUnplayed: '标为未听',
      played: '已听', left: '剩 {t}', notes: '节目简介', hideNotes: '收起', open: '打开网页', nowPlaying: '正在播放',
      searchPh: '搜索播客名称、主播或话题', search: '搜索', subscribe: '订阅', subscribed: '已订阅', unsubscribe: '取消订阅',
      top: '中国区热门播客', results: '搜索结果', feedPh: '或直接粘贴 RSS 地址', addFeed: '添加',
      emptyShows: '还没有订阅，去“发现”里找找', emptyQueue: '队列是空的，在节目旁点 + 加入', emptyLatest: '订阅后，新节目会出现在这里',
      noResults: '没有找到相关播客', allShows: '全部节目', unplayedOnly: '只看未听', refresh: '刷新',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', playFailed: '无法播放：{error}', retry: '重试', loading: '加载中…',
      picksTitle: 'AI 为你挑选的 3 期节目', picksSub: '根据你的订阅和收听记录，每天更新一次', picksRegen: '重新推荐', picksBusy: 'AI 正在挑选…', picksEmpty: '暂时没有可推荐的新节目', picksNoShows: '先订阅几个节目，AI 才能帮你挑', picksUpdated: '{model} · {time} 生成',
      importApple: '从 Apple 播客导入订阅', importing: '正在导入 {done}/{total}…', importDone: '已导入 {added} 个，已存在 {skipped} 个，失败 {failed} 个', importNone: 'Apple 播客里没有订阅', importFailedList: '无法导入的节目（订阅源失效）',
      feedErrors: '{n} 个订阅源暂时无法更新', hint: '离开此面板后会继续播放。可以在对话里说“总结一下最新一期晚点聊”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Podcasts', title: 'Podcasts',
      tabPicks: 'Today', tabLatest: 'Latest', tabQueue: 'Up next', tabShows: 'Library', tabDiscover: 'Discover',
      statShows: 'shows', statNew: 'new this week', statQueue: 'queued',
      play: 'Play', pause: 'Pause', back15: 'Back 15s', fwd30: 'Forward 30s', speed: 'Speed',
      queueAdd: 'Add to queue', queued: 'Queued', queueRemove: 'Remove from queue', markPlayed: 'Mark played', markUnplayed: 'Mark unplayed',
      played: 'Played', left: '{t} left', notes: 'Show notes', hideNotes: 'Hide', open: 'Open page', nowPlaying: 'Now playing',
      searchPh: 'Search shows, hosts or topics', search: 'Search', subscribe: 'Subscribe', subscribed: 'Subscribed', unsubscribe: 'Unsubscribe',
      top: 'Top podcasts (China store)', results: 'Results', feedPh: 'Or paste an RSS URL', addFeed: 'Add',
      emptyShows: 'No subscriptions yet. Find shows in Discover.', emptyQueue: 'The queue is empty. Use + next to an episode.', emptyLatest: 'New episodes from your shows appear here.',
      noResults: 'No podcasts found', allShows: 'All shows', unplayedOnly: 'Unplayed only', refresh: 'Refresh',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', playFailed: 'Cannot play: {error}', retry: 'Retry', loading: 'Loading…',
      picksTitle: 'Three episodes picked for you', picksSub: 'Based on your subscriptions and listening, refreshed daily', picksRegen: 'Pick again', picksBusy: 'Choosing episodes…', picksEmpty: 'No new episodes to recommend yet', picksNoShows: 'Subscribe to a few shows first', picksUpdated: '{model} · generated {time}',
      importApple: 'Import from Apple Podcasts', importing: 'Importing {done}/{total}…', importDone: '{added} added, {skipped} already there, {failed} failed', importNone: 'No subscriptions in Apple Podcasts', importFailedList: 'Could not import (dead feeds)',
      feedErrors: '{n} feeds could not be refreshed', hint: 'Playback continues when you leave this panel. Ask in chat: “Summarize the latest LateTalk episode”',
    };

    Object.assign(ICONS, {
      play: ['M8 5.5v13l11-6.5z'],
      pause: ['M8 5v14', 'M16 5v14'],
      back: ['M4 12a8 8 0 1 0 2.3-5.7', 'M4 4v4h4', 'M10 10v5', 'M13 10h2v5'],
      fwd: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v4h-4', 'M9 10v5', 'M12 10h2.5v5'],
      list: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
      mic: ['M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21'],
      headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2z', 'M20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z'],
    });

    function fmtTime(sec) {
      const s = Math.max(0, Math.floor(sec || 0));
      const hh = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60;
      return (hh ? hh + ':' + pad(mm) : mm) + ':' + pad(ss);
    }
    function fmtDur(sec, t) {
      if (!sec) return '';
      const m = Math.round(sec / 60);
      if (m < 60) return t('dateLocale') === 'zh-CN' ? m + ' 分钟' : m + ' min';
      const hh = Math.floor(m / 60); const mm = m % 60;
      return t('dateLocale') === 'zh-CN' ? hh + ' 小时' + (mm ? ' ' + mm + ' 分' : '') : hh + 'h ' + (mm ? mm + 'm' : '');
    }

    /* ---- Audio singleton: lives outside React so playback survives panel switches. ---- */
    const player = { audio: null, ep: null, error: null, listeners: new Set(), lastSave: 0, speed: 1 };
    try { player.speed = Number(localStorage.getItem('dsh.podcasts.speed')) || 1; } catch {}
    const notify = () => player.listeners.forEach((fn) => fn());
    function saveProgress(extra) {
      const a = player.audio; const ep = player.ep;
      if (!a || !ep) return;
      player.lastSave = Date.now();
      call({ action: 'progress', id: ep.id, position: a.currentTime || 0, duration: Number.isFinite(a.duration) ? a.duration : undefined, ...extra }).catch(() => {});
    }
    function audio() {
      if (player.audio) return player.audio;
      const a = new Audio();
      a.preload = 'metadata';
      a.addEventListener('timeupdate', () => { if (!a.paused && Date.now() - player.lastSave > 15000) saveProgress(); notify(); });
      ['play', 'pause', 'loadedmetadata', 'durationchange', 'waiting', 'playing', 'ratechange', 'seeked'].forEach((e) => a.addEventListener(e, notify));
      a.addEventListener('pause', () => { if (a.currentTime > 0 && !a.ended) saveProgress(); });
      a.addEventListener('error', () => { player.error = (a.error && a.error.message) || 'media error'; notify(); });
      a.addEventListener('ended', async () => {
        saveProgress({ played: true });
        try {
          const q = await call({ action: 'queue' });
          const next = q.queue.find((x) => !player.ep || x.id !== player.ep.id);
          if (next) playEpisode(next, 0); else notify();
        } catch { notify(); }
      });
      player.audio = a;
      return a;
    }
    function playEpisode(ep, from) {
      const a = audio();
      if (player.ep && player.ep.id === ep.id) { a.paused ? a.play().catch((e) => { player.error = e.message; notify(); }) : a.pause(); return; }
      if (player.ep && a.currentTime > 0) saveProgress();
      player.ep = ep; player.error = null;
      a.src = ep.audio;
      a.playbackRate = player.speed;
      const start = from !== undefined ? from : (ep.played ? 0 : ep.position || 0);
      const seek = () => { if (start > 0 && start < (a.duration || Infinity) - 5) a.currentTime = start; a.removeEventListener('loadedmetadata', seek); };
      a.addEventListener('loadedmetadata', seek);
      a.play().catch((e) => { player.error = e.message; notify(); });
      if (!ep.queued) call({ action: 'queue_add', id: ep.id, next: true }).catch(() => {});
      notify();
    }
    function usePlayer() {
      const [, setTick] = useState(0);
      useEffect(() => { const fn = () => setTick((n) => n + 1); player.listeners.add(fn); return () => { player.listeners.delete(fn); }; }, []);
      return player;
    }

    function Cover(props) {
      const size = props.size || 56;
      const [bad, setBad] = useState(false);
      const label = (props.title || '?').trim().charAt(0).toUpperCase();
      const hue = [...String(props.title || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 3);
      return h('span', { className: 'pc-cover', style: { width: size, height: size, borderRadius: Math.round(size * 0.2), '--pc-hue': hue } },
        props.src && !bad ? h('img', { src: props.src, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: () => setBad(true) }) : h('span', null, label));
    }

    function Episode(props) {
      const { ep, t, onChanged, showShow } = props;
      const p = usePlayer();
      const [open, setOpen] = useState(false);
      const [notes, setNotes] = useState(null);
      const current = p.ep && p.ep.id === ep.id;
      const playing = current && p.audio && !p.audio.paused;
      const pos = current && p.audio ? p.audio.currentTime : ep.position;
      const dur = (current && p.audio && Number.isFinite(p.audio.duration) ? p.audio.duration : 0) || ep.duration;
      const pct = dur && pos ? Math.min(100, (pos / dur) * 100) : 0;
      const act = async (body) => { try { await call(body); onChanged(); } catch (e) { props.onError(e.message); } };
      const toggleNotes = async () => {
        setOpen(!open);
        if (!open && notes === null) {
          try { const r = await call({ action: 'episode', id: ep.id }); setNotes(r.episode.notes || ''); } catch (e) { setNotes(e.message); }
        }
      };
      const meta = [showShow ? ep.show : null, ep.publishedAt ? ago(ep.publishedAt, t) : null,
        ep.played ? t('played') : pct > 0 ? t('left', { t: fmtTime(dur - pos) }) : fmtDur(dur, t)].filter(Boolean);
      return h('li', { className: 'pc-ep' + (current ? ' is-current' : '') + (ep.played ? ' is-played' : '') },
        h('div', { className: 'pc-ep-row' },
          h(Cover, { src: ep.image, title: ep.show, size: 52 }),
          h('div', { className: 'pc-ep-body' },
            h('div', { className: 'pc-ep-meta' }, meta.join(' · ')),
            h('button', { type: 'button', className: 'pc-ep-title', onClick: toggleNotes, 'aria-expanded': open }, ep.title),
            ep.reason ? h('div', { className: 'pc-ep-reason' }, h(Icon, { name: 'sparkle', size: 12 }), ep.reason) : null,
            pct > 0 && !ep.played ? h('div', { className: 'lp-progress pc-ep-progress' }, h('i', { style: { width: pct + '%' } })) : null),
          h('div', { className: 'pc-ep-actions' },
            h('button', {
              type: 'button', className: 'lp-round lp-round-sm' + (ep.queued ? ' is-on' : ''), title: ep.queued ? t('queueRemove') : t('queueAdd'),
              'aria-label': ep.queued ? t('queueRemove') : t('queueAdd'), onClick: () => act({ action: ep.queued ? 'queue_remove' : 'queue_add', id: ep.id }),
            }, h(Icon, { name: ep.queued ? 'check' : 'plus', size: 14 })),
            h('button', {
              type: 'button', className: 'lp-round lp-round-sm', title: ep.played ? t('markUnplayed') : t('markPlayed'),
              'aria-label': ep.played ? t('markUnplayed') : t('markPlayed'), onClick: () => act({ action: 'progress', id: ep.id, played: !ep.played }),
            }, h(Icon, { name: ep.played ? 'refresh' : 'headphones', size: 14 })),
            h('button', { type: 'button', className: 'pc-play' + (playing ? ' is-playing' : ''), 'aria-label': playing ? t('pause') : t('play'), onClick: () => playEpisode(ep) },
              h(Icon, { name: playing ? 'pause' : 'play', size: 16, stroke: playing ? 2.4 : 1.6 })))),
        open ? h('div', { className: 'pc-notes' },
          notes === null ? h('span', { className: 'lp-muted' }, t('loading'))
            : notes ? notes.split('\n').map((l, i) => h('p', { key: i }, l)) : h('span', { className: 'lp-muted' }, '—'),
          ep.link ? h('a', { className: 'lp-link pc-notes-link', href: ep.link, target: '_blank', rel: 'noopener noreferrer' }, t('open')) : null) : null);
    }

    function PlayerBar(props) {
      const { t } = props;
      const p = usePlayer();
      if (!p.ep) return null;
      const a = p.audio;
      const dur = a && Number.isFinite(a.duration) ? a.duration : p.ep.duration || 0;
      const cur = a ? a.currentTime : 0;
      const playing = a && !a.paused;
      const speeds = [1, 1.25, 1.5, 1.75, 2, 0.8];
      const cycle = () => {
        const next = speeds[(speeds.indexOf(p.speed) + 1) % speeds.length] || 1;
        p.speed = next; if (a) a.playbackRate = next;
        try { localStorage.setItem('dsh.podcasts.speed', String(next)); } catch {}
        notify();
      };
      return h('div', { className: 'pc-bar', role: 'region', 'aria-label': t('nowPlaying') },
        h(Cover, { src: p.ep.image, title: p.ep.show, size: 46 }),
        h('div', { className: 'pc-bar-info' },
          h('div', { className: 'pc-bar-title' }, p.ep.title),
          h('div', { className: 'pc-bar-show' }, p.error ? h('span', { className: 'pc-bar-err' }, t('playFailed', { error: p.error })) : p.ep.show)),
        h('div', { className: 'pc-bar-ctrl' },
          h('button', { type: 'button', className: 'lp-round', 'aria-label': t('back15'), title: t('back15'), onClick: () => { if (a) a.currentTime = Math.max(0, a.currentTime - 15); } }, h(Icon, { name: 'back', size: 18 })),
          h('button', { type: 'button', className: 'pc-play pc-play-lg' + (playing ? ' is-playing' : ''), 'aria-label': playing ? t('pause') : t('play'), onClick: () => playEpisode(p.ep) },
            h(Icon, { name: playing ? 'pause' : 'play', size: 20, stroke: playing ? 2.4 : 1.6 })),
          h('button', { type: 'button', className: 'lp-round', 'aria-label': t('fwd30'), title: t('fwd30'), onClick: () => { if (a) a.currentTime = Math.min(dur || Infinity, a.currentTime + 30); } }, h(Icon, { name: 'fwd', size: 18 }))),
        h('div', { className: 'pc-bar-seek' },
          h('span', null, fmtTime(cur)),
          h('input', {
            type: 'range', min: 0, max: Math.max(1, Math.floor(dur)), step: 1, value: Math.floor(cur), 'aria-label': 'seek',
            style: { '--pc-pct': (dur ? (cur / dur) * 100 : 0) + '%' },
            onChange: (e) => { if (a) a.currentTime = Number(e.target.value); },
          }),
          h('span', null, dur ? '-' + fmtTime(dur - cur) : '--:--')),
        h('button', { type: 'button', className: 'lp-ghost pc-speed', title: t('speed'), onClick: cycle }, p.speed + '×'));
    }

    function Picks(props) {
      const { t, hasShows, onChanged, onError } = props;
      const [data, setData] = useState(null);
      const [busy, setBusy] = useState(false);
      const alive = useRef(true);
      const fetchPicks = useCallback(async (refresh) => {
        setBusy(true);
        try { const r = await call({ action: 'picks', refresh: !!refresh }); if (alive.current) setData(r); }
        catch (err) { if (alive.current) { onError(err.message); setData((d) => d || { episodes: [] }); } }
        finally { if (alive.current) setBusy(false); }
      }, [onError]);
      useEffect(() => { alive.current = true; if (hasShows) fetchPicks(false); else setData({ episodes: [] }); return () => { alive.current = false; }; }, [hasShows]);
      const eps = data && data.episodes ? data.episodes : [];
      let time = '';
      if (data && data.generatedAt) { try { time = new Date(data.generatedAt).toLocaleTimeString(safeLocale(t), { hour: '2-digit', minute: '2-digit' }); } catch { time = ''; } }
      return h('div', null,
        h('div', { className: 'pc-picks-head' },
          h('div', null,
            h('h2', { className: 'pc-h2 pc-picks-title' }, h(Icon, { name: 'sparkle', size: 15 }), t('picksTitle')),
            h('div', { className: 'pc-picks-sub' }, t('picksSub') + (data && data.model && time ? ' · ' + t('picksUpdated', { model: data.model.split('/').pop(), time }) : ''))),
          hasShows ? h('button', { type: 'button', className: 'lp-ghost', disabled: busy, onClick: () => fetchPicks(true) },
            h(Icon, { name: 'refresh', size: 14, className: busy ? 'lp-spin' : '' }), t('picksRegen')) : null),
        data === null || (busy && !eps.length) ? h('div', { className: 'lp-card' }, h('div', { className: 'lp-muted pc-picks-busy' }, h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }), t('picksBusy')),
          [0, 1, 2].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 56, margin: '8px 0' } })))
          : !hasShows ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'mic', text: t('picksNoShows') }))
            : !eps.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'headphones', text: t('picksEmpty') }))
              : h('div', { className: 'lp-card pc-list' }, h('ul', { className: 'pc-eps' }, eps.map((ep) => h(Episode, { key: ep.id, ep, t, onChanged: () => { onChanged(); fetchPicks(false); }, onError, showShow: true })))));
    }

    function ShowTile(props) {
      const { r, t, onSubscribe, busy } = props;
      return h('div', { className: 'pc-tile' },
        h(Cover, { src: r.image, title: r.title, size: 120 }),
        h('div', { className: 'pc-tile-title', title: r.title }, r.title),
        h('div', { className: 'pc-tile-sub' }, [r.author, r.genre].filter(Boolean).join(' · ')),
        r.subscribed ? h('span', { className: 'lp-pill tone-success' }, h(Icon, { name: 'check', size: 11 }), t('subscribed'))
          : h('button', { type: 'button', className: 'lp-ghost pc-tile-btn', disabled: busy, onClick: () => onSubscribe(r) }, h(Icon, { name: 'plus', size: 13 }), t('subscribe')));
    }

    function ImportApple(props) {
      const { t, onChanged, onError } = props;
      const [job, setJob] = useState(null);
      const [open, setOpen] = useState(false);
      const timer = useRef(null);
      const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
      const poll = useCallback(() => {
        stop();
        timer.current = setInterval(async () => {
          try {
            const r = await call({ action: 'import_status' });
            setJob(r.job);
            if (!r.job || !r.job.running) { stop(); onChanged(); }
          } catch (err) { stop(); onError(err.message); }
        }, 1000);
      }, [onChanged, onError]);
      useEffect(() => {
        call({ action: 'import_status' }).then((r) => { if (r.job) { setJob(r.job); if (r.job.running) poll(); } }).catch(() => {});
        return stop;
      }, []);
      const start = async () => {
        try { const r = await call({ action: 'import_apple' }); setJob(r.job); setOpen(false); if (r.job.running) poll(); else onChanged(); }
        catch (err) { onError(err.message); }
      };
      const running = !!(job && job.running);
      const failed = job && job.failed ? job.failed : [];
      let status = null;
      if (job && running) status = t('importing', { done: job.done, total: job.total });
      else if (job && !job.total) status = t('importNone');
      else if (job) status = t('importDone', { added: job.added, skipped: job.skipped, failed: failed.length });
      return h('div', { className: 'pc-import' },
        h('div', { className: 'pc-import-row' },
          h('button', { type: 'button', className: 'lp-primary', disabled: running, onClick: start },
            h(Icon, { name: running ? 'refresh' : 'plus', size: 14, className: running ? 'lp-spin' : '' }), t('importApple')),
          status ? h('span', { className: 'pc-import-status' }, status) : null,
          !running && failed.length ? h('button', { type: 'button', className: 'lp-ghost', onClick: () => setOpen(!open) }, t('importFailedList') + ' (' + failed.length + ')') : null),
        running && job.total ? h('div', { className: 'pc-import-bar' }, h('span', { style: { width: Math.round(100 * job.done / job.total) + '%' } })) : null,
        open && failed.length ? h('ul', { className: 'pc-import-fails' }, failed.map((f, i) => h('li', { key: i, title: f.feedUrl }, h('b', null, f.title), ' · ', f.error))) : null);
    }

    function Discover(props) {
      const { t, shows, onChanged, onError } = props;
      const [q, setQ] = useState('');
      const [results, setResults] = useState(null);
      const [top, setTop] = useState(null);
      const [busy, setBusy] = useState(false);
      const [feed, setFeed] = useState('');
      useEffect(() => { call({ action: 'top' }).then((r) => setTop(r.results)).catch((e) => onError(e.message)); }, []);
      const subscribedTitles = new Set(shows.map((s) => s.title));
      const mark = (list) => (list || []).map((r) => ({ ...r, subscribed: r.subscribed || subscribedTitles.has(r.title) }));
      const search = async (e) => {
        e.preventDefault();
        if (!q.trim()) { setResults(null); return; }
        setBusy(true);
        try { setResults((await call({ action: 'search', query: q.trim() })).results); } catch (err) { onError(err.message); } finally { setBusy(false); }
      };
      const sub = async (body) => {
        setBusy(true);
        try { await call({ action: 'subscribe', ...body }); onChanged(); if (results) setResults(results.map((r) => (r.itunesId === body.itunesId ? { ...r, subscribed: true } : r))); return true; }
        catch (err) { onError(err.message); return false; } finally { setBusy(false); }
      };
      const list = results ? mark(results) : mark(top);
      return h('div', null,
        h(ImportApple, { t, onChanged, onError }),
        h('form', { className: 'lp-bar pc-search', onSubmit: search },
          h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'search', size: 18 })),
          h('input', { className: 'lp-bar-input', value: q, onChange: (e) => setQ(e.target.value), placeholder: t('searchPh'), 'aria-label': t('searchPh') }),
          h('button', { type: 'submit', className: 'lp-primary', disabled: busy }, busy ? h(Icon, { name: 'refresh', size: 14, className: 'lp-spin' }) : null, t('search'))),
        h('form', { className: 'pc-feed', onSubmit: async (e) => { e.preventDefault(); if (feed.trim() && await sub({ feedUrl: feed.trim() })) setFeed(''); } },
          h(Icon, { name: 'rss', size: 14 }),
          h('input', { className: 'pc-feed-input', value: feed, onChange: (e) => setFeed(e.target.value), placeholder: t('feedPh'), 'aria-label': t('feedPh'), type: 'url' }),
          h('button', { type: 'submit', className: 'lp-ghost', disabled: busy || !feed.trim() }, t('addFeed'))),
        h('h2', { className: 'pc-h2' }, results ? t('results') : t('top')),
        list === null || (!results && !top) ? h('div', { className: 'pc-tiles' }, [0, 1, 2, 3, 4, 5].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 200, borderRadius: 16 } })))
          : !list.length ? h(Empty, { icon: 'search', text: t('noResults') })
            : h('div', { className: 'pc-tiles' }, list.map((r) => h(ShowTile, { key: r.itunesId || r.feedUrl, r, t, busy, onSubscribe: (x) => sub({ itunesId: x.itunesId }) }))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [tab, setTab] = useState('picks');
      const [shows, setShows] = useState(null);
      const [latest, setLatest] = useState(null);
      const [queue, setQueue] = useState(null);
      const [errors, setErrors] = useState([]);
      const [error, setError] = useState(null);
      const [showId, setShowId] = useState('');
      const [unplayed, setUnplayed] = useState(false);
      const [busy, setBusy] = useState(false);
      const alive = useRef(true);

      const load = useCallback(async (refresh) => {
        setBusy(true);
        try {
          const [s, l, q] = await Promise.all([call({ action: 'shows' }), call({ action: 'latest', limit: 150, refresh: !!refresh }), call({ action: 'queue' })]);
          if (!alive.current) return;
          setShows(s.shows); setLatest(l.episodes); setErrors(l.errors || []); setQueue(q.queue); setError(null);
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
        finally { if (alive.current) setBusy(false); }
      }, [t]);
      useEffect(() => {
        alive.current = true;
        load(false);
        const id = setInterval(() => load(false), 10 * 60 * 1000);
        const onPlayer = () => { if (player.audio && player.audio.ended) load(false); };
        player.listeners.add(onPlayer);
        return () => { alive.current = false; clearInterval(id); player.listeners.delete(onPlayer); };
      }, [load]);

      const showsList = shows || [];
      const eps = latest || [];
      const weekAgo = Date.now() - 7 * 86400000;
      const newWeek = eps.filter((e) => e.publishedAt && Date.parse(e.publishedAt) > weekAgo && !e.played).length;
      const queueIds = new Set((queue || []).map((q) => q.id));
      const visible = eps.map((e) => ({ ...e, queued: queueIds.has(e.id) }))
        .filter((e) => (!showId || e.showId === showId) && (!unplayed || !e.played));
      const nowLong = new Date().toLocaleDateString(safeLocale(t), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const onError = (m) => setError(t('saveFailed', { error: m }));
      const changed = () => load(false);
      const epList = (list, showShow) => h('ul', { className: 'pc-eps' }, list.map((ep) => h(Episode, { key: ep.id, ep, t, onChanged: changed, onError, showShow })));

      let body;
      if (tab === 'picks') body = h(Picks, { t, hasShows: shows === null ? true : showsList.length > 0, onChanged: changed, onError });
      else if (tab === 'discover') body = h(Discover, { t, shows: showsList, onChanged: changed, onError });
      else if (tab === 'queue') {
        body = queue === null ? h('div', { className: 'lp-loading' }, t('loading'))
          : !queue.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'list', text: t('emptyQueue') }))
            : h('div', { className: 'lp-card pc-list' }, epList(queue, true));
      } else if (tab === 'shows') {
        body = shows === null ? h('div', { className: 'lp-loading' }, t('loading'))
          : !showsList.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'mic', text: t('emptyShows') }, h('button', { type: 'button', className: 'lp-primary', onClick: () => setTab('discover') }, t('tabDiscover'))))
            : h('div', { className: 'pc-shows' }, showsList.map((s) => h('div', { key: s.id, className: 'pc-show' },
              h('button', { type: 'button', className: 'pc-show-main', onClick: () => { setShowId(s.id); setTab('latest'); } },
                h(Cover, { src: s.image, title: s.title, size: 72 }),
                h('span', { className: 'pc-show-body' },
                  h('span', { className: 'pc-show-title' }, s.title),
                  h('span', { className: 'pc-show-sub' }, [s.author, s.latestAt ? ago(s.latestAt, t) : null].filter(Boolean).join(' · ')),
                  s.error ? h('span', { className: 'lp-pill tone-error', title: s.error }, '!') : h('span', { className: 'pc-show-desc' }, s.description))),
              h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger pc-show-del', title: t('unsubscribe'), 'aria-label': t('unsubscribe') + ' ' + s.title,
                onClick: async () => { try { await call({ action: 'unsubscribe', id: s.id }); if (showId === s.id) setShowId(''); changed(); } catch (e) { onError(e.message); } } }, h(Icon, { name: 'trash', size: 13 })))));
      } else {
        body = latest === null ? h('div', { className: 'lp-card' }, [0, 1, 2, 3].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 56, margin: '8px 0' } })))
          : !showsList.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'headphones', text: t('emptyLatest') }, h('button', { type: 'button', className: 'lp-primary', onClick: () => setTab('discover') }, t('tabDiscover'))))
            : h(React.Fragment, null,
              h('div', { className: 'pc-filter' },
                h('label', { className: 'lp-field' }, h(Icon, { name: 'mic', size: 14 }),
                  h('select', { value: showId, onChange: (e) => setShowId(e.target.value), 'aria-label': t('allShows') },
                    h('option', { value: '' }, t('allShows')), showsList.map((s) => h('option', { key: s.id, value: s.id }, s.title)))),
                h('label', { className: 'pc-check' }, h('input', { type: 'checkbox', checked: unplayed, onChange: (e) => setUnplayed(e.target.checked) }), t('unplayedOnly')),
                h('button', { type: 'button', className: 'lp-ghost', onClick: () => load(true), disabled: busy }, h(Icon, { name: 'refresh', size: 14, className: busy ? 'lp-spin' : '' }), t('refresh')),
                errors.length ? h('span', { className: 'lp-pill tone-warn', title: errors.map((x) => x.title + ': ' + x.error).join('\n') }, t('feedErrors', { n: errors.length })) : null),
              h('div', { className: 'lp-card pc-list' }, visible.length ? epList(visible, !showId) : h(Empty, { icon: 'search', text: t('noResults') })));
      }

      return h('div', { className: 'lp-root pc-root' },
        h('style', null, KIT_CSS + CSS),
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, nowLong), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'mic', value: showsList.length, label: t('statShows'), tone: 'tone-brand' }),
              h(Stat, { icon: 'sparkle', value: newWeek, label: t('statNew'), tone: 'tone-warn' }),
              h(Stat, { icon: 'list', value: (queue || []).length, label: t('statQueue'), tone: 'tone-success' }))),
          h(ErrorBar, { error, onRetry: () => load(true), retryLabel: t('retry'), onClose: () => setError(null) }),
          h('div', { className: 'pc-tabs' }, h(Tabs, {
            value: tab, onChange: setTab, items: [
              { id: 'picks', label: t('tabPicks') },
              { id: 'latest', label: t('tabLatest') },
              { id: 'queue', label: t('tabQueue'), count: (queue || []).length },
              { id: 'shows', label: t('tabShows'), count: showsList.length },
              { id: 'discover', label: t('tabDiscover') },
            ],
          })),
          body,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint'))),
        h(PlayerBar, { t }));
    }

    function PodcastIcon(props) {
      const p = usePlayer();
      const playing = p.audio && !p.audio.paused;
      return h('span', { style: { position: 'relative', display: 'inline-flex' } },
        h(Icon, { name: 'headphones', size: props.size || 18, stroke: props.active ? 2 : 1.6 }),
        playing ? h('span', { style: { position: 'absolute', right: -2, top: -2, width: 7, height: 7, borderRadius: '50%', background: 'var(' + BRAND + ')', boxShadow: '0 0 0 2px var(--dsw-specific-sidebar-fill)' } }) : null);
    }

    const CSS = [
      '.pc-root{--lp-amb-b:var(' + ERR + ');--lp-amb-c:var(' + BRAND + ')}',
      '.pc-root{position:relative;display:flex;flex-direction:column}',
      '.pc-root > .lp-inner{flex:1;width:100%}',
      '.pc-tabs{margin-bottom:16px}',
      '.pc-cover{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,hsl(var(--pc-hue) 65% 60%),hsl(calc(var(--pc-hue) + 50) 60% 42%));color:rgba(255,255,255,.92);font-weight:700;box-shadow:0 1px 3px ' + tint('--dsw-alias-label-primary', 12) + '}',
      '.pc-cover img{width:100%;height:100%;object-fit:cover;display:block}',
      '.pc-filter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
      '.pc-filter select{max-width:220px}',
      '.pc-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:' + FG2 + ';cursor:pointer}',
      '.pc-check input{accent-color:var(' + BRAND + ')}',
      '.pc-list{padding:6px}',
      '.pc-eps{list-style:none;margin:0;padding:0}',
      '.pc-ep{border-radius:14px;transition:background .12s}',
      '.pc-ep + .pc-ep{margin-top:2px}',
      '.pc-ep:hover{' + GLASS_SOFT + '}',
      '.pc-ep.is-current{background:' + tint(BRAND, 8) + '}',
      '.pc-ep-row{display:flex;align-items:center;gap:12px;padding:10px 12px}',
      '.pc-ep-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.pc-ep-meta{font-size:11.5px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pc-ep-title{padding:0;border:0;background:transparent;color:' + FG + ';text-align:left;font-size:13.5px;line-height:20px;font-weight:600;cursor:pointer;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pc-ep-title:hover{color:var(' + BRAND + ')}',
      '.pc-ep.is-played .pc-ep-title{color:' + FG2 + ';font-weight:500}',
      '.pc-ep-progress{height:3px;max-width:240px;margin-top:3px}',
      '.pc-ep-actions{display:flex;align-items:center;gap:4px;flex:none}',
      '.pc-ep-actions .lp-round{opacity:0;transition:opacity .12s}',
      '.pc-ep:hover .pc-ep-actions .lp-round,.pc-ep-actions .lp-round:focus-visible,.pc-ep-actions .lp-round.is-on{opacity:1}',
      '@media (hover:none){.pc-ep-actions .lp-round{opacity:1}}',
      '.pc-play{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:0;background:' + tint(BRAND, 14) + ';color:var(' + BRAND + ');cursor:pointer;flex:none;transition:transform .12s,background .12s}',
      '.pc-play:hover{transform:scale(1.06)}',
      '.pc-play.is-playing,.pc-play-lg{background:var(' + BRAND + ');color:#fff}',
      '.pc-play svg{margin-left:1px}',
      '.pc-play.is-playing svg{margin-left:0}',
      '.pc-play-lg{width:42px;height:42px}',
      '.pc-notes{padding:0 16px 14px 76px;font-size:12.5px;line-height:20px;color:' + FG2 + ';max-height:280px;overflow:auto}',
      '.pc-notes p{margin:0 0 4px}',
      '.pc-notes-link{display:inline-block;margin-top:6px;color:var(' + BRAND + ')}',
      '.pc-shows{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}',
      '.pc-show{position:relative;border-radius:16px;' + GLASS + ';transition:border-color .15s,box-shadow .15s}',
      '.pc-show:hover{' + GLASS_HOVER + '}',
      '.pc-show-main{display:flex;gap:14px;width:100%;padding:14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.pc-show-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;padding-right:24px}',
      '.pc-show-title{font-size:14px;font-weight:650}',
      '.pc-show-sub{font-size:11.5px;color:var(' + BRAND + ')}',
      '.pc-show-desc{font-size:12px;line-height:18px;color:' + FG2 + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pc-show-del{position:absolute;top:10px;right:10px;opacity:0}',
      '.pc-show:hover .pc-show-del,.pc-show-del:focus-visible{opacity:1}',
      '.pc-search{margin-bottom:8px}',
      '.pc-picks-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}',
      '.pc-picks-title{display:flex;align-items:center;gap:6px;margin:0}',
      '.pc-picks-sub{margin-top:3px;font-size:12px;color:' + FG2 + '}',
      '.pc-picks-busy{display:flex;align-items:center;gap:8px;padding:6px 2px}',
      '.pc-ep-reason{display:flex;align-items:center;gap:5px;margin-top:3px;font-size:12px;color:var(' + BRAND + ')}',
      '.pc-import{margin-bottom:14px}',
      '.pc-import-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}',
      '.pc-import-status{font-size:12.5px;color:' + FG2 + ';font-variant-numeric:tabular-nums}',
      '.pc-import-bar{height:3px;margin-top:10px;border-radius:2px;background:var(--lp-glass-edge);overflow:hidden}',
      '.pc-import-bar span{display:block;height:100%;background:var(' + BRAND + ');transition:width .3s}',
      '.pc-import-fails{list-style:none;margin:10px 0 0;padding:0;max-height:200px;overflow:auto;font-size:12px;color:' + FG2 + '}',
      '.pc-import-fails li{padding:3px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pc-import-fails b{color:' + FG + ';font-weight:550}',
      '.pc-feed{display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;margin-bottom:22px;color:' + FG2 + '}',
      '.pc-feed-input{flex:1;min-width:0;height:30px;border:0;outline:0;background:transparent;color:' + FG + ';font-size:12.5px}',
      '.pc-feed-input::placeholder{color:' + FG2 + '}',
      '.pc-h2{margin:0 0 12px;font-size:14px;font-weight:650}',
      '.pc-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}',
      '.pc-tile{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:16px;' + GLASS + '}',
      '.pc-tile .pc-cover{width:100%!important;height:auto!important;aspect-ratio:1;font-size:36px}',
      '.pc-tile-title{width:100%;font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pc-tile-sub{width:100%;font-size:11.5px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:16px}',
      '.pc-tile-btn{height:26px;font-size:12px}',
      '.pc-bar{position:sticky;bottom:0;z-index:5;display:grid;grid-template-columns:auto minmax(120px,1.2fr) auto minmax(160px,2fr) auto;align-items:center;gap:14px;padding:10px 20px;background:var(--lp-glass-strong);border-top:1px solid var(--lp-glass-edge);box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 -10px 30px -12px ' + tint('--dsw-alias-label-primary', 22) + ';' + GLASS_BLUR + '}',
      '@media (max-width:820px){.pc-bar{grid-template-columns:auto 1fr auto;padding:10px 12px}.pc-bar-seek{grid-column:1 / -1;order:5}.pc-speed{display:none!important}}',
      '.pc-bar-info{min-width:0}',
      '.pc-bar-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pc-bar-show{font-size:11.5px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.pc-bar-err{color:var(' + ERR + ')}',
      '.pc-bar-ctrl{display:flex;align-items:center;gap:6px}',
      '.pc-bar-seek{display:flex;align-items:center;gap:10px;font-size:11px;color:' + FG2 + ';font-variant-numeric:tabular-nums}',
      '.pc-bar-seek input{flex:1;min-width:0;height:4px;-webkit-appearance:none;appearance:none;border-radius:999px;background:linear-gradient(to right,var(' + BRAND + ') var(--pc-pct),' + B2 + ' var(--pc-pct));cursor:pointer}',
      '.pc-bar-seek input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(' + BRAND + ');box-shadow:0 0 0 3px ' + tint(BRAND, 20) + '}',
      '.pc-bar-seek input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:var(' + BRAND + ')}',
      '.pc-speed{min-width:52px;justify-content:center;font-variant-numeric:tabular-nums}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'podcasts: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 24, label: () => t('panel'), locale: NS,
        }, PodcastIcon));
        ctx.effect(() => () => {
          if (player.audio) { if (!player.audio.paused) saveProgress(); player.audio.pause(); player.audio.removeAttribute('src'); player.audio.load(); }
          player.audio = null; player.ep = null; player.listeners.clear();
        }, 'podcasts: stop audio on unload');
      },
    };
  },
});
