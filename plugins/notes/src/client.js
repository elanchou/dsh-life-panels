window.__ModuleLoader__.load({
  id: '@local/notes',
  factory(require) {
    /* @kit */
    /* @suite */
    /* @include md.js */

    const PANEL_ID = 'notes';
    const NS = 'notes';
    const call = makeCall('/plugin-api/notes');
    const SAVE_DELAY = 700;

    const zh = {
      dateLocale: 'zh-CN', panel: '笔记', title: '笔记',
      newNote: '新建', search: '搜索笔记', all: '全部', pinned: '置顶', untitled: '无标题',
      pin: '置顶', unpin: '取消置顶', del: '删除', confirmDel: '确定删除这条笔记？', cancel: '取消', copy: '复制', copied: '已复制',
      edit: '编辑', preview: '预览', split: '对照', titlePh: '标题', bodyPh: '开始写…\n\n支持 Markdown：# 标题、**加粗**、- 列表、- [ ] 待办、`代码`、[链接](https://…)\n用 #标签 归类',
      saving: '保存中…', saved: '已保存', unsaved: '未保存', saveFailed: '保存失败：{error}',
      emptyList: '还没有笔记', emptyFilter: '没有匹配的笔记', pick: '选一条笔记，或新建一条',
      tasks: '{done}/{total} 项完成', words: '{n} 字', back: '返回列表', tagPh: '加标签，回车确认',
      loadFailed: '加载失败：{error}', retry: '重试', hint: '在对话里说“记一下：下周三交材料”，我会直接存进来',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Notes', title: 'Notes',
      newNote: 'New', search: 'Search notes', all: 'All', pinned: 'Pinned', untitled: 'Untitled',
      pin: 'Pin', unpin: 'Unpin', del: 'Delete', confirmDel: 'Delete this note?', cancel: 'Cancel', copy: 'Copy', copied: 'Copied',
      edit: 'Edit', preview: 'Preview', split: 'Split', titlePh: 'Title', bodyPh: 'Start writing…\n\nMarkdown works: # heading, **bold**, - list, - [ ] to-do, `code`, [link](https://…)\nUse #tags to organise',
      saving: 'Saving…', saved: 'Saved', unsaved: 'Unsaved', saveFailed: 'Could not save: {error}',
      emptyList: 'No notes yet', emptyFilter: 'No matching notes', pick: 'Pick a note, or start a new one',
      tasks: '{done}/{total} done', words: '{n} chars', back: 'Back to list', tagPh: 'Add a tag, Enter to confirm',
      loadFailed: 'Failed to load: {error}', retry: 'Retry', hint: 'Say “Note down: documents due next Wednesday” in chat and it lands here',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago',
    };

    Object.assign(ICONS, {
      copy: ['M9 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z', 'M5 15V6a2 2 0 0 1 2-2h8'],
      eye: ['M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z', 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6'],
      columns: ['M4 5h16v14H4z', 'M12 5v14'],
    });
    const NoteGlyph = PanelGlyph('note');
    const firstLine = (s) => String(s || '').split('\n').map((l) => l.replace(/^\s*(#{1,4}|[-*+]|\d+[.)]|>)\s*(\[[ xX]\]\s*)?/, '').trim()).find(Boolean) || '';
    const noteTitle = (n, t) => n.title || firstLine(n.body).slice(0, 60) || t('untitled');
    /** Plain text of a line: list, checkbox, heading and quote markers dropped, **bold** and `code` unwrapped. */
    const plain = (l) => l.replace(/^\s*(#{1,4}|[-*+]|\d+[.)]|>)\s*/, '').replace(/^\[([ xX])\]\s*/, (_, c) => (c === ' ' ? '☐ ' : '☑ '))
      .replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~/g, (_, a, b, c, d) => a || b || c || d).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    const snippet = (n) => {
      const lines = String(n.body || '').split('\n').filter((l) => l.trim() && !/^\s*```/.test(l)).map(plain).filter(Boolean);
      const rest = n.title ? lines : lines.slice(1);
      return rest.join('  ').slice(0, 120);
    };
    const MODE_KEY = 'notes.mode';
    const readMode = () => { try { const m = localStorage.getItem(MODE_KEY); return m === 'edit' || m === 'preview' || m === 'split' ? m : 'split'; } catch { return 'split'; } };

    /** Insert Markdown around the selection, or prefix the current lines. */
    function applyFormat(el, kind) {
      const v = el.value; const a = el.selectionStart; const b = el.selectionEnd;
      const sel = v.slice(a, b);
      let next; let ca; let cb;
      if (kind === 'bold' || kind === 'code' || kind === 'italic') {
        const w = kind === 'bold' ? '**' : kind === 'code' ? '`' : '*';
        next = v.slice(0, a) + w + (sel || '') + w + v.slice(b); ca = a + w.length; cb = ca + sel.length;
      } else if (kind === 'link') {
        const label = sel || 'text';
        next = v.slice(0, a) + '[' + label + '](https://)' + v.slice(b); ca = a + label.length + 3; cb = ca + 8;
      } else {
        const prefix = kind === 'h' ? '## ' : kind === 'task' ? '- [ ] ' : kind === 'quote' ? '> ' : '- ';
        const start = v.lastIndexOf('\n', a - 1) + 1;
        const endNl = v.indexOf('\n', b);
        const end = endNl < 0 ? v.length : endNl;
        const block = v.slice(start, end).split('\n').map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l)).join('\n');
        next = v.slice(0, start) + block + v.slice(end); ca = start; cb = start + block.length;
      }
      return { value: next, a: ca, b: cb };
    }
    /** Enter inside a list continues it; Enter on an empty item ends it. */
    function continueList(el) {
      const v = el.value; const a = el.selectionStart;
      if (a !== el.selectionEnd) return null;
      const start = v.lastIndexOf('\n', a - 1) + 1;
      const line = v.slice(start, a);
      const m = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(line);
      if (!m) return null;
      if (!m[4].trim() && a === start + line.length) return { value: v.slice(0, start) + v.slice(a), a: start };
      const marker = /\d/.test(m[2]) ? (parseInt(m[2], 10) + 1) + m[2].slice(-1) : m[2];
      const ins = '\n' + m[1] + marker + ' ' + (m[3] ? '[ ] ' : '');
      return { value: v.slice(0, a) + ins + v.slice(a), a: a + ins.length };
    }
    /** Same checklist rule as the host (taskLines/toggleTask), so a tick can be applied to an unsaved draft. */
    const TASK_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/;
    function toggleTaskLocal(body, index) {
      const lines = String(body).split('\n');
      let fence = false; let n = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*```/.test(lines[i])) { fence = !fence; continue; }
        if (fence || !TASK_RE.test(lines[i])) continue;
        if (++n === index) { lines[i] = lines[i].replace(TASK_RE, (_, a, b, c) => a + (b === ' ' ? 'x' : ' ') + c); return lines.join('\n'); }
      }
      return body;
    }
    const countTasks = (body) => {
      let fence = false; let total = 0; let done = 0;
      for (const l of String(body).split('\n')) {
        if (/^\s*```/.test(l)) { fence = !fence; continue; }
        const m = !fence && TASK_RE.exec(l);
        if (m) { total++; if (m[2] !== ' ') done++; }
      }
      return { total, done };
    };

    function useWidth(ref) {
      const [w, setW] = useState(1000);
      useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver !== 'function') return undefined;
        const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
      }, [ref]);
      return w;
    }

    function NoteRow(props) {
      const { t, note, active, onPick } = props;
      const tasks = note.tasks || { total: 0, done: 0 };
      return h('li', null, h('button', { type: 'button', className: 'nt-row' + (active ? ' is-active' : ''), onClick: () => onPick(note.id), 'aria-current': active ? 'true' : undefined },
        h('span', { className: 'nt-row-top' },
          note.pinned ? h('span', { className: 'nt-row-pin' }, h(Icon, { name: 'pin', size: 12 })) : null,
          h('b', null, noteTitle(note, t))),
        snippet(note) ? h('span', { className: 'nt-row-snip' }, snippet(note)) : null,
        h('span', { className: 'nt-row-meta' },
          h('span', null, ago(note.updatedAt, t)),
          tasks.total ? h('span', { className: 'nt-row-tasks' + (tasks.done === tasks.total ? ' is-done' : '') }, h(Icon, { name: 'check', size: 11 }), tasks.done + '/' + tasks.total) : null,
          (note.tags || []).slice(0, 3).map((x) => h('span', { key: x, className: 'nt-row-tag' }, '#' + x)))));
    }

    function TagEditor(props) {
      const { t, tags, inline, onChange } = props;
      const [v, setV] = useState('');
      const manual = tags.filter((x) => !inline.includes(x));
      const commit = () => {
        const x = v.trim().replace(/^#/, '').toLowerCase();
        setV('');
        if (x && /^[\p{L}\p{N}_-]{1,24}$/u.test(x) && !tags.includes(x)) onChange([...inline, ...manual, x]);
      };
      return h('div', { className: 'nt-tagbar' },
        inline.map((x) => h('span', { key: 'i' + x, className: 'nt-chip-tag is-inline', title: '#' + x }, '#' + x)),
        manual.map((x) => h('span', { key: 'm' + x, className: 'nt-chip-tag' }, '#' + x,
          h('button', { type: 'button', 'aria-label': t('del') + ' #' + x, onClick: () => onChange([...inline, ...manual.filter((y) => y !== x)]) }, '×'))),
        h('input', {
          className: 'nt-tag-in', value: v, placeholder: t('tagPh'), 'aria-label': t('tagPh'), maxLength: 25,
          onChange: (e) => setV(e.target.value),
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } },
          onBlur: commit,
        }));
    }

    /** Same rule as the host: #word in the text, outside nothing fancy; a number like #5 is not a tag. */
    const inlineTagsOf = (body) => [...new Set([...String(body).matchAll(/(^|[\s,，。;；])#([\p{L}\p{N}_-]{1,24})(?=$|[\s,，。;；])/gu)]
      .map((m) => m[2]).filter((x) => /\p{L}/u.test(x)).map((x) => x.toLowerCase()))];

    /**
     * The editor owns a draft and autosaves it after a short pause. A note that does not exist yet (id null)
     * is created on its first non-empty save. Saves are serialized: while one is in flight, later edits wait
     * and go out right after it, so the server always ends with the latest text.
     */
    function Editor(props) {
      const { t, note, narrow, onDeleted, onBack, onTag } = props;
      const cb = useRef(props);
      cb.current = props;
      const [title, setTitle] = useState(note.title || '');
      const [body, setBody] = useState(note.body || '');
      const [manual, setManual] = useState(() => (note.tags || []).filter((x) => !inlineTagsOf(note.body || '').includes(x)));
      const [pinned, setPinned] = useState(!!note.pinned);
      const [status, setStatus] = useState(note.id ? 'saved' : 'new');
      const [mode, setMode] = useState(readMode);
      const [confirm, setConfirm] = useState(false);
      const [copied, setCopied] = useState(false);
      const ta = useRef(null);
      const idRef = useRef(note.id);
      const latest = useRef({ title, body, manual, pinned });
      const sent = useRef(JSON.stringify({ title: note.title || '', body: note.body || '', manual, pinned: !!note.pinned }));
      const timer = useRef(0);
      const inflight = useRef(null);
      latest.current = { title, body, manual, pinned };

      const flush = useCallback(async () => {
        clearTimeout(timer.current);
        if (inflight.current) { await inflight.current; }
        const d = latest.current;
        const snap = JSON.stringify(d);
        if (snap === sent.current) { setStatus(idRef.current ? 'saved' : 'new'); return; }
        if (!d.body.trim()) { setStatus(idRef.current ? 'unsaved' : 'new'); return; } // the host keeps no empty notes
        const tags = [...new Set([...inlineTagsOf(d.body), ...d.manual])];
        setStatus('saving');
        const run = (async () => {
          try {
            if (idRef.current) {
              const r = await call({ action: 'update', id: idRef.current, title: d.title, body: d.body, tags, pinned: d.pinned });
              cb.current.onSaved(r.note);
            } else {
              const r = await call({ action: 'add', title: d.title, body: d.body, tags, pinned: d.pinned });
              idRef.current = r.note.id;
              cb.current.onCreated(r.note);
            }
            sent.current = snap;
            setStatus(JSON.stringify(latest.current) === snap ? 'saved' : 'unsaved');
          } catch (e) { setStatus('unsaved'); cb.current.onError(cb.current.t('saveFailed', { error: e.message })); }
        })();
        inflight.current = run;
        await run;
        inflight.current = null;
        if (JSON.stringify(latest.current) !== sent.current && latest.current.body.trim()) timer.current = setTimeout(() => { flush(); }, SAVE_DELAY);
      }, []);

      const schedule = () => { setStatus('unsaved'); clearTimeout(timer.current); timer.current = setTimeout(() => { flush(); }, SAVE_DELAY); };
      useEffect(() => () => { clearTimeout(timer.current); flush(); }, []); // leaving the note saves what is left
      useEffect(() => { if (!note.id && ta.current) ta.current.focus(); }, []);
      useEffect(() => {
        const onUnload = () => { flush(); };
        window.addEventListener('beforeunload', onUnload);
        return () => window.removeEventListener('beforeunload', onUnload);
      }, [flush]);

      const setBodyAnd = (v) => { setBody(v); latest.current = { ...latest.current, body: v }; schedule(); };
      const fmt = (kind) => {
        const el = ta.current; if (!el) return;
        const r = applyFormat(el, kind);
        setBodyAnd(r.value);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.a, r.b); });
      };
      const onKeyDown = (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); return; }
        if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); fmt('bold'); return; }
        if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); fmt('italic'); return; }
        if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); fmt('link'); return; }
        if (e.key === 'Enter' && !e.shiftKey && !mod && !e.isComposing) {
          const r = continueList(e.currentTarget);
          if (r) { e.preventDefault(); const el = e.currentTarget; setBodyAnd(r.value); requestAnimationFrame(() => el.setSelectionRange(r.a, r.a)); }
        }
      };
      const tick = (index) => setBodyAnd(toggleTaskLocal(latest.current.body, index));
      const pickMode = (m) => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked */ } };
      const remove = async () => {
        clearTimeout(timer.current);
        if (inflight.current) await inflight.current;
        sent.current = JSON.stringify(latest.current); // nothing left to save once it is gone
        if (!idRef.current) { onDeleted(null); return; }
        try { await call({ action: 'delete', id: idRef.current }); onDeleted(idRef.current); }
        catch (e) { cb.current.onError(t('saveFailed', { error: e.message })); }
      };
      const copy = async () => { try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ } };

      const effMode = narrow && mode === 'split' ? 'edit' : mode;
      const tasks = countTasks(body);
      const inline = inlineTagsOf(body);
      const statusText = status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : status === 'unsaved' ? t('unsaved') : '';
      const editor = h('textarea', {
        ref: ta, className: 'nt-ta', value: body, placeholder: t('bodyPh'), 'aria-label': t('edit'), spellCheck: false,
        onChange: (e) => setBodyAnd(e.target.value), onKeyDown, onBlur: () => flush(),
      });
      const preview = h('div', { className: 'nt-preview' }, body.trim() ? h(Markdown, { text: body, onCheck: tick, onTag }) : h('p', { className: 'lp-muted' }, t('pick')));
      return h('div', { className: 'nt-editor' },
        h('div', { className: 'nt-ed-bar' },
          narrow ? h('button', { type: 'button', className: 'lp-round', onClick: () => { flush(); onBack(); }, 'aria-label': t('back'), title: t('back') }, h(Icon, { name: 'left', size: 16 })) : null,
          h('div', { className: 'nt-seg', role: 'tablist' }, [['edit', 'edit'], ...(narrow ? [] : [['split', 'columns']]), ['preview', 'eye']].map(([m, ic]) => h('button', {
            key: m, type: 'button', role: 'tab', 'aria-selected': effMode === m, className: 'nt-seg-btn' + (effMode === m ? ' is-on' : ''), onClick: () => pickMode(m), title: t(m),
          }, h(Icon, { name: ic, size: 14 }), h('span', null, t(m))))),
          effMode !== 'preview' ? h('div', { className: 'nt-fmt' },
            [['h', 'H'], ['bold', 'B'], ['italic', 'I'], ['code', '<>'], ['list', '•'], ['task', '☐'], ['quote', '❝'], ['link', '🔗']].map(([k, label]) => h('button', {
              key: k, type: 'button', className: 'nt-fmt-btn is-' + k, onMouseDown: (e) => e.preventDefault(), onClick: () => fmt(k), title: k, 'aria-label': k,
            }, label))) : null,
          h('span', { className: 'nt-status is-' + status }, statusText),
          h('div', { className: 'nt-ed-actions' },
            h('button', { type: 'button', className: 'lp-round lp-round-sm' + (pinned ? ' is-on' : ''), title: pinned ? t('unpin') : t('pin'), 'aria-label': pinned ? t('unpin') : t('pin'), 'aria-pressed': pinned,
              onClick: () => { setPinned(!pinned); latest.current = { ...latest.current, pinned: !pinned }; schedule(); } }, h(Icon, { name: 'pin', size: 14 })),
            h('button', { type: 'button', className: 'lp-round lp-round-sm', title: copied ? t('copied') : t('copy'), 'aria-label': t('copy'), onClick: copy }, h(Icon, { name: copied ? 'check' : 'copy', size: 14 })),
            h('button', { type: 'button', className: 'lp-round lp-round-sm is-danger', title: t('del'), 'aria-label': t('del'), onClick: () => setConfirm(true) }, h(Icon, { name: 'trash', size: 14 })))),
        confirm ? h('div', { className: 'nt-confirm', role: 'alertdialog' }, h('span', null, t('confirmDel')),
          h('button', { type: 'button', className: 'lp-primary nt-danger', onClick: remove }, t('del')),
          h('button', { type: 'button', className: 'lp-ghost', onClick: () => setConfirm(false) }, t('cancel'))) : null,
        h('input', { className: 'nt-title', value: title, placeholder: t('titlePh'), 'aria-label': t('titlePh'), maxLength: 120,
          onChange: (e) => { setTitle(e.target.value); latest.current = { ...latest.current, title: e.target.value }; schedule(); }, onBlur: () => flush(),
          onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (ta.current) ta.current.focus(); } } }),
        h(TagEditor, { t, tags: [...inline, ...manual.filter((x) => !inline.includes(x))], inline, onChange: (list) => { const m = list.filter((x) => !inline.includes(x)); setManual(m); latest.current = { ...latest.current, manual: m }; schedule(); } }),
        h('div', { className: 'nt-body is-' + effMode }, effMode === 'edit' ? editor : effMode === 'preview' ? preview : [h('div', { key: 'e', className: 'nt-pane' }, editor), h('div', { key: 'p', className: 'nt-pane' }, preview)]),
        h('div', { className: 'nt-ed-foot lp-muted' },
          h('span', null, t('words', { n: body.length })),
          tasks.total ? h('span', null, t('tasks', tasks)) : null,
          note.createdAt ? h('span', null, fmtDate(note.createdAt.slice(0, 10), t('dateLocale'), { year: 'numeric', month: 'short', day: 'numeric' })) : null));
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [data, setData] = useState(null);
      const [error, setError] = useState(null);
      const [query, setQuery] = useState('');
      const [tag, setTag] = useState('');
      const [openNote, setOpenNote] = useState(null); // full note shown in the editor, or a draft { id: null }
      const [editorKey, setEditorKey] = useState('');
      const [showEditor, setShowEditor] = useState(false); // narrow layout: list or editor
      const alive = useRef(true);
      const root = useRef(null);
      const narrow = useWidth(root) < 720;

      const load = useCallback(async () => {
        try { const r = await call({ action: 'list', limit: 500, query, tag }); if (alive.current) { setData(r); setError(null); } }
        catch (e) { if (alive.current) setError(t('loadFailed', { error: e.message })); }
      }, [t, query, tag]);
      useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
      useEffect(() => { const id = setTimeout(load, query ? 200 : 0); return () => clearTimeout(id); }, [load, query]);
      // Notes the agent adds from chat show up without a refresh; the open editor keeps its own draft.
      useEffect(() => { const id = setInterval(() => { if (!document.hidden) load(); }, 15000); return () => clearInterval(id); }, [load]);

      const open = useCallback(async (id) => {
        try {
          const r = await call({ action: 'get', id });
          setOpenNote(r.note); setEditorKey(id); setShowEditor(true);
        } catch (e) { setError(t('loadFailed', { error: e.message })); }
      }, [t]);
      const create = () => { setOpenNote({ id: null, title: '', body: '', tags: tag ? [tag] : [], pinned: false }); setEditorKey('new-' + Date.now()); setShowEditor(true); };
      // Keep the list in step with the editor without reloading it on every keystroke.
      const patch = (n) => setData((d) => {
        if (!d) return d;
        const rest = d.items.filter((x) => x.id !== n.id);
        const row = { ...n, body: n.body.slice(0, 400), truncated: n.body.length > 400 };
        return { ...d, items: [row, ...rest].sort((a, b) => (a.pinned === b.pinned ? String(b.updatedAt).localeCompare(String(a.updatedAt)) : a.pinned ? -1 : 1)) };
      });
      const onCreated = (n) => { setOpenNote(n); patch(n); load(); };
      const onDeleted = () => { setOpenNote(null); setEditorKey(''); setShowEditor(false); load(); };

      // Pick the first note once, so the editor is not empty on arrival.
      const picked = useRef(false);
      useEffect(() => {
        if (picked.current || !data || openNote) return;
        picked.current = true;
        if (!narrow && data.items.length) open(data.items[0].id);
      }, [data, openNote, narrow, open]);

      const items = (data && data.items) || [];
      const tags = (data && data.tags) || [];
      const activeId = openNote && openNote.id;
      const list = h('aside', { className: 'nt-side' },
        h('div', { className: 'nt-side-head' },
          h('h1', { className: 'nt-h1' }, t('title'), data ? h('span', { className: 'lp-muted' }, data.total) : null),
          h('button', { type: 'button', className: 'lp-primary nt-new', onClick: create }, h(Icon, { name: 'plus', size: 14 }), t('newNote'))),
        h('label', { className: 'lp-field nt-search' }, h(Icon, { name: 'search', size: 14 }),
          h('input', { value: query, onChange: (e) => setQuery(e.target.value), placeholder: t('search'), 'aria-label': t('search') })),
        tags.length ? h('div', { className: 'nt-chips' },
          h('button', { type: 'button', className: 'nt-chip' + (!tag ? ' is-active' : ''), onClick: () => setTag('') }, t('all')),
          tags.map((x) => h('button', { key: x.name, type: 'button', className: 'nt-chip' + (tag === x.name ? ' is-active' : ''), onClick: () => setTag(tag === x.name ? '' : x.name) }, '#' + x.name, h('i', null, x.count)))) : null,
        !data ? h('div', { className: 'nt-skels' }, [0, 1, 2, 3].map((i) => h('div', { key: i, className: 'lp-skel', style: { height: 64, borderRadius: 12 } })))
          : !items.length ? h('div', { className: 'nt-empty lp-muted' }, query || tag ? t('emptyFilter') : t('emptyList'))
            : h('ul', { className: 'nt-rows' }, items.map((n) => h(NoteRow, { key: n.id, t, note: n, active: n.id === activeId, onPick: open }))),
        h('p', { className: 'lp-hint nt-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint')));
      const editor = openNote
        ? h(Editor, { key: editorKey, t, note: openNote, narrow, onSaved: patch, onCreated, onDeleted, onBack: () => { setShowEditor(false); load(); }, onTag: (x) => setTag(x), onError: setError })
        : h('div', { className: 'nt-pick lp-muted' }, h(Icon, { name: 'note', size: 28 }), h('span', null, t('pick')), h('button', { type: 'button', className: 'lp-ghost', onClick: create }, h(Icon, { name: 'plus', size: 14 }), t('newNote')));
      return h('div', { ref: root, className: 'lp-root nt-root' + (narrow ? ' is-narrow' : '') },
        error ? h('div', { className: 'nt-err' }, h(ErrorBar, { error, onRetry: load, retryLabel: t('retry'), onClose: () => setError(null) })) : null,
        h('div', { className: 'nt-shell' },
          !narrow || !showEditor ? list : null,
          !narrow || showEditor ? h('section', { className: 'nt-main' }, editor) : null),
        h('style', null, KIT_CSS + MD_CSS + CSS));
    }

    const CSS = [
      '.nt-root{--lp-amb-a:var(' + WARN + ');--lp-amb-b:var(' + BRAND + ');--lp-amb-c:var(' + OK + ');overflow:hidden;display:flex;flex-direction:column}',
      '.nt-err{padding:12px 16px 0}',
      '.nt-shell{flex:1;min-height:0;display:flex}',
      '.nt-side{flex:none;width:300px;display:flex;flex-direction:column;gap:10px;padding:18px 12px 12px 18px;border-right:1px solid var(--lp-glass-edge);min-height:0}',
      '.nt-root.is-narrow .nt-side{width:auto;flex:1;border-right:0;padding:16px}',
      '.nt-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.nt-h1{margin:0;font-size:20px;font-weight:700;display:flex;align-items:baseline;gap:8px}',
      '.nt-h1 .lp-muted{font-size:13px;font-weight:500}',
      '.nt-new{height:30px;padding:0 12px}',
      '.nt-search{width:100%;box-sizing:border-box}',
      '.nt-search input{flex:1;width:100%}',
      '.nt-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;flex:none}',
      '.nt-chips::-webkit-scrollbar{display:none}',
      '.nt-chip{flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:' + FG + ';font-size:12px;cursor:pointer}',
      '.nt-chip i{font-style:normal;font-size:10.5px;color:' + FG2 + '}',
      '.nt-chip.is-active{background:' + FG + ';color:var(--dsw-alias-bg-base);border-color:transparent}',
      '.nt-chip.is-active i{color:inherit;opacity:.7}',
      '.nt-rows{list-style:none;margin:0 -4px 0 0;padding:0 4px 0 0;flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px}',
      '.nt-skels{display:flex;flex-direction:column;gap:6px}',
      '.nt-empty{padding:20px 4px;font-size:13px}',
      '.nt-row{width:100%;display:flex;flex-direction:column;gap:3px;padding:10px 10px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:left;cursor:pointer}',
      '.nt-row:hover{' + GLASS_SOFT + '}',
      '.nt-row.is-active{background:' + tint(BRAND, 12) + '}',
      '.nt-row:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:-2px}',
      '.nt-row-top{display:flex;align-items:center;gap:6px;min-width:0}',
      '.nt-row-top b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nt-row-pin{flex:none;display:inline-flex;color:var(' + WARN + ')}',
      '.nt-row-snip{font-size:12px;line-height:17px;color:' + FG2 + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.nt-row-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:' + FG2 + ';overflow:hidden;white-space:nowrap}',
      '.nt-row-tasks{display:inline-flex;align-items:center;gap:2px}',
      '.nt-row-tasks.is-done{color:var(' + OK + ')}',
      '.nt-row-tag{color:var(' + BRAND + ')}',
      '.nt-hint{margin:0;font-size:11.5px;flex:none}',
      '.nt-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}',
      '.nt-pick{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-size:13px}',
      '.nt-editor{flex:1;min-height:0;display:flex;flex-direction:column;padding:12px 22px 10px}',
      '.nt-root.is-narrow .nt-editor{padding:10px 14px}',
      '.nt-ed-bar{flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--lp-glass-edge)}',
      '.nt-seg{display:inline-flex;padding:2px;border-radius:9px;' + GLASS_SOFT + '}',
      '.nt-seg-btn{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:' + FG2 + ';font-size:12px;cursor:pointer}',
      '.nt-seg-btn.is-on{background:var(--dsw-alias-bg-layer-1);color:' + FG + ';box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.nt-root.is-narrow .nt-seg-btn span{display:none}',
      '.nt-fmt{display:inline-flex;gap:2px}',
      '.nt-fmt-btn{min-width:28px;height:28px;padding:0 6px;border:0;border-radius:7px;background:transparent;color:' + FG2 + ';font-size:13px;font-weight:600;cursor:pointer}',
      '.nt-fmt-btn:hover{' + GLASS_SOFT + ';color:' + FG + '}',
      '.nt-fmt-btn.is-italic{font-style:italic;font-family:Georgia,serif}',
      '.nt-fmt-btn.is-code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px}',
      '.nt-root.is-narrow .nt-fmt-btn.is-quote,.nt-root.is-narrow .nt-fmt-btn.is-code{display:none}',
      '.nt-status{margin-left:auto;font-size:11.5px;color:' + FG2 + ';min-width:46px;text-align:right}',
      '.nt-status.is-unsaved{color:var(' + WARN + ')}',
      '.nt-ed-actions{display:inline-flex;gap:4px}',
      '.nt-ed-actions .lp-round.is-on{color:var(' + WARN + ')}',
      '.nt-confirm{flex:none;display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;border-radius:10px;background:' + tint(ERR, 10) + ';font-size:13px}',
      '.nt-danger{background:var(' + ERR + ') !important;color:#fff !important}',
      '.nt-title{flex:none;margin-top:14px;border:0;outline:0;background:transparent;color:' + FG + ';font:inherit;font-size:22px;font-weight:700;padding:2px 0}',
      '.nt-title::placeholder{color:' + FG2 + ';opacity:.6}',
      '.nt-tagbar{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0 10px}',
      '.nt-chip-tag{display:inline-flex;align-items:center;gap:2px;padding:1px 4px 1px 8px;border-radius:999px;background:' + tint(BRAND, 12) + ';color:var(' + BRAND + ');font-size:12px}',
      '.nt-chip-tag.is-inline{padding-right:8px}',
      '.nt-chip-tag button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:0 3px;border-radius:50%}',
      '.nt-tag-in{flex:1;min-width:120px;border:0;outline:0;background:transparent;color:' + FG + ';font:inherit;font-size:12.5px;padding:3px 0}',
      '.nt-tag-in::placeholder{color:' + FG2 + ';opacity:.7}',
      '.nt-body{flex:1;min-height:0;display:flex;gap:18px}',
      '.nt-body.is-split > .nt-pane{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.nt-body.is-split > .nt-pane + .nt-pane{border-left:1px solid var(--lp-glass-edge);padding-left:18px}',
      '.nt-ta{flex:1;width:100%;min-height:240px;box-sizing:border-box;resize:none;border:0;outline:0;background:transparent;color:' + FG + ';font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13.5px;line-height:22px;tab-size:2}',
      '.nt-ta::placeholder{color:' + FG2 + ';opacity:.7;font-family:-apple-system,system-ui,sans-serif}',
      '.nt-preview{flex:1;min-height:0;overflow-y:auto;padding-right:4px}',
      '.nt-body.is-edit > .nt-ta,.nt-body.is-preview > .nt-preview{flex:1}',
      '.nt-ed-foot{flex:none;display:flex;gap:14px;padding-top:8px;border-top:1px solid var(--lp-glass-edge);font-size:11.5px;font-variant-numeric:tabular-nums}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'notes: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'personal', order: 25, label: () => t('panel'), icon: NoteGlyph, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 32, label: () => t('panel'), locale: NS,
        }, NoteGlyph)));
      },
    };
  },
});
