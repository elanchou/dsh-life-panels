window.__ModuleLoader__.load({
  id: '@local/reading-list',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'reading-list';
    const NS = 'readingList';
    const call = makeCall('/plugin-api/reading-list');

    const zh = {
      dateLocale: 'zh-CN', panel: '阅读', title: '稍后读',
      addPlaceholder: '粘贴文章链接，或输入一段文字', add: '收藏',
      tabAll: '全部', tab_unread: '未读', tab_reading: '在读', tab_done: '已读',
      s_unread: '未读', s_reading: '在读', s_done: '已读',
      statUnread: '未读', statReading: '在读', statDone: '本周读完',
      search: '搜索标题、笔记、标签', allTags: '全部标签',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
      minutes: '约 {n} 分钟', fetching: '正在抓取正文…', fetchFailed: '正文抓取失败', refetch: '重新抓取',
      open: '打开原文', read: '阅读', back: '返回列表', delete: '删除', notes: '笔记', notesPlaceholder: '写下想法、摘录或待办…',
      tags: '标签', tagsPlaceholder: '用逗号分隔，例如：AI, 产品', save: '保存', saved: '已保存',
      progress: '进度 {n}%', markDone: '标为已读', markUnread: '标为未读', startReading: '开始阅读',
      noText: '没有保存正文，可以打开原文阅读。', empty: '书架还是空的，先收藏一篇文章吧',
      emptyFilter: '没有符合条件的条目', loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      hint: '可以在对话里说“帮我总结书架里未读的文章”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Reading', title: 'Read Later',
      addPlaceholder: 'Paste an article link, or type some text', add: 'Save',
      tabAll: 'All', tab_unread: 'Unread', tab_reading: 'Reading', tab_done: 'Read',
      s_unread: 'Unread', s_reading: 'Reading', s_done: 'Read',
      statUnread: 'Unread', statReading: 'Reading', statDone: 'Read this week',
      search: 'Search titles, notes, tags', allTags: 'All tags',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
      minutes: '{n} min read', fetching: 'Fetching article…', fetchFailed: 'Could not fetch article', refetch: 'Fetch again',
      open: 'Open original', read: 'Read', back: 'Back to list', delete: 'Delete', notes: 'Notes', notesPlaceholder: 'Thoughts, quotes, follow-ups…',
      tags: 'Tags', tagsPlaceholder: 'Comma separated, e.g. AI, product', save: 'Save', saved: 'Saved',
      progress: '{n}% read', markDone: 'Mark read', markUnread: 'Mark unread', startReading: 'Start reading',
      noText: 'No article text was saved; open the original to read it.', empty: 'Your shelf is empty. Save an article to start.',
      emptyFilter: 'Nothing matches these filters', loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      hint: 'Ask in chat: “Summarize the unread articles on my shelf”',
    };
    const STATUS_TONE = { unread: 'tone-brand', reading: 'tone-warn', done: 'tone-success' };

    function Cover(props) {
      const { item } = props;
      const letter = (item.source || item.title || '?').trim().charAt(0).toUpperCase();
      const hue = [...(item.source || item.title || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      return h('div', { className: 'rl-cover', style: { '--rl-hue': hue } },
        item.image ? h('img', { src: item.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: (e) => { e.currentTarget.style.display = 'none'; } }) : null,
        h('span', null, letter));
    }

    function Card(props) {
      const { item, t, onOpen, onStatus, onDelete } = props;
      const metaBits = [item.source, item.minutes ? t('minutes', { n: item.minutes }) : null, ago(item.addedAt, t)].filter(Boolean);
      return h('article', { className: 'rl-card is-' + item.status },
        h('button', { type: 'button', className: 'rl-card-main', onClick: () => onOpen(item) },
          h(Cover, { item }),
          h('div', { className: 'rl-card-body' },
            h('div', { className: 'rl-card-meta' }, h('span', { className: 'lp-pill ' + STATUS_TONE[item.status] }, t('s_' + item.status)), h('span', null, metaBits.join(' · '))),
            h('h3', { className: 'rl-card-title' }, item.title),
            item.summary ? h('p', { className: 'rl-card-summary' }, item.summary) : null,
            item.fetching ? h('span', { className: 'rl-card-flag' }, h(Icon, { name: 'refresh', size: 12, className: 'lp-spin' }), t('fetching'))
              : item.fetchError && !item.hasText ? h('span', { className: 'rl-card-flag is-error' }, h(Icon, { name: 'alert', size: 12 }), t('fetchFailed')) : null,
            (item.tags && item.tags.length) || item.notes ? h('div', { className: 'rl-card-tags' },
              (item.tags || []).map((tg) => h('span', { key: tg, className: 'rl-tag' }, '#' + tg)),
              item.notes ? h('span', { className: 'rl-tag is-note' }, h(Icon, { name: 'note', size: 11 }), t('notes')) : null) : null)),
        item.status === 'reading' ? h('div', { className: 'lp-progress rl-card-progress' }, h('i', { style: { width: (item.progress || 0) + '%' } })) : null,
        h('div', { className: 'rl-card-actions' },
          h('button', {
            type: 'button', className: 'lp-round lp-round-sm' + (item.status === 'done' ? ' is-on' : ''),
            title: item.status === 'done' ? t('markUnread') : t('markDone'), 'aria-label': item.status === 'done' ? t('markUnread') : t('markDone'),
            onClick: () => onStatus(item, item.status === 'done' ? 'unread' : 'done'),
          }, h(Icon, { name: 'check', size: 14 })),
          item.url ? h('a', { className: 'lp-round lp-round-sm', href: item.url, target: '_blank', rel: 'noopener noreferrer', title: t('open'), 'aria-label': t('open') }, h(Icon, { name: 'external', size: 14 })) : null,
          h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', title: t('delete'), 'aria-label': t('delete'), onClick: () => onDelete(item) }, h(Icon, { name: 'trash', size: 14 }))));
    }

    function Reader(props) {
      const { id, t, onBack, onChanged } = props;
      const [item, setItem] = useState(null);
      const [error, setError] = useState(null);
      const [notes, setNotes] = useState('');
      const [tags, setTags] = useState('');
      const [dirty, setDirty] = useState(false);
      const [savedAt, setSavedAt] = useState(0);
      const [busy, setBusy] = useState(false);
      const scroller = useRef(null);
      const lastProgress = useRef(0);

      const load = useCallback(async () => {
        try {
          const r = await call({ action: 'get', id });
          setItem(r.item); setNotes(r.item.notes || ''); setTags((r.item.tags || []).join(', ')); setDirty(false); setError(null);
          lastProgress.current = r.item.progress || 0;
        } catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [id, t]);
      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        if (!item || !item.fetching) return undefined;
        const timer = setTimeout(load, 2500);
        return () => clearTimeout(timer);
      }, [item, load]);

      const update = async (body) => {
        setBusy(true);
        try { const r = await call({ action: 'update', id, ...body }); setItem((cur) => ({ ...cur, ...r.item })); onChanged(); return true; }
        catch (e) { setError(t('saveFailed', { error: e.message })); return false; }
        finally { setBusy(false); }
      };
      const saveNotes = async () => {
        if (await update({ notes, tags: tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })) { setDirty(false); setSavedAt(Date.now()); }
      };
      const refetch = async () => {
        setBusy(true);
        try { await call({ action: 'refetch', id }); await load(); onChanged(); }
        catch (e) { setError(t('saveFailed', { error: e.message })); }
        finally { setBusy(false); }
      };

      useEffect(() => {
        const el = scroller.current;
        if (!el || !item || !item.text) return undefined;
        let timer = null;
        const onScroll = () => {
          const max = el.scrollHeight - el.clientHeight;
          if (max <= 0) return;
          const p = Math.min(100, Math.round((el.scrollTop / max) * 100));
          if (p <= lastProgress.current + 4 && p < 100) return;
          lastProgress.current = p;
          clearTimeout(timer);
          timer = setTimeout(() => { if (item.status !== 'done' || p < 100) update({ progress: p }); }, 800);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
      }, [item && item.id, item && !!item.text]);

      if (error && !item) return h(ErrorBar, { error, onRetry: load, retryLabel: t('retry') });
      if (!item) return h('div', { className: 'lp-loading' }, t('fetching'));
      const paras = (item.text || '').split(/\n{2,}/).filter(Boolean);
      return h('div', { className: 'rl-reader' },
        h('div', { className: 'rl-reader-bar' },
          h('button', { type: 'button', className: 'lp-ghost', onClick: onBack }, h(Icon, { name: 'left', size: 14 }), t('back')),
          h('div', { className: 'lp-progress rl-reader-progress' + (item.status === 'done' ? ' tone-success' : '') }, h('i', { style: { width: (item.progress || 0) + '%' } })),
          h('span', { className: 'rl-reader-pct' }, t('progress', { n: item.progress || 0 })),
          item.url ? h('a', { className: 'lp-ghost', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, h(Icon, { name: 'external', size: 14 }), t('open')) : null,
          h('button', { type: 'button', className: 'lp-primary', disabled: busy, onClick: () => update({ status: item.status === 'done' ? 'unread' : 'done' }) },
            h(Icon, { name: 'check', size: 14 }), item.status === 'done' ? t('markUnread') : t('markDone'))),
        h(ErrorBar, { error, onClose: () => setError(null) }),
        h('div', { className: 'rl-reader-cols' },
          h('article', { className: 'lp-card rl-article', ref: scroller },
            h('div', { className: 'rl-article-meta' }, [item.source, item.minutes ? t('minutes', { n: item.minutes }) : null].filter(Boolean).join(' · ')),
            h('h1', { className: 'rl-article-title' }, item.title),
            item.fetching ? h('div', { className: 'lp-muted' }, t('fetching'))
              : paras.length ? paras.map((p, i) => p.startsWith('## ') ? h('h2', { key: i }, p.slice(3)) : h('p', { key: i, className: p.startsWith('• ') ? 'is-li' : '' }, p))
                : h('div', { className: 'rl-article-empty' },
                  h('p', null, item.fetchError ? t('fetchFailed') + '：' + item.fetchError : t('noText')),
                  item.url ? h('button', { type: 'button', className: 'lp-ghost', onClick: refetch, disabled: busy }, h(Icon, { name: 'refresh', size: 14 }), t('refetch')) : null)),
          h('aside', { className: 'lp-card rl-notes' },
            h('h2', { className: 'lp-card-title' }, h(Icon, { name: 'note', className: 'lp-ico' }), t('notes')),
            h('textarea', { className: 'lp-textarea rl-notes-text', value: notes, placeholder: t('notesPlaceholder'), onChange: (e) => { setNotes(e.target.value); setDirty(true); } }),
            h('label', { className: 'rl-label' }, t('tags')),
            h('input', { className: 'lp-input', value: tags, placeholder: t('tagsPlaceholder'), onChange: (e) => { setTags(e.target.value); setDirty(true); } }),
            h('div', { className: 'rl-notes-foot' },
              savedAt && !dirty ? h('span', { className: 'lp-pill tone-success' }, h(Icon, { name: 'check', size: 11 }), t('saved')) : h('span'),
              h('button', { type: 'button', className: 'lp-primary', disabled: !dirty || busy, onClick: saveNotes }, t('save'))))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [tab, setTab] = useState('all');
      const [query, setQuery] = useState('');
      const [tag, setTag] = useState('');
      const [input, setInput] = useState('');
      const [busy, setBusy] = useState(false);
      const [openId, setOpenId] = useState(null);
      const alive = useRef(true);

      const load = useCallback(async () => {
        try {
          const r = await call({ action: 'list' });
          if (alive.current) { setData(r); setError(null); }
        } catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => {
        alive.current = true;
        load();
        const id = setInterval(load, 30000);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);
      const pending = data && data.items.some((i) => i.fetching);
      useEffect(() => {
        if (!pending) return undefined;
        const id = setTimeout(load, 2500);
        return () => clearTimeout(id);
      }, [pending, data, load]);

      const act = async (body) => {
        setBusy(true);
        try { const r = await call(body); await load(); return r; }
        catch (e) { setError(t('saveFailed', { error: e.message })); return null; }
        finally { if (alive.current) setBusy(false); }
      };
      const onAdd = async (e) => {
        e.preventDefault();
        const v = input.trim();
        if (!v || busy) return;
        const isUrl = /^https?:\/\/\S+$/i.test(v);
        const r = await act(isUrl ? { action: 'add', url: v } : { action: 'add', text: v });
        if (r) setInput('');
      };
      const onStatus = (item, status) => act({ action: 'update', id: item.id, status });
      const onDelete = (item) => act({ action: 'delete', id: item.id });

      const items = (data && data.items) || [];
      const counts = (data && data.counts) || { unread: 0, reading: 0, done: 0 };
      const weekAgo = Date.now() - 7 * 86400000;
      const doneWeek = items.filter((i) => i.finishedAt && Date.parse(i.finishedAt) > weekAgo).length;
      const allTags = [...new Set(items.flatMap((i) => i.tags || []))].sort();
      const q = query.trim().toLowerCase();
      const visible = items.filter((i) => (tab === 'all' || i.status === tab)
        && (!tag || (i.tags || []).includes(tag))
        && (!q || [i.title, i.summary, i.notes, i.source, (i.tags || []).join(' ')].join(' ').toLowerCase().includes(q)));
      const nowLong = new Date().toLocaleDateString(safeLocale(t), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      let body;
      if (openId) {
        body = h(Reader, { key: openId, id: openId, t, onBack: () => { setOpenId(null); load(); }, onChanged: load });
      } else {
        body = h(React.Fragment, null,
          h('form', { className: 'lp-bar rl-add', onSubmit: onAdd },
            h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'bookmark', size: 18 })),
            h('input', { className: 'lp-bar-input', value: input, onChange: (e) => setInput(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder') }),
            h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !input.trim() }, h(Icon, { name: 'plus', size: 14 }), t('add'))),
          h('div', { className: 'rl-toolbar' },
            h(Tabs, {
              value: tab, onChange: setTab, items: [
                { id: 'all', label: t('tabAll'), count: items.length },
                { id: 'unread', label: t('tab_unread'), count: counts.unread },
                { id: 'reading', label: t('tab_reading'), count: counts.reading },
                { id: 'done', label: t('tab_done'), count: counts.done },
              ],
            }),
            h('div', { className: 'rl-tools' },
              h('label', { className: 'lp-field rl-search' }, h(Icon, { name: 'search', size: 14 }),
                h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })),
              allTags.length ? h('label', { className: 'lp-field' }, h(Icon, { name: 'tag', size: 14 }),
                h('select', { value: tag, onChange: (e) => setTag(e.target.value), 'aria-label': t('allTags') },
                  h('option', { value: '' }, t('allTags')), allTags.map((tg) => h('option', { key: tg, value: tg }, tg)))) : null)),
          !data && !error ? h('div', { className: 'rl-grid' }, [0, 1, 2, 3].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 120, borderRadius: 16 } })))
            : !items.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'book', text: t('empty') }))
              : !visible.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'search', text: t('emptyFilter') }))
                : h('div', { className: 'rl-grid' }, visible.map((item) => h(Card, { key: item.id, item, t, onOpen: (it) => setOpenId(it.id), onStatus, onDelete }))),
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint')));
      }

      return h('div', { className: 'lp-root' },
        h('style', null, KIT_CSS + CSS),
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, nowLong), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'bookmark', value: counts.unread, label: t('statUnread'), tone: 'tone-brand' }),
              h(Stat, { icon: 'book', value: counts.reading, label: t('statReading'), tone: 'tone-warn' }),
              h(Stat, { icon: 'check', value: doneWeek, label: t('statDone'), tone: 'tone-success' }))),
          openId ? null : h(ErrorBar, { error, onRetry: load, retryLabel: t('retry') }),
          body));
    }

    const CSS = [
      '.rl-add{margin-bottom:16px}',
      '.rl-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px}',
      '.rl-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.rl-search input{width:190px}',
      '.rl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}',
      '.rl-card{position:relative;display:flex;flex-direction:column;border-radius:16px;' + GLASS + ';overflow:hidden;transition:border-color .15s,box-shadow .15s,transform .15s}',
      '.rl-card:hover{' + GLASS_HOVER + ';transform:translateY(-1px)}',
      '.rl-card.is-done{opacity:.72}',
      '.rl-card.is-done:hover{opacity:1}',
      '.rl-card-main{display:flex;gap:14px;padding:14px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;width:100%}',
      '.rl-cover{position:relative;flex:none;width:64px;height:84px;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,hsl(var(--rl-hue) 70% 62%),hsl(calc(var(--rl-hue) + 40) 65% 45%));box-shadow:inset -4px 0 0 rgba(0,0,0,.12)}',
      '.rl-cover span{font-size:26px;font-weight:700;color:rgba(255,255,255,.92)}',
      '.rl-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.rl-card-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding-right:76px}',
      '.rl-card-meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:' + FG2 + ';white-space:nowrap;overflow:hidden}',
      '.rl-card-meta > span:last-child{overflow:hidden;text-overflow:ellipsis}',
      '.rl-card-title{margin:0;font-size:14px;line-height:21px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.rl-card-summary{margin:0;font-size:12.5px;line-height:19px;color:' + FG2 + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.rl-card-flag{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:' + FG2 + '}',
      '.rl-card-flag.is-error{color:var(' + WARN + ')}',
      '.rl-card-tags{display:flex;flex-wrap:wrap;gap:4px}',
      '.rl-tag{display:inline-flex;align-items:center;gap:3px;font-size:11px;line-height:18px;padding:0 7px;border-radius:6px;' + GLASS_SOFT + ';color:' + FG2 + '}',
      '.rl-tag.is-note{color:var(' + BRAND + ')}',
      '.rl-card-progress{height:3px;border-radius:0}',
      '.rl-card-actions{position:absolute;top:10px;right:10px;display:flex;gap:2px;opacity:0;transition:opacity .12s}',
      '.rl-card:hover .rl-card-actions,.rl-card-actions:focus-within{opacity:1}',
      '@media (hover:none){.rl-card-actions{opacity:1}}',
      '.rl-card-actions .lp-round{background:var(--lp-glass-strong);border:1px solid var(--lp-glass-edge);text-decoration:none}',
      '.rl-reader-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
      '.rl-reader-bar a{text-decoration:none}',
      '.rl-reader-progress{flex:1;min-width:120px}',
      '.rl-reader-pct{font-size:12px;color:' + FG2 + ';font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.rl-reader-cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}',
      '@media (max-width:900px){.rl-reader-cols{grid-template-columns:1fr}}',
      '.rl-article{max-height:calc(100vh - 230px);min-height:320px;overflow:auto;padding:28px 36px}',
      '@media (max-width:900px){.rl-article{max-height:none;padding:20px}}',
      '.rl-article-meta{font-size:12px;color:var(' + BRAND + ');font-weight:500}',
      '.rl-article-title{margin:6px 0 18px;font-size:22px;line-height:32px;font-weight:700}',
      '.rl-article p{margin:0 0 14px;font-size:15px;line-height:27px;max-width:72ch}',
      '.rl-article p.is-li{padding-left:6px}',
      '.rl-article h2{margin:22px 0 10px;font-size:16.5px;line-height:24px;font-weight:650}',
      '.rl-article-empty{display:flex;flex-direction:column;align-items:flex-start;gap:10px;color:' + FG2 + '}',
      '.rl-notes{position:sticky;top:0;display:flex;flex-direction:column;gap:8px}',
      '.rl-notes-text{min-height:200px}',
      '.rl-label{font-size:12px;font-weight:600;color:' + FG2 + ';margin-top:4px}',
      '.rl-notes-foot{display:flex;align-items:center;justify-content:space-between;margin-top:4px}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'reading-list: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 22, label: () => t('panel'), locale: NS,
        }, PanelGlyph('book')));
      },
    };
  },
});
