window.__ModuleLoader__.load({
  id: '@local/vocabulary',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'vocabulary';
    const NS = 'vocabulary';
    const call = makeCall('/plugin-api/vocabulary');

    const zh = {
      dateLocale: 'zh-CN', panel: '单词', title: '背单词',
      statDue: '待复习', statNew: '今日新词', statStreak: '连续天数', statMastered: '已掌握',
      tabStudy: '学习', tabWords: '单词本', tabSettings: '设置',
      reveal: '显示释义', speak: '朗读', star: '收藏', unstar: '取消收藏',
      g_again: '忘了', g_hard: '模糊', g_good: '记得', g_easy: '简单',
      iv0: '今天', ivDays: '{n} 天', ivMonths: '{n} 个月',
      left: '还剩 {n} 个', newTag: '新词', reviewTag: '复习', againTag: '再来一次',
      doneTitle: '今天的任务完成了', doneBody: '新学 {n} 个，复习 {r} 个。', more: '再学 10 个新词',
      emptyStudy: '没有待复习的单词，今天的新词也学完了',
      f_all: '全部', f_due: '待复习', f_learning: '学习中', f_mastered: '已掌握', f_starred: '收藏', f_hard: '难词', f_new: '待学',
      search: '搜索单词或释义', addPlaceholder: '添加生词，例如 serendipity；多个用逗号分隔', add: '添加',
      added: '已添加 {n} 个', needMeaning: '词库里没有：{words}。可以在对话里让我补上释义。',
      nextDue: '{d} 复习', mastered: '已掌握', notStudied: '未学', reset: '重新学', delete: '删除',
      bookLabel: '新词来源', dailyLabel: '每天新词', learned: '已学 {n} / {t}', history: '最近 30 天',
      historyTip: '{d}：新学 {n}，复习 {r}', shortcuts: '快捷键：空格 显示释义，1–4 评分，S 朗读',
      loadFailed: '加载失败：{error}', saveFailed: '操作失败：{error}', retry: '重试',
      hint: '可以在对话里说“把这篇文章里的生词加进单词本”或“用我的难词出几道题”',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Words', title: 'Vocabulary',
      statDue: 'Due', statNew: 'New today', statStreak: 'Day streak', statMastered: 'Mastered',
      tabStudy: 'Study', tabWords: 'Word list', tabSettings: 'Settings',
      reveal: 'Show meaning', speak: 'Speak', star: 'Star', unstar: 'Unstar',
      g_again: 'Again', g_hard: 'Hard', g_good: 'Good', g_easy: 'Easy',
      iv0: 'today', ivDays: '{n}d', ivMonths: '{n}mo',
      left: '{n} left', newTag: 'New', reviewTag: 'Review', againTag: 'Again',
      doneTitle: 'Done for today', doneBody: '{n} new, {r} reviewed.', more: 'Learn 10 more',
      emptyStudy: 'Nothing is due and today\'s new words are done',
      f_all: 'All', f_due: 'Due', f_learning: 'Learning', f_mastered: 'Mastered', f_starred: 'Starred', f_hard: 'Hard', f_new: 'To learn',
      search: 'Search words or meanings', addPlaceholder: 'Add words, e.g. serendipity; separate with commas', add: 'Add',
      added: 'Added {n}', needMeaning: 'Not in the word books: {words}. Ask in chat to fill in a meaning.',
      nextDue: 'due {d}', mastered: 'Mastered', notStudied: 'Not studied', reset: 'Relearn', delete: 'Delete',
      bookLabel: 'New words from', dailyLabel: 'New words per day', learned: '{n} / {t} learned', history: 'Last 30 days',
      historyTip: '{d}: {n} new, {r} reviewed', shortcuts: 'Keys: Space shows the meaning, 1–4 grade, S speaks',
      loadFailed: 'Failed to load: {error}', saveFailed: 'Action failed: {error}', retry: 'Retry',
      hint: 'Ask in chat: “Add the new words from this article” or “Quiz me on my hard words”',
    };

    Object.assign(ICONS, {
      volume: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
      star: ['M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z'],
      flame: ['M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5C13 9 11.5 10 10.5 8 9 10 6 12 6 15a6 6 0 0 0 6 6z'],
      layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5'],
      eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5'],
    });
    const WordIcon = PanelGlyph('book');
    const GRADES = ['again', 'hard', 'good', 'easy'];

    function ivLabel(n, t) {
      if (!n) return t('iv0');
      if (n >= 60) return t('ivMonths', { n: Math.round(n / 30) });
      return t('ivDays', { n });
    }
    function speak(word) {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.lang = 'en-US'; u.rate = 0.9;
        const v = synth.getVoices().find((x) => /^en(-|_)US/i.test(x.lang)) || synth.getVoices().find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v;
        synth.speak(u);
      } catch { /* speech is optional */ }
    }
    function Meaning(props) {
      return h('div', { className: 'vb-meaning' }, String(props.text || '').split('\n').map((line, i) => {
        const m = /^([a-z]+\.)\s*(.*)$/i.exec(line);
        return h('p', { key: i }, m ? [h('b', { key: 'p' }, m[1]), ' ', m[2]] : line);
      }));
    }

    /* ---- Study: a local queue; "again" puts the card back a few places later. ---- */
    function Study(props) {
      const { t, onStats, onError } = props;
      const [session, setSession] = useState(null);
      const [queue, setQueue] = useState([]);
      const [shown, setShown] = useState(false);
      const [busy, setBusy] = useState(false);
      const [doneCount, setDoneCount] = useState({ n: 0, r: 0 });
      const load = useCallback(async (extraNew) => {
        try {
          const r = await call(extraNew ? { action: 'session', extraNew } : { action: 'session' });
          setSession(r); setQueue(r.cards); setShown(false);
          setDoneCount({ n: r.todayNew, r: r.todayReview });
        } catch (e) { onError(t('loadFailed', { error: e.message })); }
      }, [t, onError]);
      useEffect(() => { load(); }, [load]);
      const card = queue[0];

      const grade = useCallback(async (g) => {
        if (!card || busy) return;
        setBusy(true);
        try {
          const r = await call({ action: 'grade', id: card.id, grade: g });
          setDoneCount({ n: r.todayNew, r: r.todayReview });
          setQueue((q) => {
            const rest = q.slice(1);
            if (g === 'again') rest.splice(Math.min(rest.length, 4), 0, { ...r.card, again: true });
            return rest;
          });
          setShown(false);
          onStats();
        } catch (e) { onError(t('saveFailed', { error: e.message })); }
        finally { setBusy(false); }
      }, [card, busy, t, onStats, onError]);
      const toggleStar = async () => {
        if (!card) return;
        try {
          await call({ action: card.state === 'new' && !card.addedAt ? 'add' : 'star', id: card.id, word: card.word, starred: !card.starred });
          setQueue((q) => [{ ...q[0], starred: !q[0].starred, addedAt: q[0].addedAt || new Date().toISOString() }, ...q.slice(1)]);
          onStats();
        } catch (e) { onError(t('saveFailed', { error: e.message })); }
      };

      useEffect(() => {
        const onKey = (e) => {
          if (!card || e.metaKey || e.ctrlKey || e.altKey) return;
          const tag = (e.target && e.target.tagName) || '';
          if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!shown) setShown(true); else grade('good'); }
          else if (shown && e.key >= '1' && e.key <= '4') { e.preventDefault(); grade(GRADES[Number(e.key) - 1]); }
          else if (e.key === 's' || e.key === 'S') speak(card.word);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [card, shown, grade]);
      useEffect(() => { if (card && card.state === 'new' && !card.again) speak(card.word); }, [card && card.id]);

      if (!session) return h('div', { className: 'lp-card vb-stage' }, h('div', { className: 'lp-skel', style: { height: 220 } }));
      if (!card) {
        const any = doneCount.n + doneCount.r > 0;
        return h('div', { className: 'lp-card vb-stage vb-done' },
          h(Empty, { icon: any ? 'check' : 'sparkle', text: any ? t('doneTitle') : t('emptyStudy') },
            any ? h('span', { className: 'lp-muted' }, t('doneBody', { n: doneCount.n, r: doneCount.r })) : null,
            h('button', { type: 'button', className: 'lp-ghost', onClick: () => load(10) }, h(Icon, { name: 'plus', size: 14 }), t('more'))));
      }
      const tag = card.again ? t('againTag') : card.state === 'new' ? t('newTag') : t('reviewTag');
      return h('div', { className: 'lp-card vb-stage' },
        h('div', { className: 'vb-stage-top' },
          h('span', { className: 'lp-pill ' + (card.again ? 'tone-error' : card.state === 'new' ? 'tone-brand' : 'tone-success') }, tag),
          h('span', { className: 'lp-muted' }, t('left', { n: queue.length })),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', className: 'lp-round' + (card.starred ? ' is-on' : ''), onClick: toggleStar, title: card.starred ? t('unstar') : t('star'), 'aria-label': card.starred ? t('unstar') : t('star') }, h(Icon, { name: 'star', size: 16 }))),
        h('div', { className: 'vb-word-wrap' },
          h('h2', { className: 'vb-word' }, card.word),
          h('button', { type: 'button', className: 'vb-phon', onClick: () => speak(card.word), title: t('speak') },
            card.phonetic ? '/' + card.phonetic + '/' : null, h(Icon, { name: 'volume', size: 16 }))),
        shown
          ? h('div', { className: 'vb-answer' }, h(Meaning, { text: card.meaning }), card.note ? h('p', { className: 'vb-note' }, card.note) : null)
          : h('button', { type: 'button', className: 'vb-reveal', onClick: () => setShown(true) }, h(Icon, { name: 'eye', size: 16 }), t('reveal'), h('kbd', null, 'Space')),
        shown ? h('div', { className: 'vb-grades' }, GRADES.map((g, i) => h('button', {
          key: g, type: 'button', className: 'vb-grade is-' + g, disabled: busy, onClick: () => grade(g),
        }, h('span', { className: 'vb-grade-label' }, t('g_' + g)), h('span', { className: 'vb-grade-iv' }, ivLabel(card.next && card.next[g], t)), h('kbd', null, i + 1)))) : null,
        h('p', { className: 'vb-keys' }, t('shortcuts')));
    }

    function WordList(props) {
      const { t, onStats, onError } = props;
      const [filter, setFilter] = useState('all');
      const [query, setQuery] = useState('');
      const [data, setData] = useState(null);
      const [input, setInput] = useState('');
      const [notice, setNotice] = useState(null);
      const [busy, setBusy] = useState(false);
      const load = useCallback(async () => {
        try { setData(await call({ action: 'list', filter, query: query.trim() || undefined, limit: 300 })); }
        catch (e) { onError(t('loadFailed', { error: e.message })); }
      }, [filter, query, t, onError]);
      useEffect(() => { const id = setTimeout(load, query ? 200 : 0); return () => clearTimeout(id); }, [load, query]);
      const act = async (body) => {
        try { await call(body); await load(); onStats(); } catch (e) { onError(t('saveFailed', { error: e.message })); }
      };
      const onAdd = async (e) => {
        e.preventDefault();
        const words = input.split(/[,，;；\n]+/).map((w) => w.trim()).filter(Boolean);
        if (!words.length || busy) return;
        setBusy(true);
        try {
          const r = await call({ action: 'add', words });
          setInput('');
          setNotice((r.added.length ? t('added', { n: r.added.length }) : '') + (r.needMeaning ? ' ' + t('needMeaning', { words: r.needMeaning.join(', ') }) : ''));
          await load(); onStats();
        } catch (err) { onError(t('saveFailed', { error: err.message })); }
        finally { setBusy(false); }
      };
      const lang = safeLocale(t);
      return h(React.Fragment, null,
        h('form', { className: 'lp-bar vb-add', onSubmit: onAdd },
          h('span', { className: 'lp-bar-icon' }, h(Icon, { name: 'plus', size: 18 })),
          h('input', { className: 'lp-bar-input', value: input, onChange: (e) => setInput(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder') }),
          h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !input.trim() }, t('add'))),
        notice ? h('p', { className: 'vb-notice' }, notice) : null,
        h('div', { className: 'vb-toolbar' },
          h(Tabs, { value: filter, onChange: setFilter, items: ['all', 'due', 'learning', 'mastered', 'starred', 'hard', 'new'].map((id) => ({ id, label: t('f_' + id) })) }),
          h('label', { className: 'lp-field vb-search' }, h(Icon, { name: 'search', size: 14 }),
            h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') }))),
        !data ? h('div', { className: 'lp-card' }, h('div', { className: 'lp-skel', style: { height: 120 } }))
          : !data.cards.length ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'book', text: t('f_' + filter) + ' · 0' }))
            : h('ul', { className: 'lp-card vb-list' }, data.cards.map((c) => h('li', { key: c.id, className: 'vb-row' },
              h('button', { type: 'button', className: 'lp-round lp-round-sm', onClick: () => speak(c.word), 'aria-label': t('speak') }, h(Icon, { name: 'volume', size: 14 })),
              h('div', { className: 'vb-row-main' },
                h('div', { className: 'vb-row-head' }, h('b', null, c.word), c.phonetic ? h('span', { className: 'lp-muted' }, '/' + c.phonetic + '/') : null),
                h('div', { className: 'vb-row-mean' }, String(c.meaning || '').split('\n').join('  '))),
              h('span', { className: 'lp-pill ' + (c.mastered ? 'tone-success' : c.isDue ? 'tone-warn' : c.state === 'new' ? '' : 'tone-brand') },
                c.mastered ? t('mastered') : c.state === 'new' ? t('notStudied') : t('nextDue', { d: c.due ? fmtDate(c.due, lang, { month: 'short', day: 'numeric' }) : '' })),
              h('div', { className: 'vb-row-actions' },
                h('button', { type: 'button', className: 'lp-round lp-round-sm' + (c.starred ? ' is-on' : ''), onClick: () => act({ action: 'star', id: c.id }), 'aria-label': c.starred ? t('unstar') : t('star'), title: c.starred ? t('unstar') : t('star') }, h(Icon, { name: 'star', size: 14 })),
                c.state !== 'new' ? h('button', { type: 'button', className: 'lp-round lp-round-sm', onClick: () => act({ action: 'reset', id: c.id }), 'aria-label': t('reset'), title: t('reset') }, h(Icon, { name: 'refresh', size: 14 })) : null,
                h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', onClick: () => act({ action: 'delete', id: c.id }), 'aria-label': t('delete'), title: t('delete') }, h(Icon, { name: 'trash', size: 14 })))))));
    }

    function Settings(props) {
      const { t, status, onSaved, onError } = props;
      const save = async (patch) => {
        try { onSaved(await call({ action: 'settings', ...patch })); } catch (e) { onError(t('saveFailed', { error: e.message })); }
      };
      const lang = safeLocale(t);
      const max = Math.max(1, ...status.history.map((d) => d.newCount + d.reviewCount));
      return h('div', { className: 'vb-settings' },
        h('section', { className: 'lp-card' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'layers', className: 'lp-ico' }), t('bookLabel')),
          h('div', { className: 'vb-books' }, status.books.map((b) => h('button', {
            key: b.id, type: 'button', className: 'vb-book' + (status.settings.book === b.id ? ' is-active' : ''), onClick: () => save({ book: b.id }),
          }, h('b', null, b.name), h('span', { className: 'lp-muted' }, t('learned', { n: b.learned, t: b.total })),
          h('div', { className: 'lp-progress' }, h('i', { style: { width: Math.min(100, (b.learned / b.total) * 100) + '%' } }))))),
          h('label', { className: 'vb-daily' }, h('span', null, t('dailyLabel')),
            h('select', { className: 'lp-select', value: status.settings.dailyNew, onChange: (e) => save({ dailyNew: Number(e.target.value) }) },
              [0, 5, 10, 15, 20, 30, 40, 50, 80, 100].map((n) => h('option', { key: n, value: n }, n))))),
        h('section', { className: 'lp-card' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: 'calendar', className: 'lp-ico' }), t('history')),
          h('div', { className: 'vb-chart' }, status.history.map((d) => {
            const total = d.newCount + d.reviewCount;
            return h('div', { key: d.date, className: 'vb-bar', title: t('historyTip', { d: fmtDate(d.date, lang, { month: 'short', day: 'numeric' }), n: d.newCount, r: d.reviewCount }) },
              h('i', { className: 'is-review', style: { height: (d.reviewCount / max) * 100 + '%' } }),
              h('i', { className: 'is-new', style: { height: (d.newCount / max) * 100 + '%' } }),
              total ? null : h('i', { className: 'is-zero' }));
          }))));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [tab, setTab] = useState('study');
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const refresh = useCallback(async () => {
        try { setStatus(await call({ action: 'status' })); setError(null); }
        catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      useEffect(() => { refresh(); }, [refresh]);
      const s = status || { due: 0, todayNew: 0, streak: 0, mastered: 0, settings: { dailyNew: 0 } };
      const book = status && status.books.find((b) => b.id === status.settings.book);
      return h('div', { className: 'lp-root vb-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, book ? book.name : ''), h('h1', { className: 'lp-title' }, t('title'))),
            h('div', { className: 'lp-stats' },
              h(Stat, { icon: 'refresh', value: s.due, label: t('statDue'), tone: s.due ? 'tone-warn' : undefined }),
              h(Stat, { icon: 'plus', value: s.todayNew + ' / ' + s.settings.dailyNew, label: t('statNew'), tone: 'tone-brand' }),
              h(Stat, { icon: 'flame', value: s.streak, label: t('statStreak'), tone: s.streak ? 'tone-error' : undefined }),
              h(Stat, { icon: 'check', value: s.mastered, label: t('statMastered'), tone: 'tone-success' }))),
          h(ErrorBar, { error, onRetry: refresh, retryLabel: t('retry'), onClose: () => setError(null) }),
          h('div', { className: 'vb-tabs' }, h(Tabs, { value: tab, onChange: setTab, items: [
            { id: 'study', label: t('tabStudy') }, { id: 'words', label: t('tabWords') }, { id: 'settings', label: t('tabSettings') }] })),
          tab === 'study' ? h(Study, { t, onStats: refresh, onError: setError })
            : tab === 'words' ? h(WordList, { t, onStats: refresh, onError: setError })
              : status ? h(Settings, { t, status, onSaved: setStatus, onError: setError }) : null,
          h('p', { className: 'lp-hint' }, h(Icon, { name: 'sparkle', size: 14 }), t('hint'))),
        h('style', null, KIT_CSS + CSS));
    }

    const GRADE_TONE = { again: ERR, hard: WARN, good: BRAND, easy: OK };
    const CSS = [
      '.vb-root{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + OK + ')}',
      '.vb-tabs{margin-bottom:14px}',
      '.vb-stage{max-width:720px;margin:0 auto;padding:22px 26px 18px;display:flex;flex-direction:column;align-items:center;gap:16px;min-height:340px}',
      '.vb-stage-top{align-self:stretch;display:flex;align-items:center;gap:10px;font-size:12px}',
      '.vb-word-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px}',
      '.vb-word{margin:0;font-size:44px;line-height:54px;font-weight:700;letter-spacing:-.01em;text-align:center;word-break:break-word}',
      '.vb-phon{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:' + FG2 + ';font-size:15px;cursor:pointer;padding:4px 10px;border-radius:999px}',
      '.vb-phon:hover{' + GLASS_SOFT + ';color:var(' + BRAND + ')}',
      '.vb-reveal{display:inline-flex;align-items:center;gap:8px;margin-top:22px;height:44px;padding:0 22px;border-radius:14px;border:1px dashed var(--lp-glass-edge);' + GLASS_SOFT + ';color:' + FG2 + ';font-size:14px;cursor:pointer}',
      '.vb-reveal:hover{color:' + FG + ';border-style:solid}',
      '.vb-root kbd{font:inherit;font-size:10.5px;line-height:16px;padding:0 5px;border-radius:5px;border:1px solid var(--lp-glass-edge);color:' + FG2 + ';background:var(--lp-glass-strong)}',
      '.vb-answer{align-self:stretch;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 18px;border-radius:14px;' + GLASS_SOFT + '}',
      '.vb-meaning p{margin:2px 0;font-size:15px;line-height:24px;text-align:center}',
      '.vb-meaning b{color:var(' + BRAND + ');font-weight:600;margin-right:2px}',
      '.vb-note{margin:4px 0 0;color:' + FG2 + ';font-style:italic;text-align:center}',
      '.vb-grades{align-self:stretch;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
      '.vb-grade{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:12px;border:1px solid var(--g-tone-edge);background:var(--g-tone-bg);color:var(--g-tone);cursor:pointer;transition:filter .12s,transform .12s}',
      '.vb-grade:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}',
      '.vb-grade:disabled{opacity:.5;cursor:default}',
      '.vb-grade kbd{position:absolute;top:6px;right:6px}',
      '.vb-grade-label{font-weight:650;font-size:14px}',
      '.vb-grade-iv{font-size:11.5px;opacity:.8}',
      ...GRADES.map((g) => '.vb-grade.is-' + g + '{--g-tone:var(' + GRADE_TONE[g] + ');--g-tone-bg:' + tint(GRADE_TONE[g], 12) + ';--g-tone-edge:' + tint(GRADE_TONE[g], 28) + '}'),
      '.vb-keys{margin:auto 0 0;font-size:11.5px;color:' + FG2 + '}',
      '.vb-done{justify-content:center}',
      '.vb-add{margin-bottom:10px}',
      '.vb-notice{margin:0 0 10px;font-size:12.5px;color:' + FG2 + '}',
      '.vb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
      '.vb-search{min-width:220px}',
      '.vb-list{list-style:none;margin:0;padding:6px}',
      '.vb-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px}',
      '.vb-row:hover{' + GLASS_SOFT + '}',
      '.vb-row-main{flex:1;min-width:0}',
      '.vb-row-head{display:flex;align-items:baseline;gap:8px;font-size:14px}',
      '.vb-row-mean{font-size:12.5px;color:' + FG2 + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.vb-row-actions{display:flex;gap:2px;opacity:0;transition:opacity .12s}',
      '.vb-row:hover .vb-row-actions,.vb-row-actions:focus-within{opacity:1}',
      '.vb-settings{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;align-items:start}',
      '.vb-books{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}',
      '.vb-book{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:14px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:inherit;text-align:left;cursor:pointer}',
      '.vb-book .lp-progress{align-self:stretch}',
      '.vb-book.is-active{border-color:var(' + BRAND + ');box-shadow:0 0 0 3px ' + tint(BRAND, 14) + '}',
      '.vb-daily{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.vb-daily .lp-select{width:96px}',
      '.vb-chart{display:flex;align-items:flex-end;gap:3px;height:120px}',
      '.vb-bar{flex:1;height:100%;display:flex;flex-direction:column-reverse;border-radius:4px;overflow:hidden}',
      '.vb-bar i{display:block;width:100%}',
      '.vb-bar .is-new{background:var(' + BRAND + ')}',
      '.vb-bar .is-review{background:' + tint(OK, 70) + '}',
      '.vb-bar .is-zero{height:3px;' + GLASS_SOFT + '}',
      '@media (max-width:620px){.vb-word{font-size:34px;line-height:42px}.vb-grades{grid-template-columns:1fr 1fr}}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'vocabulary: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 26, label: () => t('panel'), locale: NS,
        }, WordIcon));
        ctx.effect(() => () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {} }, 'vocabulary: stop speech');
      },
    };
  },
});
