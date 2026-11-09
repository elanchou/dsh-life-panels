window.__ModuleLoader__.load({
  id: '@local/iptv',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'iptv';
    const NS = 'iptv';
    const API = '/plugin-api/iptv';
    const call = makeCall(API);
    const PAGE = 120;
    const IDLE_MS = 3200;

    const zh = {
      dateLocale: 'zh-CN', panel: '电视', title: 'IPTV',
      tabAll: '全部', tabFav: '收藏', search: '搜索频道或分组', allGroups: '全部',
      nothing: '今晚看点什么？', nothingHint: '从右侧频道列表挑一个，或在对话里说“打开 CCTV-1”', openGuide: '打开频道列表',
      sourceFailed: '该频道的源无响应或已失效（{detail}），换一个频道试试', buffering: '正在连接信号…', playerError: '无法播放：{error}',
      retry: '重试', nextCh: '下一个频道', prevCh: '上一个频道', openRaw: '复制流地址', copied: '已复制',
      fav: '收藏', unfav: '取消收藏', empty: '没有匹配的频道', emptyFav: '还没有收藏的频道',
      loadFailed: '加载失败：{error}', more: '加载更多（还有 {n} 个）',
      lists: '播放列表', listUrl: 'M3U 地址', listName: '名称（可选）', add: '添加', adding: '添加中…',
      added: '已添加 {name}（{n} 个频道）', remove: '删除', enabled: '启用', failed: '加载失败', channelsN: '{n} 个频道',
      reload: '刷新', done: '完成', fullscreen: '全屏', exitFullscreen: '退出全屏', pip: '画中画', mute: '静音', unmute: '取消静音',
      play: '播放', pause: '暂停', volume: '音量', live: '直播', guide: '频道列表', closeGuide: '收起频道列表', settings: '播放列表与代理',
      shortcuts: '↑↓ 换台 · 空格 暂停 · F 全屏 · M 静音 · L 列表',
      inPip: '画中画播放中', exitPip: '退出画中画', backToTv: '回到电视', closePlayer: '关闭播放', miniDrag: '拖动小窗',
      proxy: '网络代理', proxyHint: '直播流和播放列表从本机发出请求，可走 HTTP / HTTPS / SOCKS5 代理',
      proxyUrl: '代理地址，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080', proxyOn: '启用代理', proxyLists: '播放列表也走代理',
      proxySave: '保存', proxyTest: '测试', proxyTesting: '测试中…', proxySaved: '已保存代理设置', proxyOk: '代理可用（{via}，{ms} ms）',
      proxyBadge: '代理', proxyOff: '直连',
    };
    const en = {
      dateLocale: 'en-US', panel: 'TV', title: 'IPTV',
      tabAll: 'All', tabFav: 'Favorites', search: 'Search channels or groups', allGroups: 'All',
      nothing: 'What are we watching?', nothingHint: 'Pick a channel from the guide, or ask in chat: “Open CCTV-1”', openGuide: 'Open the guide',
      sourceFailed: 'This channel\'s source is down or not responding ({detail}). Try another channel.', buffering: 'Tuning in…', playerError: 'Cannot play: {error}',
      retry: 'Retry', nextCh: 'Next channel', prevCh: 'Previous channel', openRaw: 'Copy stream URL', copied: 'Copied',
      fav: 'Favorite', unfav: 'Remove favorite', empty: 'No matching channels', emptyFav: 'No favorites yet',
      loadFailed: 'Failed to load: {error}', more: 'Load more ({n} left)',
      lists: 'Playlists', listUrl: 'M3U URL', listName: 'Name (optional)', add: 'Add', adding: 'Adding…',
      added: 'Added {name} ({n} channels)', remove: 'Remove', enabled: 'Enabled', failed: 'Failed', channelsN: '{n} channels',
      reload: 'Refresh', done: 'Done', fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen', pip: 'Picture in picture', mute: 'Mute', unmute: 'Unmute',
      play: 'Play', pause: 'Pause', volume: 'Volume', live: 'Live', guide: 'Channel guide', closeGuide: 'Hide the guide', settings: 'Playlists and proxy',
      shortcuts: '↑↓ channel · Space pause · F fullscreen · M mute · L guide',
      inPip: 'In picture in picture', exitPip: 'Exit picture in picture', backToTv: 'Back to TV', closePlayer: 'Stop playback', miniDrag: 'Drag the mini player',
      proxy: 'Network proxy', proxyHint: 'Streams and playlists are requested from this computer and can go through an HTTP, HTTPS or SOCKS5 proxy',
      proxyUrl: 'Proxy address, e.g. http://127.0.0.1:7890 or socks5://127.0.0.1:1080', proxyOn: 'Use proxy', proxyLists: 'Also for playlists',
      proxySave: 'Save', proxyTest: 'Test', proxyTesting: 'Testing…', proxySaved: 'Proxy settings saved', proxyOk: 'Proxy works ({via}, {ms} ms)',
      proxyBadge: 'Proxy', proxyOff: 'Direct',
    };

    ICONS.tv = ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 21h6', 'M8 3l4 2 4-2'];
    ICONS.play = ['M8 5.5v13l10.5-6.5z'];
    ICONS.pause = ['M8.5 5.5v13', 'M15.5 5.5v13'];
    ICONS.star = ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z'];
    ICONS.expand = ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'];
    ICONS.collapse = ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'];
    ICONS.pip = ['M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M12 13h6v4h-6z'];
    ICONS.volume = ['M4 10v4h4l5 4V6l-5 4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'];
    ICONS.mute = ['M4 10v4h4l5 4V6l-5 4z', 'M17 9.5l4.5 5', 'M21.5 9.5l-4.5 5'];
    ICONS.copy = ['M9 9h10v11H9z', 'M5 15V4h10'];
    ICONS.list = ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'];
    ICONS.up = ['M6 15l6-6 6 6'];

    /* Shared across panel remounts so the player script loads once. */
    const loader = { promise: null };
    function loadHls() {
      if (window.Hls) return Promise.resolve(window.Hls);
      if (!loader.promise) {
        loader.promise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = API + '/hls.js';
          s.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('hls.js missing')));
          s.onerror = () => { loader.promise = null; reject(new Error('could not load the player')); };
          document.head.appendChild(s);
        });
      }
      return loader.promise;
    }
    const streamUrl = (url) => API + '/stream?u=' + encodeURIComponent(url);
    function initials(name) {
      const s = String(name || '').replace(/[\s()[\]（）\-_.:·|]+/g, '');
      return (s.match(/^[A-Za-z0-9]{1,3}/) || [s.slice(0, 2)])[0].toUpperCase();
    }
    function hue(name) { let x = 0; for (const ch of String(name)) x = (x * 31 + ch.codePointAt(0)) % 360; return x; }
    const isTyping = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

    /**
     * One player for the whole page. The <video> element and its hls.js instance live here, outside React, so leaving
     * the TV panel does not stop playback: the element moves between the panel stage (rank 3), the floating mini player
     * (rank 2) and a hidden dock (rank 1). moveBefore() moves it without the remove/insert steps, so playback and an open
     * picture-in-picture window continue; older engines fall back to appendChild and resume playback.
     */
    function createEngine() {
      const listeners = new Set();
      const hosts = [];
      let snap = { channel: null, state: 'idle', error: '', paused: false, pip: false, muted: false, volume: 1, panel: false };
      let video = null;
      let hls = null;
      let gen = 0;
      let t = (k) => k;
      const set = (patch) => { snap = { ...snap, ...patch }; for (const fn of [...listeners]) fn(); };
      function el() {
        if (video) return video;
        const v = document.createElement('video');
        v.playsInline = true;
        v.className = 'tv-video';
        Object.assign(v.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' });
        const on = (type, fn) => v.addEventListener(type, fn);
        on('playing', () => set({ state: 'playing', paused: false }));
        on('waiting', () => { if (!v.paused && snap.state !== 'error') set({ state: 'loading' }); });
        on('pause', () => { if (!snap.paused) set({ paused: true }); });
        on('play', () => { if (snap.paused) set({ paused: false }); });
        on('error', () => { if (!hls && snap.channel) set({ state: 'error', error: (v.error && v.error.message) || 'unsupported stream' }); });
        on('enterpictureinpicture', () => set({ pip: true }));
        on('leavepictureinpicture', () => set({ pip: false }));
        video = v;
        return v;
      }
      function place() {
        if (!video) return;
        let top = null;
        for (const x of hosts) if (!top || x.rank > top.rank) top = x;
        const parent = top && top.el;
        if (!parent || video.parentNode === parent) return;
        if (typeof parent.moveBefore === 'function' && video.isConnected && parent.isConnected) {
          try { parent.moveBefore(video, null); return; } catch { /* fall back below */ }
        }
        const wasPlaying = !video.paused;
        parent.appendChild(video);
        if (wasPlaying) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
      }
      function teardown() {
        gen += 1;
        if (hls) { hls.destroy(); hls = null; }
        if (video) { video.removeAttribute('src'); try { video.load(); } catch { /* detached */ } }
      }
      function start(channel) {
        const v = el();
        place();
        teardown();
        const my = gen;
        const live = () => my === gen;
        v.muted = snap.muted; v.volume = snap.volume;
        set({ channel, state: 'loading', error: '', paused: false });
        const fail = (msg) => { if (live()) set({ state: 'error', error: msg }); };
        const go = () => { const p = v.play(); if (p && p.catch) p.catch(() => { if (live()) set({ paused: true }); }); };
        const src = streamUrl(channel.url);
        loadHls().then((Hls) => {
          if (!live()) return;
          if (Hls.isSupported()) {
            let retries = 0; let media = 0;
            const inst = new Hls({ maxBufferLength: 20, manifestLoadingTimeOut: 15000, fragLoadingTimeOut: 20000 });
            hls = inst;
            inst.on(Hls.Events.ERROR, (_e, data) => {
              if (!live() || !data.fatal) return;
              const manifest = data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !manifest && retries < 3) { retries += 1; inst.startLoad(); return; }
              if (data.type === Hls.ErrorTypes.MEDIA_ERROR && media < 2) { media += 1; inst.recoverMediaError(); return; }
              const r = data.response || {};
              const body = typeof r.text === 'string' ? r.text.slice(0, 160) : '';
              fail(r.code ? t('sourceFailed', { detail: body || ('HTTP ' + r.code) }) : (data.details || data.type));
            });
            inst.on(Hls.Events.MANIFEST_PARSED, go);
            inst.loadSource(src);
            inst.attachMedia(v);
          } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
            v.src = src; go();
          } else fail('HLS is not supported in this browser');
        }).catch((e) => fail(e.message));
      }
      const hasPanel = () => hosts.some((x) => x.rank >= 3);
      function exitPip() { if (video && document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {}); }
      function stop() { exitPip(); teardown(); set({ channel: null, state: 'idle', error: '', paused: false }); }
      return {
        get: () => snap,
        subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        setT(fn) { t = fn; },
        t: (k, v) => t(k, v),
        video: () => video,
        claim(node, rank) { hosts.push({ el: node, rank }); place(); if (rank >= 3 && !snap.panel) set({ panel: true }); },
        release(node) {
          const i = hosts.findIndex((x) => x.el === node);
          if (i < 0) return;
          hosts.splice(i, 1);
          place();
          if (snap.panel && !hasPanel()) set({ panel: false });
        },
        play: start,
        retry() { if (snap.channel) start(snap.channel); },
        toggle() {
          if (!video || !snap.channel) return;
          if (video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => {}); } else video.pause();
        },
        setMuted(m) { set({ muted: !!m }); if (video) video.muted = !!m; },
        setVolume(n) { set({ volume: n, muted: n === 0 }); if (video) { video.volume = n; video.muted = n === 0; } },
        pip() {
          if (!video || !snap.channel) return;
          if (document.pictureInPictureElement === video) exitPip();
          else if (video.requestPictureInPicture) video.requestPictureInPicture().catch(() => {});
        },
        stop,
        destroy() { stop(); listeners.clear(); if (video && video.parentNode) video.parentNode.removeChild(video); video = null; },
      };
    }
    const engine = createEngine();
    const ui = { ctx: null, restored: false, mini: { right: 24, bottom: 24 } };

    function useEngine() {
      if (typeof React.useSyncExternalStore === 'function') return React.useSyncExternalStore(engine.subscribe, engine.get, engine.get);
      const [, force] = useState(0);
      useEffect(() => engine.subscribe(() => force((n) => n + 1)), []);
      return engine.get();
    }
    const useLayout = React.useLayoutEffect || useEffect;

    /** A seat for the shared <video>; the highest-ranked mounted seat holds it. */
    function VideoHost(props) {
      const ref = useRef(null);
      useLayout(() => {
        const node = ref.current;
        engine.claim(node, props.rank);
        return () => engine.release(node);
      }, []);
      return h('div', { ref, className: props.className, style: props.style, 'aria-hidden': props.hidden || undefined });
    }

    function Logo(props) {
      const { c, size } = props;
      const [broken, setBroken] = useState(false);
      useEffect(() => setBroken(false), [c && c.logo]);
      const style = { width: size, height: size, '--tv-h': hue(c ? c.name : '') };
      return h('span', { className: 'tv-logo', style },
        c && c.logo && !broken
          ? h('img', { src: c.logo, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: () => setBroken(true) })
          : h('span', { className: 'tv-logo-txt', style: { fontSize: Math.round(size * 0.34) } }, initials(c ? c.name : '')));
    }

    /** Filled play/pause glyph; the triangle is nudged right so it looks centred in a circle. */
    function PlayGlyph(props) {
      const size = props.size || 20;
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, className: 'tv-glyph', style: { display: 'block', flex: 'none' } },
        props.paused
          ? h('path', { d: 'M8.6 5.2c-.9-.55-2.1.1-2.1 1.15v11.3c0 1.05 1.2 1.7 2.1 1.15l9.3-5.65c.86-.52.86-1.78 0-2.3z', fill: 'currentColor', transform: 'translate(1.2 0)' })
          : h('g', { fill: 'currentColor' },
            h('rect', { x: 6.5, y: 5, width: 4, height: 14, rx: 1.3 }),
            h('rect', { x: 13.5, y: 5, width: 4, height: 14, rx: 1.3 })));
    }

    function Btn(props) {
      return h('button', {
        type: 'button', className: 'tv-btn' + (props.on ? ' is-on' : '') + (props.className ? ' ' + props.className : ''),
        title: props.label, 'aria-label': props.label, 'aria-pressed': props.pressed, onClick: props.onClick, disabled: props.disabled,
      }, h(Icon, { name: props.icon, size: props.size || 20, stroke: 1.9 }), props.children || null);
    }

    function ChannelRow(props) {
      const { c, n, active, onPlay, onFav, t } = props;
      return h('div', { className: 'tv-row' + (active ? ' is-active' : ''), role: 'listitem', 'data-id': c.id },
        h('button', { type: 'button', className: 'tv-row-main', onClick: () => onPlay(c), title: t('play') + ' ' + c.name },
          h('span', { className: 'tv-row-n' }, active ? h('span', { className: 'tv-eq', 'aria-hidden': true }, h('i'), h('i'), h('i')) : String(n).padStart(2, '0')),
          h(Logo, { c, size: 38 }),
          h('span', { className: 'tv-row-text' }, h('span', { className: 'tv-row-name' }, c.name), h('span', { className: 'tv-row-group' }, c.group))),
        h('button', {
          type: 'button', className: 'tv-star' + (c.favorite ? ' is-on' : ''), title: c.favorite ? t('unfav') : t('fav'),
          'aria-label': (c.favorite ? t('unfav') : t('fav')) + ' ' + c.name, onClick: () => onFav(c),
        }, h(Icon, { name: 'star', size: 15 })));
    }

    function Switch(props) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': !!props.on, 'aria-label': props.label, disabled: props.disabled,
        className: 'tv-switch' + (props.on ? ' is-on' : ''), onClick: () => props.onChange(!props.on),
      }, h('i'));
    }

    function ProxySettings(props) {
      const { t, onSaved } = props;
      const [cfg, setCfg] = useState(null);
      const [url, setUrl] = useState('');
      const [busy, setBusy] = useState('');
      const [msg, setMsg] = useState(null);
      useEffect(() => {
        call({ action: 'settings' }).then((r) => { setCfg(r.proxy); setUrl(r.proxy.url); }).catch((e) => setMsg({ ok: false, text: e.message }));
      }, []);
      if (!cfg) return msg ? h('div', { className: 'tv-msg is-error' }, msg.text) : null;
      const save = async (patch) => {
        setBusy('save'); setMsg(null);
        try {
          const r = await call({ action: 'settings', proxyUrl: url.trim(), proxyEnabled: cfg.enabled, proxyPlaylists: cfg.playlists, ...patch });
          setCfg(r.proxy); setUrl(r.proxy.url); setMsg({ ok: true, text: t('proxySaved') }); onSaved();
        } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(''); }
      };
      const test = async () => {
        setBusy('test'); setMsg(null);
        try { const r = await call({ action: 'test_proxy', proxyUrl: url.trim() }); setMsg({ ok: true, text: t('proxyOk', { via: r.via, ms: r.ms }) }); }
        catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(''); }
      };
      const dirty = url.trim() !== cfg.url;
      return h('section', { className: 'tv-sec' },
        h('div', { className: 'tv-sec-head' },
          h('div', null, h('h3', null, t('proxy')), h('p', null, t('proxyHint'))),
          h('label', { className: 'tv-toggle' }, h(Switch, { on: cfg.enabled, label: t('proxyOn'), disabled: !!busy || (!cfg.url && !url.trim()), onChange: (on) => save({ proxyEnabled: on, test: on }) }), t('proxyOn'))),
        h('form', { className: 'tv-form tv-form-3', onSubmit: (e) => { e.preventDefault(); save({ test: cfg.enabled }); } },
          h('input', { className: 'tv-input', value: url, onChange: (e) => setUrl(e.target.value), placeholder: t('proxyUrl'), 'aria-label': t('proxyUrl'), spellCheck: false, autoComplete: 'off' }),
          h('button', { type: 'button', className: 'tv-pill-btn', disabled: !!busy || !url.trim(), onClick: test }, busy === 'test' ? t('proxyTesting') : t('proxyTest')),
          h('button', { type: 'submit', className: 'tv-pill-btn is-primary', disabled: !!busy || !dirty }, t('proxySave'))),
        h('label', { className: 'tv-toggle is-sub' }, h(Switch, { on: cfg.playlists, label: t('proxyLists'), disabled: !!busy, onChange: (on) => save({ proxyPlaylists: on }) }), t('proxyLists')),
        msg ? h('div', { className: 'tv-msg' + (msg.ok ? '' : ' is-error') }, msg.text) : null);
    }

    function SettingsSheet(props) {
      const { t, lists, onChange, onClose } = props;
      const [url, setUrl] = useState('');
      const [name, setName] = useState('');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);
      const add = async (e) => {
        e.preventDefault();
        if (!url.trim() || busy) return;
        setBusy(true); setMsg(null);
        try {
          const r = await call({ action: 'add_playlist', url: url.trim(), name: name.trim() });
          setUrl(''); setName(''); setMsg({ ok: true, text: t('added', { name: r.playlist.name, n: r.channels }) });
          onChange();
        } catch (err) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
      };
      const act = async (body) => { try { await call(body); onChange(); } catch (err) { setMsg({ ok: false, text: err.message }); } };
      return h('div', { className: 'tv-sheet-wrap', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { className: 'tv-sheet', role: 'dialog', 'aria-modal': true, 'aria-label': t('settings') },
          h('div', { className: 'tv-sheet-head' },
            h('h2', null, t('settings')),
            h('button', { type: 'button', className: 'tv-pill-btn', onClick: onClose }, t('done'))),
          h('div', { className: 'tv-sheet-body' },
            h('section', { className: 'tv-sec' },
              h('div', { className: 'tv-sec-head' }, h('div', null, h('h3', null, t('lists')))),
              h('form', { className: 'tv-form tv-form-3', onSubmit: add },
                h('input', { className: 'tv-input', type: 'url', value: url, onChange: (e) => setUrl(e.target.value), placeholder: t('listUrl'), 'aria-label': t('listUrl') }),
                h('input', { className: 'tv-input', value: name, onChange: (e) => setName(e.target.value), placeholder: t('listName'), 'aria-label': t('listName') }),
                h('button', { type: 'submit', className: 'tv-pill-btn is-primary', disabled: busy || !url.trim() }, busy ? t('adding') : t('add'))),
              msg ? h('div', { className: 'tv-msg' + (msg.ok ? '' : ' is-error') }, msg.text) : null,
              h('div', { className: 'tv-lists' }, lists.map((p) => h('div', { key: p.id, className: 'tv-list' + (p.enabled ? '' : ' is-off') },
                h(Switch, { on: p.enabled, label: t('enabled') + ' ' + p.name, onChange: (on) => act({ action: 'update_playlist', id: p.id, enabled: on }) }),
                h('div', { className: 'tv-list-body' }, h('div', { className: 'tv-list-name' }, p.name), h('div', { className: 'tv-list-url' }, p.url)),
                p.error ? h('span', { className: 'tv-tag is-error', title: p.error }, t('failed')) : p.count ? h('span', { className: 'tv-tag' }, t('channelsN', { n: p.count })) : null,
                h(Btn, { icon: 'refresh', size: 15, label: t('reload') + ' ' + p.name, onClick: () => act({ action: 'refresh', id: p.id }) }),
                h(Btn, { icon: 'trash', size: 15, className: 'is-danger', label: t('remove') + ' ' + p.name, onClick: () => act({ action: 'remove_playlist', id: p.id }) }))))),
            h(ProxySettings, { t, onSaved: onChange }))));
    }

    const session = { guide: true }; // survives panel switches within the page

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [tab, setTab] = useState('all');
      const [group, setGroup] = useState('');
      const [query, setQuery] = useState('');
      const [debounced, setDebounced] = useState('');
      const [limit, setLimit] = useState(PAGE);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [busy, setBusy] = useState(false);
      const [sheet, setSheet] = useState(false);
      const [lists, setLists] = useState([]);
      const [favIds, setFavIds] = useState({});
      const [guide, setGuideState] = useState(session.guide);
      const [idle, setIdle] = useState(false);
      const [fs, setFs] = useState(false);
      const [osd, setOsd] = useState(null);
      const [copied, setCopied] = useState(false);
      const rootRef = useRef(null);
      const listRef = useRef(null);
      const alive = useRef(true);
      const seq = useRef(0);
      const idleTimer = useRef(0);
      const play = useEngine();
      const current = play.channel;
      const muted = play.muted;
      const volume = play.volume;
      const setMuted = engine.setMuted;

      const setGuide = (v) => { session.guide = v; setGuideState(v); };
      useEffect(() => { alive.current = true; return () => { alive.current = false; clearTimeout(idleTimer.current); }; }, []);
      useEffect(() => { const id = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(id); }, [query]);
      useEffect(() => { setLimit(PAGE); }, [tab, group, debounced]);

      const load = useCallback(async (refresh) => {
        const mine = ++seq.current;
        setBusy(true);
        try {
          const r = await call({ action: 'channels', favorites: tab === 'fav', group: group || undefined, query: debounced || undefined, limit, refresh: !!refresh });
          if (!alive.current || mine !== seq.current) return;
          setData(r); setError(null); setFavIds({});
        } catch (e) { if (alive.current && mine === seq.current) setError(t('loadFailed', { error: e.message })); }
        finally { if (alive.current && mine === seq.current) setBusy(false); }
      }, [tab, group, debounced, limit, t]);
      useEffect(() => { load(false); }, [load]);
      const loadLists = useCallback(async () => {
        try { const r = await call({ action: 'playlists' }); if (alive.current) setLists(r.playlists); } catch { /* shown by load() */ }
      }, []);
      useEffect(() => { if (sheet) loadLists(); }, [sheet, loadLists]);
      useEffect(() => {
        // Restore the last channel once per page load, paused-free but only when nothing is playing yet.
        if (!data || ui.restored || engine.get().channel || !data.last) return;
        ui.restored = true;
        const l = data.last;
        engine.play({ id: l.id, name: l.name, url: l.url, logo: l.logo, group: l.group });
      }, [data]);

      // Hide the chrome after a few idle seconds while video plays; any pointer or key activity shows it again.
      const wake = useCallback(() => {
        setIdle(false);
        clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => { if (alive.current) setIdle(true); }, IDLE_MS);
      }, []);
      useEffect(() => { wake(); }, [current && current.id, wake]);
      const chromeHidden = idle && play.state === 'playing' && !play.paused && !sheet;

      useEffect(() => {
        const onFs = () => setFs(document.fullscreenElement === rootRef.current);
        document.addEventListener('fullscreenchange', onFs);
        return () => document.removeEventListener('fullscreenchange', onFs);
      }, []);
      useEffect(() => {
        if (!osd) return undefined;
        const id = setTimeout(() => setOsd(null), 2400);
        return () => clearTimeout(id);
      }, [osd]);

      const items = (data && data.items) || [];
      const total = data ? data.total : 0;
      const groups = (data && data.groups) || [];
      const isFav = (c) => (c.id in favIds ? favIds[c.id] : !!c.favorite);
      const currentIndex = current ? items.findIndex((c) => c.id === current.id) : -1;
      const currentFav = current ? (current.id in favIds ? favIds[current.id] : (currentIndex >= 0 ? !!items[currentIndex].favorite : tab === 'fav')) : false;

      const tune = (c, index) => {
        ui.restored = true;
        engine.play(c);
        setOsd({ n: index >= 0 ? index + 1 : null, c });
        call({ action: 'last', id: c.id, name: c.name, url: c.url, logo: c.logo, group: c.group }).catch(() => {});
      };
      const step = (d) => {
        if (!items.length) return;
        const i = currentIndex < 0 ? (d > 0 ? 0 : items.length - 1) : (currentIndex + d + items.length) % items.length;
        tune(items[i], i);
      };
      const toggleFav = async (c) => {
        const next = !isFav(c);
        setFavIds((m) => ({ ...m, [c.id]: next }));
        try {
          await call({ action: 'favorite', id: c.id, url: c.url, name: c.name, group: c.group, on: next });
          if (tab === 'fav') load(false);
          else setData((d) => (d ? { ...d, favoriteCount: Math.max(0, d.favoriteCount + (next ? 1 : -1)) } : d));
        } catch (e) { setFavIds((m) => ({ ...m, [c.id]: !next })); setError(e.message); }
      };
      const togglePlay = engine.toggle;
      const toggleFs = () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if (rootRef.current && rootRef.current.requestFullscreen) rootRef.current.requestFullscreen().catch(() => {});
      };
      const pip = engine.pip;
      const copy = async () => {
        if (!current) return;
        try { await navigator.clipboard.writeText(current.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
      };

      const keys = useRef({});
      keys.current = { step, togglePlay, toggleFs, setMuted, setGuide, guide, muted, sheet, setSheet, wake };
      useEffect(() => {
        const onKey = (e) => {
          const k = keys.current;
          const root = rootRef.current;
          if (!root || !root.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
          if (k.sheet) { if (e.key === 'Escape') { e.preventDefault(); k.setSheet(false); } return; }
          if (isTyping(document.activeElement)) { if (e.key === 'Escape') document.activeElement.blur(); return; }
          // Only react while focus is inside the panel or on the page body, so the chat composer keeps its keys.
          const a = document.activeElement;
          if (a && a !== document.body && !root.contains(a)) return;
          if (a && a.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // let the focused button act
          const map = {
            ArrowUp: () => k.step(-1), ArrowDown: () => k.step(1), PageUp: () => k.step(-1), PageDown: () => k.step(1),
            ' ': k.togglePlay, k: k.togglePlay, f: k.toggleFs, m: () => k.setMuted(!k.muted), l: () => k.setGuide(!k.guide),
          };
          const fn = map[e.key] || map[e.key.toLowerCase()];
          if (!fn) return;
          e.preventDefault(); k.wake(); fn();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);

      useEffect(() => {
        if (!current || !listRef.current) return;
        const el = listRef.current.querySelector('[data-id="' + current.id + '"]');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }, [current && current.id, guide]);

      const ambient = current && current.logo ? current.logo : null;
      const proxy = data && data.proxy;
      const cls = 'tv-root' + (guide ? ' has-guide' : '') + (chromeHidden ? ' is-idle' : '') + (fs ? ' is-fs' : '');

      const guidePanel = h('aside', { className: 'tv-guide', 'aria-label': t('guide'), 'aria-hidden': !guide },
        h('div', { className: 'tv-guide-head' },
          h('div', { className: 'tv-seg', role: 'tablist' }, [['all', t('tabAll'), data ? (tab === 'all' ? total : null) : null], ['fav', t('tabFav'), data ? data.favoriteCount : null]].map(([id, label, n]) =>
            h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, className: 'tv-seg-btn' + (tab === id ? ' is-on' : ''), onClick: () => { setTab(id); setGroup(''); } },
              label, n !== null && n !== undefined ? h('span', null, n) : null))),
          h('div', { className: 'tv-guide-tools' },
            h(Btn, { icon: 'refresh', size: 16, label: t('reload'), onClick: () => load(true), disabled: busy, className: busy ? 'is-busy' : '' }),
            h(Btn, { icon: 'x', size: 16, label: t('closeGuide'), onClick: () => setGuide(false) }))),
        h('label', { className: 'tv-search' }, h(Icon, { name: 'search', size: 15 }),
          h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') }),
          query ? h('button', { type: 'button', className: 'tv-search-x', 'aria-label': 'Clear', onClick: () => setQuery('') }, h(Icon, { name: 'x', size: 13 })) : null),
        groups.length > 1 || group ? h('div', { className: 'tv-chips', role: 'tablist', 'aria-label': t('allGroups') },
          [{ name: '', count: null }].concat(groups.slice(0, 40)).map((g) => h('button', {
            key: g.name || '*', type: 'button', className: 'tv-chip' + (group === g.name ? ' is-on' : ''), onClick: () => setGroup(g.name),
          }, g.name || t('allGroups'), g.count ? h('span', null, g.count) : null))) : null,
        h('div', { className: 'tv-list-scroll', role: 'list', ref: listRef },
          !data && !error ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => h('div', { key: i, className: 'tv-skel' }))
            : items.length === 0 ? h('div', { className: 'tv-guide-empty' }, h(Icon, { name: tab === 'fav' ? 'star' : 'search', size: 22 }), tab === 'fav' && !debounced && !group ? t('emptyFav') : t('empty'))
              : items.map((c, i) => h(ChannelRow, { key: c.id, c: { ...c, favorite: isFav(c) }, n: i + 1, active: !!current && current.id === c.id, onPlay: (x) => tune(x, i), onFav: toggleFav, t })),
          data && total > items.length ? h('button', { type: 'button', className: 'tv-pill-btn tv-more', disabled: busy, onClick: () => setLimit((n) => n + PAGE) }, t('more', { n: total - items.length })) : null),
        h('div', { className: 'tv-guide-foot' }, t('shortcuts')));

      return h('div', {
        className: cls, ref: rootRef, tabIndex: -1,
        onMouseMove: wake, onPointerDown: wake, onWheel: wake, onMouseLeave: () => setIdle(true),
      },
        h('style', null, CSS),
        h('div', { className: 'tv-ambient', 'aria-hidden': true }, ambient ? h('img', { key: ambient, src: ambient, alt: '', referrerPolicy: 'no-referrer' }) : null),
        h('div', { className: 'tv-stage' + (current ? ' has-channel' : ''), onDoubleClick: current ? toggleFs : undefined, onClick: (e) => { if (e.target === e.currentTarget || e.target === engine.video() || (e.target.classList && e.target.classList.contains('tv-vhost'))) togglePlay(); } },
          h(VideoHost, { rank: 3, className: 'tv-vhost' }),
          !current ? h('div', { className: 'tv-hero' },
            h('div', { className: 'tv-hero-mark' }, h(Icon, { name: 'tv', size: 40, stroke: 1.4 })),
            h('h1', null, t('nothing')),
            h('p', null, t('nothingHint')),
            !guide ? h('button', { type: 'button', className: 'tv-pill-btn is-primary', onClick: () => setGuide(true) }, h(Icon, { name: 'list', size: 15 }), t('openGuide')) : null) : null,
          current && play.state === 'loading' ? h('div', { className: 'tv-center' }, h('span', { className: 'tv-ring' }), h('span', null, t('buffering'))) : null,
          current && play.state === 'error' ? h('div', { className: 'tv-center is-error' },
            h(Icon, { name: 'alert', size: 30 }),
            h('strong', null, current.name),
            h('span', null, t('playerError', { error: play.error })),
            h('div', { className: 'tv-center-actions' },
              h('button', { type: 'button', className: 'tv-pill-btn', onClick: engine.retry }, h(Icon, { name: 'refresh', size: 14 }), t('retry')),
              items.length > 1 ? h('button', { type: 'button', className: 'tv-pill-btn is-primary', onClick: () => step(1) }, t('nextCh'), h(Icon, { name: 'right', size: 14 })) : null)) : null,
          current && play.paused && play.state !== 'error' && play.state !== 'loading' ? h('button', { type: 'button', className: 'tv-bigplay', 'aria-label': t('play'), onClick: togglePlay }, h(PlayGlyph, { paused: true, size: 36 })) : null),
        osd ? h('div', { className: 'tv-osd', key: osd.c.id + ':' + osd.n },
          osd.n ? h('span', { className: 'tv-osd-n' }, String(osd.n).padStart(2, '0')) : null,
          h('span', { className: 'tv-osd-name' }, osd.c.name)) : null,
        h('header', { className: 'tv-top tv-chrome' },
          h('div', { className: 'tv-brand' }, h('span', { className: 'tv-brand-mark' }, h(Icon, { name: 'tv', size: 16, stroke: 2 })), t('title'),
            proxy ? h('span', { className: 'tv-tag' + (proxy.enabled ? ' is-brand' : ''), title: proxy.enabled ? proxy.url : '' }, proxy.enabled ? t('proxyBadge') : t('proxyOff')) : null),
          h('div', { className: 'tv-top-tools' },
            h(Btn, { icon: 'settings', size: 18, label: t('settings'), onClick: () => setSheet(true) }),
            h(Btn, { icon: 'list', size: 18, label: guide ? t('closeGuide') : t('guide'), on: guide, pressed: guide, onClick: () => setGuide(!guide) }))),
        current ? h('footer', { className: 'tv-bottom tv-chrome' },
          h('div', { className: 'tv-now' },
            h(Logo, { c: current, size: 52 }),
            h('div', { className: 'tv-now-text' },
              h('span', { className: 'tv-live' + (play.state === 'playing' ? ' is-on' : '') }, h('i'), play.pip ? t('inPip') : t('live'), currentIndex >= 0 ? h('b', null, 'CH ' + String(currentIndex + 1).padStart(2, '0')) : null),
              h('strong', null, current.name),
              h('span', null, current.group))),
          h('div', { className: 'tv-ctl' },
            h(Btn, { icon: 'up', label: t('prevCh'), onClick: () => step(-1), disabled: !items.length }),
            h('button', { type: 'button', className: 'tv-btn tv-btn-main', title: play.paused ? t('play') : t('pause'), 'aria-label': play.paused ? t('play') : t('pause'), onClick: togglePlay },
              h(PlayGlyph, { paused: play.paused, size: 20 })),
            h(Btn, { icon: 'down', label: t('nextCh'), onClick: () => step(1), disabled: !items.length }),
            h('span', { className: 'tv-sep' }),
            h('div', { className: 'tv-vol' },
              h(Btn, { icon: muted || volume === 0 ? 'mute' : 'volume', label: muted ? t('unmute') : t('mute'), onClick: () => setMuted(!muted) }),
              h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: muted ? 0 : volume, 'aria-label': t('volume'), style: { '--tv-v': (muted ? 0 : volume) * 100 + '%' },
                onChange: (e) => engine.setVolume(Number(e.target.value)) })),
            h(Btn, { icon: 'star', label: currentFav ? t('unfav') : t('fav'), on: currentFav, className: 'tv-fav', onClick: () => toggleFav(current) }),
            h(Btn, { icon: copied ? 'check' : 'copy', label: copied ? t('copied') : t('openRaw'), onClick: copy }),
            h(Btn, { icon: 'pip', label: play.pip ? t('exitPip') : t('pip'), on: play.pip, onClick: pip }),
            h(Btn, { icon: fs ? 'collapse' : 'expand', label: fs ? t('exitFullscreen') : t('fullscreen'), onClick: toggleFs }))) : null,
        error ? h('div', { className: 'tv-toast', role: 'alert' }, h(Icon, { name: 'alert', size: 15 }), h('span', null, error),
          h('button', { type: 'button', onClick: () => load(true) }, t('retry')), h('button', { type: 'button', 'aria-label': 'Close', onClick: () => setError(null) }, h(Icon, { name: 'x', size: 13 }))) : null,
        guidePanel,
        sheet ? h(SettingsSheet, { t, lists, onChange: () => { loadLists(); load(true); }, onClose: () => setSheet(false) }) : null);
    }

    /**
     * Frame-wide mini player in shell.overlay. It always keeps a hidden dock for the <video> (so picture in picture and
     * audio survive any navigation) and shows a draggable card while a channel plays and the TV panel is not open.
     */
    function MiniPlayer() {
      const snap = useEngine();
      const t = engine.t;
      const [pos, setPos] = useState(ui.mini);
      const drag = useRef(null);
      const show = !!snap.channel && !snap.panel && !snap.pip;
      const back = () => {
        const layout = ui.ctx && ui.ctx.get('layout');
        if (layout) { try { layout.selectPanel(PANEL_ID); } catch { /* panel not registered */ } }
      };
      const onDown = (e) => {
        if (e.button !== 0 || (e.target.closest && e.target.closest('button'))) return;
        e.preventDefault();
        drag.current = { x: e.clientX, y: e.clientY, right: pos.right, bottom: pos.bottom, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      };
      const onMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x; const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        const right = Math.min(Math.max(8, d.right - dx), window.innerWidth - 120);
        const bottom = Math.min(Math.max(8, d.bottom - dy), window.innerHeight - 80);
        setPos({ right, bottom });
      };
      const onUp = (e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        ui.mini = pos;
        if (!d.moved && e.target.classList && (e.target.classList.contains('tvm-vhost') || e.target === engine.video())) engine.toggle();
      };
      const c = snap.channel;
      return h(React.Fragment, null,
        h('style', null, MINI_CSS),
        h(VideoHost, { rank: 1, className: 'tvm-dock', hidden: true }),
        show ? h('div', {
          className: 'tvm', role: 'region', 'aria-label': c.name, title: t('miniDrag'),
          style: { right: pos.right + 'px', bottom: pos.bottom + 'px' },
          onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onDoubleClick: back,
        },
          h('div', { className: 'tvm-screen' },
            h(VideoHost, { rank: 2, className: 'tvm-vhost' }),
            snap.state === 'loading' ? h('div', { className: 'tvm-note' }, h('span', { className: 'tvm-ring' })) : null,
            snap.state === 'error' ? h('div', { className: 'tvm-note is-error' }, h(Icon, { name: 'alert', size: 18 }), h('span', null, snap.error)) : null,
            h('div', { className: 'tvm-top' },
              h('button', { type: 'button', className: 'tvm-btn', title: t('backToTv'), 'aria-label': t('backToTv'), onClick: back }, h(Icon, { name: 'expand', size: 15, stroke: 2 })),
              h('button', { type: 'button', className: 'tvm-btn', title: t('closePlayer'), 'aria-label': t('closePlayer'), onClick: engine.stop }, h(Icon, { name: 'x', size: 15, stroke: 2 })))),
          h('div', { className: 'tvm-bar' },
            h('button', { type: 'button', className: 'tvm-play', title: snap.paused ? t('play') : t('pause'), 'aria-label': snap.paused ? t('play') : t('pause'), onClick: engine.toggle }, h(PlayGlyph, { paused: snap.paused, size: 15 })),
            h('div', { className: 'tvm-text' },
              h('span', { className: 'tvm-live' + (snap.state === 'playing' ? ' is-on' : '') }, h('i'), t('live')),
              h('strong', null, c.name)),
            h('button', { type: 'button', className: 'tvm-btn', title: snap.muted ? t('unmute') : t('mute'), 'aria-label': snap.muted ? t('unmute') : t('mute'), onClick: () => engine.setMuted(!snap.muted) }, h(Icon, { name: snap.muted ? 'mute' : 'volume', size: 16 })),
            h('button', { type: 'button', className: 'tvm-btn', title: t('pip'), 'aria-label': t('pip'), onClick: engine.pip }, h(Icon, { name: 'pip', size: 16 })))) : null);
    }

    const MINI_CSS = [
      '.tvm-dock{position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1}',
      '.tvm{position:fixed;z-index:2147483000;width:340px;max-width:calc(100vw - 16px);border-radius:16px;overflow:hidden;pointer-events:auto;cursor:grab;user-select:none;touch-action:none;color:#f4f5f8;font-size:12.5px;background:#07080c;border:1px solid rgba(255,255,255,.1);box-shadow:0 22px 60px -18px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.3);animation:tvm-in .25s cubic-bezier(.2,.7,.2,1) both}',
      '.tvm:active{cursor:grabbing}',
      '@keyframes tvm-in{from{opacity:0;transform:translateY(10px) scale(.97)}}',
      '.tvm *{box-sizing:border-box}',
      '.tvm button{font:inherit;color:inherit}',
      '.tvm-screen{position:relative;aspect-ratio:16/9;background:#000}',
      '.tvm-vhost{position:absolute;inset:0}',
      '.tvm-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:flex-end;gap:4px;padding:8px;background:linear-gradient(rgba(0,0,0,.55),transparent);opacity:0;transition:opacity .2s}',
      '.tvm:hover .tvm-top,.tvm:focus-within .tvm-top{opacity:1}',
      '.tvm-note{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px;text-align:center;background:rgba(0,0,0,.45);pointer-events:none;color:rgba(236,238,245,.75);font-size:11.5px}',
      '.tvm-note.is-error svg{color:#ff6b72}',
      '.tvm-note span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.tvm-ring{width:24px;height:24px;border-radius:50%;border:2.5px solid rgba(255,255,255,.18);border-top-color:#fff;animation:tvm-spin .9s linear infinite}',
      '@keyframes tvm-spin{to{transform:rotate(360deg)}}',
      '.tvm-bar{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 10px;background:rgba(18,20,28,.96)}',
      '.tvm-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.tvm-text strong{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tvm-live{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.08em;color:rgba(236,238,245,.5)}',
      '.tvm-live i{width:6px;height:6px;border-radius:50%;background:rgba(236,238,245,.35)}',
      '.tvm-live.is-on{color:#ff5a5f}',
      '.tvm-live.is-on i{background:#ff3b42}',
      '.tvm-play{flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:50%;background:#fff;color:#0b0c10;cursor:pointer}',
      '.tvm-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#f4f5f8;cursor:pointer;transition:background .15s}',
      '.tvm-btn:hover{background:rgba(255,255,255,.18)}',
      '.tvm-top .tvm-btn{background:rgba(0,0,0,.45)}',
      '.tvm :focus-visible{outline:2px solid #fff;outline-offset:2px}',
      '@media (prefers-reduced-motion:reduce){.tvm,.tvm *{animation:none!important;transition:none!important}}',
    ].join('');

    const BRANDV = 'var(' + BRAND + ')';
    const INK = '#f4f5f8';
    const INK2 = 'rgba(236,238,245,.62)';
    const INK3 = 'rgba(236,238,245,.38)';
    const DARK_GLASS = 'background:rgba(16,18,26,.52);-webkit-backdrop-filter:blur(22px) saturate(150%);backdrop-filter:blur(22px) saturate(150%);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 18px 50px -20px rgba(0,0,0,.7)';
    const GW = '372px';

    const CSS = [
      '.tv-root{container-type:inline-size;position:relative;height:100%;overflow:hidden;background:#05060a;color:' + INK + ';font-size:13px;isolation:isolate;--tv-gw:' + GW + ';--tv-brand:' + BRANDV + '}',
      '.tv-root *,.tv-root *::before,.tv-root *::after{box-sizing:border-box}',
      // :where() keeps the reset at element specificity so every control class can set its own colour.
      ':where(.tv-root) :where(button,input,select){font:inherit}',
      ':where(.tv-root) :where(button){color:' + INK + '}',
      '.tv-root :focus-visible{outline:2px solid var(--tv-brand);outline-offset:2px}',
      '.tv-root:focus{outline:0}',
      /* ambient backdrop: the current channel logo blown up and blurred, over a brand-tinted vignette */
      '.tv-ambient{position:absolute;inset:-12%;z-index:0;pointer-events:none;background:radial-gradient(60% 55% at 30% 40%,color-mix(in srgb,var(--tv-brand) 26%,transparent),transparent 70%),radial-gradient(50% 50% at 85% 90%,color-mix(in srgb,var(' + IDLE + ') 18%,transparent),transparent 70%)}',
      '.tv-ambient img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(90px) saturate(170%);opacity:.38;transform:scale(1.2);animation:tv-fade .9s ease both}',
      '@keyframes tv-fade{from{opacity:0}}',
      /* stage */
      '.tv-stage{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;transition:right .35s cubic-bezier(.2,.7,.2,1)}',
      '@container (min-width:980px){.tv-root.has-guide .tv-stage,.tv-root.has-guide .tv-chrome{right:var(--tv-gw)}}',
      '.tv-stage.has-channel{cursor:pointer}',
      '.tv-root.is-idle .tv-stage{cursor:none}',
      '.tv-vhost{position:absolute;inset:0}',
      '.tv-stage:not(.has-channel) .tv-vhost{display:none}',
      '.tv-hero{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;text-align:center;max-width:460px;animation:tv-rise .6s cubic-bezier(.2,.7,.2,1) both}',
      '@keyframes tv-rise{from{opacity:0;transform:translateY(10px)}}',
      '.tv-hero-mark{display:inline-flex;align-items:center;justify-content:center;width:84px;height:84px;border-radius:26px;color:' + INK + ';' + DARK_GLASS + '}',
      '.tv-hero h1{margin:8px 0 0;font-size:30px;line-height:38px;font-weight:650;letter-spacing:-.02em}',
      '.tv-hero p{margin:0;color:' + INK2 + ';font-size:14px;line-height:22px}',
      '.tv-hero .tv-pill-btn{margin-top:8px}',
      '.tv-center{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 26px;border-radius:20px;max-width:min(520px,86%);text-align:center;color:' + INK2 + ';' + DARK_GLASS + ';pointer-events:auto;cursor:default}',
      '.tv-center strong{color:' + INK + ';font-size:16px}',
      '.tv-center.is-error > svg{color:var(' + ERR + ')}',
      '.tv-center span{word-break:break-word}',
      '.tv-center-actions{display:flex;gap:8px;margin-top:4px}',
      '.tv-ring{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:var(--tv-brand);animation:lp-spin .9s linear infinite}',
      '.tv-bigplay{position:relative;display:inline-flex;align-items:center;justify-content:center;width:84px;height:84px;padding:0;border-radius:50%;cursor:pointer;color:#fff;' + DARK_GLASS + ';transition:transform .18s,background .18s;animation:tv-rise .25s ease both}',
      '.tv-bigplay:hover{transform:scale(1.07);background:rgba(255,255,255,.18)}',
      '.tv-bigplay:active{transform:scale(.96)}',
      /* channel OSD, like a TV set's channel banner */
      '.tv-osd{position:absolute;z-index:4;top:72px;left:28px;display:flex;align-items:baseline;gap:14px;pointer-events:none;text-shadow:0 2px 18px rgba(0,0,0,.6);animation:tv-osd 2.4s ease both}',
      '.tv-osd-n{font-size:56px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.03em;color:' + INK + '}',
      '.tv-osd-name{font-size:18px;font-weight:600;color:' + INK + ';max-width:46cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '@keyframes tv-osd{0%{opacity:0;transform:translateY(-6px)}10%,75%{opacity:1;transform:none}100%{opacity:0}}',
      /* chrome bars */
      '.tv-chrome{position:absolute;left:0;right:0;z-index:3;transition:opacity .4s ease,transform .4s ease,right .35s cubic-bezier(.2,.7,.2,1)}',
      '.tv-root.is-idle .tv-chrome{opacity:0;pointer-events:none}',
      '.tv-root.is-idle .tv-top{transform:translateY(-8px)}',
      '.tv-root.is-idle .tv-bottom{transform:translateY(8px)}',
      '.tv-top{top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px 30px;background:linear-gradient(rgba(0,0,0,.55),transparent)}',
      '.tv-brand{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:650;letter-spacing:.01em}',
      '.tv-brand-mark{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:var(--tv-brand);color:#fff}',
      '.tv-top-tools{display:flex;gap:4px}',
      '.tv-bottom{bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:60px 24px 20px;background:linear-gradient(transparent,rgba(0,0,0,.72) 62%)}',
      '.tv-now{display:flex;align-items:center;gap:14px;min-width:0;flex:1 1 260px}',
      '.tv-now-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.tv-now-text strong{font-size:22px;line-height:28px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tv-now-text > span:last-child{color:' + INK2 + ';font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tv-live{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + INK2 + '}',
      '.tv-live i{width:7px;height:7px;border-radius:50%;background:' + INK3 + '}',
      '.tv-live.is-on{color:#ff5a5f}',
      '.tv-live.is-on i{background:#ff3b42;box-shadow:0 0 0 0 rgba(255,59,66,.6);animation:tv-pulse 1.6s ease-out infinite}',
      '@keyframes tv-pulse{to{box-shadow:0 0 0 7px rgba(255,59,66,0)}}',
      '.tv-live b{margin-left:4px;color:' + INK2 + ';font-weight:600;letter-spacing:.04em}',
      '.tv-ctl{display:flex;align-items:center;gap:2px;padding:5px;border-radius:999px;' + DARK_GLASS + '}',
      '.tv-sep{width:1px;height:20px;margin:0 4px;background:rgba(255,255,255,.14)}',
      '.tv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:38px;height:38px;padding:0 9px;border-radius:999px;border:0;background:transparent;color:' + INK + ';cursor:pointer;transition:background .15s,color .15s,transform .1s}',
      '.tv-btn:hover:not(:disabled){background:rgba(255,255,255,.12)}',
      '.tv-btn:active:not(:disabled){transform:scale(.94)}',
      '.tv-btn:disabled{opacity:.35;cursor:default}',
      '.tv-btn.is-on{color:var(--tv-brand)}',
      '.tv-btn.tv-fav.is-on{color:#ffc53d}',
      '.tv-btn.tv-fav.is-on svg path{fill:currentColor}',
      '.tv-btn.is-danger:hover{color:var(' + ERR + ');background:color-mix(in srgb,var(' + ERR + ') 16%,transparent)}',
      '.tv-btn.is-busy svg{animation:lp-spin 1s linear infinite}',
      '.tv-btn.tv-btn-main{flex:none;width:44px;min-width:44px;height:44px;padding:0;margin:0 2px;border-radius:50%;background:#fff;color:#0b0c10;box-shadow:0 4px 14px -4px rgba(0,0,0,.5)}',
      '.tv-btn.tv-btn-main:hover:not(:disabled){background:#fff;transform:scale(1.05)}',
      '.tv-btn.tv-btn-main:active:not(:disabled){transform:scale(.95)}',
      '.tv-top .tv-btn{' + DARK_GLASS + '}',
      '.tv-top .tv-btn.is-on{background:color-mix(in srgb,var(--tv-brand) 30%,rgba(16,18,26,.6));color:#fff}',
      '.tv-vol{display:flex;align-items:center}',
      '.tv-vol input{-webkit-appearance:none;appearance:none;width:84px;height:4px;margin:0 8px 0 0;border-radius:999px;background:linear-gradient(90deg,#fff var(--tv-v),rgba(255,255,255,.22) var(--tv-v));cursor:pointer}',
      '.tv-vol input::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}',
      '@container (max-width:620px){.tv-vol input,.tv-sep{display:none}.tv-now-text strong{font-size:17px}}',
      /* logo tile */
      '.tv-logo{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;border-radius:28%;background:linear-gradient(140deg,hsl(var(--tv-h) 62% 52%),hsl(calc(var(--tv-h) + 40) 58% 36%));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}',
      '.tv-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:12%;background:rgba(255,255,255,.94)}',
      '.tv-logo-txt{font-weight:750;color:#fff;letter-spacing:-.02em}',
      /* tags and pill buttons */
      '.tv-tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;color:' + INK2 + ';background:rgba(255,255,255,.1);white-space:nowrap}',
      '.tv-tag.is-brand{color:#fff;background:color-mix(in srgb,var(--tv-brand) 60%,transparent)}',
      '.tv-tag.is-error{color:#ff8a8f;background:rgba(255,80,90,.16)}',
      '.tv-pill-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 15px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:' + INK + ';font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,filter .15s}',
      '.tv-pill-btn:hover:not(:disabled){background:rgba(255,255,255,.16)}',
      '.tv-pill-btn.is-primary{border-color:transparent;background:var(--tv-brand);color:#fff}',
      '.tv-pill-btn.is-primary:hover:not(:disabled){background:var(--tv-brand);filter:brightness(1.1)}',
      '.tv-pill-btn:disabled{opacity:.4;cursor:default}',
      /* channel guide: docked on wide panels, floating sheet on narrow ones */
      '.tv-guide{position:absolute;z-index:5;top:0;right:0;bottom:0;width:var(--tv-gw);max-width:100%;display:flex;flex-direction:column;gap:10px;padding:16px 12px 10px 14px;background:rgba(10,11,17,.62);-webkit-backdrop-filter:blur(28px) saturate(150%);backdrop-filter:blur(28px) saturate(150%);border-left:1px solid rgba(255,255,255,.08);transition:transform .35s cubic-bezier(.2,.7,.2,1),opacity .35s}',
      '.tv-root:not(.has-guide) .tv-guide{transform:translateX(102%);opacity:0;pointer-events:none}',
      '@container (max-width:979px){.tv-guide{top:10px;right:10px;bottom:10px;width:min(var(--tv-gw),calc(100% - 20px));border-radius:22px;border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 70px -20px rgba(0,0,0,.8)}}',
      '.tv-root.is-fs.is-idle .tv-guide{opacity:0;pointer-events:none}',
      '.tv-guide-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.tv-guide-tools{display:flex}',
      '.tv-guide-tools .tv-btn{min-width:32px;height:32px;padding:0}',
      '.tv-seg{display:inline-flex;padding:3px;border-radius:999px;background:rgba(255,255,255,.07)}',
      '.tv-seg-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 13px;border:0;border-radius:999px;background:transparent;color:' + INK2 + ';font-size:12.5px;font-weight:600;cursor:pointer}',
      '.tv-seg-btn span{font-size:11px;font-weight:500;color:' + INK3 + ';font-variant-numeric:tabular-nums}',
      '.tv-seg-btn.is-on{background:rgba(255,255,255,.14);color:' + INK + '}',
      '.tv-seg-btn.is-on span{color:' + INK2 + '}',
      '.tv-search{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:12px;background:rgba(255,255,255,.07);border:1px solid transparent;color:' + INK2 + ';transition:border-color .15s,background .15s}',
      '.tv-search:focus-within{border-color:color-mix(in srgb,var(--tv-brand) 70%,transparent);background:rgba(255,255,255,.1)}',
      '.tv-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:' + INK + ';font-size:13px}',
      '.tv-search input::placeholder{color:' + INK3 + '}',
      '.tv-root .tv-search input:focus-visible{outline:0}',
      '.tv-search-x{display:inline-flex;border:0;background:rgba(255,255,255,.14);border-radius:50%;width:18px;height:18px;align-items:center;justify-content:center;padding:0;cursor:pointer;color:' + INK + '}',
      '.tv-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}',
      '.tv-chips::-webkit-scrollbar{display:none}',
      '.tv-chip{flex:none;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:transparent;color:' + INK2 + ';font-size:12px;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}',
      '.tv-chip span{font-size:10.5px;color:' + INK3 + ';font-variant-numeric:tabular-nums}',
      '.tv-chip:hover{background:rgba(255,255,255,.08);color:' + INK + '}',
      '.tv-chip.is-on{background:' + INK + ';border-color:' + INK + ';color:#0b0c10}',
      '.tv-chip.is-on span{color:rgba(11,12,16,.55)}',
      '.tv-list-scroll{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:2px;margin:0 -6px 0 -4px;padding:2px 6px 8px 4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent}',
      '.tv-row{position:relative;display:flex;align-items:center;border-radius:14px;transition:background .15s}',
      '.tv-row:hover{background:rgba(255,255,255,.07)}',
      '.tv-row.is-active{background:color-mix(in srgb,var(--tv-brand) 24%,rgba(255,255,255,.04))}',
      '.tv-row.is-active::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--tv-brand)}',
      '.tv-row-main{flex:1;min-width:0;display:flex;align-items:center;gap:11px;padding:7px 6px 7px 8px;border:0;background:transparent;text-align:left;cursor:pointer;border-radius:14px}',
      '.tv-row-n{flex:none;width:22px;text-align:right;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:' + INK3 + '}',
      '.tv-row-text{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.tv-row-name{font-size:13.5px;line-height:19px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tv-row-group{font-size:11.5px;line-height:15px;color:' + INK2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tv-eq{display:inline-flex;align-items:flex-end;justify-content:flex-end;gap:2px;height:12px;width:100%}',
      '.tv-eq i{width:3px;border-radius:1px;background:var(--tv-brand);animation:tv-eq 1s ease-in-out infinite}',
      '.tv-eq i:nth-child(2){animation-delay:-.35s}.tv-eq i:nth-child(3){animation-delay:-.7s}',
      '@keyframes tv-eq{0%,100%{height:3px}50%{height:12px}}',
      '.tv-star{flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;margin-right:4px;border:0;border-radius:50%;background:transparent;color:' + INK3 + ';cursor:pointer;opacity:0;transition:opacity .15s,color .15s}',
      '.tv-row:hover .tv-star,.tv-star:focus-visible,.tv-star.is-on{opacity:1}',
      '.tv-star:hover{color:' + INK + '}',
      '.tv-star.is-on{color:#ffc53d}',
      '.tv-star.is-on svg path{fill:currentColor}',
      '@media (hover:none){.tv-star{opacity:1}}',
      '.tv-skel{flex:none;height:52px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.1),rgba(255,255,255,.05));background-size:200% 100%;animation:lp-shimmer 1.4s ease-in-out infinite}',
      '.tv-guide-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 12px;color:' + INK2 + ';text-align:center}',
      '.tv-more{align-self:center;margin:8px 0 4px}',
      '.tv-guide-foot{font-size:11px;color:' + INK3 + ';text-align:center;padding-top:2px}',
      /* toast */
      '.tv-toast{position:absolute;z-index:6;left:50%;top:70px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;max-width:min(560px,86%);padding:9px 10px 9px 14px;border-radius:14px;color:#ff9aa0;' + DARK_GLASS + '}',
      '.tv-toast span{color:' + INK + ';font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tv-toast button{flex:none;display:inline-flex;align-items:center;border:0;background:rgba(255,255,255,.1);color:' + INK + ';border-radius:999px;height:24px;padding:0 10px;font-size:12px;cursor:pointer}',
      /* settings sheet */
      '.tv-sheet-wrap{position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45);animation:tv-fade .2s ease both}',
      '.tv-sheet{display:flex;flex-direction:column;width:min(760px,100%);max-height:100%;border-radius:24px;overflow:hidden;background:rgba(20,22,30,.82);-webkit-backdrop-filter:blur(30px) saturate(150%);backdrop-filter:blur(30px) saturate(150%);border:1px solid rgba(255,255,255,.1);box-shadow:0 40px 100px -30px rgba(0,0,0,.85);animation:tv-rise .3s cubic-bezier(.2,.7,.2,1) both}',
      '.tv-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.07)}',
      '.tv-sheet-head h2{margin:0;font-size:17px;font-weight:650}',
      '.tv-sheet-body{overflow:auto;padding:16px 20px 22px;display:flex;flex-direction:column;gap:14px}',
      '.tv-sec{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.06)}',
      '.tv-sec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
      '.tv-sec-head h3{margin:0;font-size:13.5px;font-weight:650}',
      '.tv-sec-head p{margin:3px 0 0;font-size:12px;line-height:18px;color:' + INK2 + '}',
      '.tv-form{display:grid;gap:8px}',
      '.tv-form-3{grid-template-columns:2fr 1fr auto}',
      '.tv-sec:last-child .tv-form-3{grid-template-columns:1fr auto auto}',
      '@container (max-width:620px){.tv-form-3,.tv-sec:last-child .tv-form-3{grid-template-columns:1fr}}',
      '.tv-input{width:100%;height:36px;padding:0 12px;border-radius:11px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.25);color:' + INK + ';font-size:13px;color-scheme:dark}',
      '.tv-input::placeholder{color:' + INK3 + '}',
      '.tv-input:focus{outline:0;border-color:var(--tv-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--tv-brand) 25%,transparent)}',
      '.tv-msg{font-size:12px;color:#6be3a4}',
      '.tv-msg.is-error{color:#ff8a8f}',
      '.tv-lists{display:flex;flex-direction:column;gap:4px}',
      '.tv-list{display:flex;align-items:center;gap:10px;padding:8px 6px 8px 10px;border-radius:12px;background:rgba(255,255,255,.04)}',
      '.tv-list.is-off .tv-list-body{opacity:.45}',
      '.tv-list-body{flex:1;min-width:0}',
      '.tv-list-name{font-size:13px;font-weight:600}',
      '.tv-list-url{font-size:11px;color:' + INK3 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tv-list .tv-btn{min-width:30px;height:30px;padding:0}',
      '.tv-toggle{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;white-space:nowrap;cursor:pointer}',
      '.tv-toggle.is-sub{color:' + INK2 + '}',
      '.tv-switch{flex:none;position:relative;width:34px;height:20px;padding:0;border-radius:999px;border:0;background:rgba(255,255,255,.2);cursor:pointer;transition:background .15s}',
      '.tv-switch i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s;box-shadow:0 1px 3px rgba(0,0,0,.35)}',
      '.tv-switch.is-on{background:var(--tv-brand)}',
      '.tv-switch.is-on i{transform:translateX(14px)}',
      '.tv-switch:disabled{opacity:.4;cursor:default}',
      '@keyframes lp-spin{to{transform:rotate(360deg)}}',
      '@keyframes lp-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}',
      '@media (prefers-reduced-motion:reduce){.tv-root *{transition:none!important;animation:none!important}}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'iptv: dictionaries');
        const t = ctx.locale.bind(NS);
        ui.ctx = ctx;
        engine.setT(t);
        ctx.effect(() => () => { engine.destroy(); ui.ctx = null; }, 'iptv: player');
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'iptv-mini-player', order: 50 }, MiniPlayer));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 29, label: () => t('panel'), locale: NS,
        }, PanelGlyph('tv')));
      },
    };
  },
});
