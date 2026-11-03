window.__ModuleLoader__.load({
  id: '@local/calendar-reminders',
  factory(require) {
    const React = require('react');
    const { useState, useEffect, useCallback, useRef, useMemo } = React;
    const h = React.createElement;

    const PANEL_ID = 'calendar-reminders';
    const NS = 'calendarReminders';
    const API = '/plugin-api/calendar-reminders';

    const zh = {
      dateLocale: 'zh-CN',
      panel: '日历',
      title: '日历与提醒',
      today: '今天',
      tomorrow: '明天',
      yesterday: '昨天',
      prev: '上个月',
      next: '下个月',
      monthTitle: '{year}年{month}月',
      weekdays: '日,一,二,三,四,五,六',
      addPlaceholder: '添加提醒，例如：周五前提交周报',
      add: '添加',
      date: '日期',
      time: '时间',
      delete: '删除',
      tabOpen: '待办',
      tabDone: '已完成',
      overdue: '已逾期',
      todaySection: '今天',
      upcoming: '即将到来',
      someday: '未排期',
      statToday: '今日',
      statOverdue: '逾期',
      statOpen: '待办',
      emptyDay: '这一天没有安排',
      emptyOpen: '全部完成，休息一下吧',
      emptyDone: '还没有完成的事项',
      loadFailed: '加载失败：{error}',
      saveFailed: '操作失败：{error}',
      retry: '重试',
      loading: '加载中…',
      markDone: '标记完成',
      markOpen: '恢复为未完成',
      allDay: '全天',
      hint: '也可以直接在对话里说“明天下午三点提醒我开会”',
    };
    const en = {
      dateLocale: 'en-US',
      panel: 'Calendar',
      title: 'Calendar & Reminders',
      today: 'Today',
      tomorrow: 'Tomorrow',
      yesterday: 'Yesterday',
      prev: 'Previous month',
      next: 'Next month',
      monthTitle: '{monthName} {year}',
      weekdays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
      addPlaceholder: 'Add a reminder, e.g. Send the weekly report by Friday',
      add: 'Add',
      date: 'Date',
      time: 'Time',
      delete: 'Delete',
      tabOpen: 'To do',
      tabDone: 'Done',
      overdue: 'Overdue',
      todaySection: 'Today',
      upcoming: 'Upcoming',
      someday: 'Unscheduled',
      statToday: 'Today',
      statOverdue: 'Overdue',
      statOpen: 'Open',
      emptyDay: 'Nothing planned for this day',
      emptyOpen: 'All done. Take a break.',
      emptyDone: 'No completed items yet',
      loadFailed: 'Failed to load: {error}',
      saveFailed: 'Action failed: {error}',
      retry: 'Retry',
      loading: 'Loading…',
      markDone: 'Mark done',
      markOpen: 'Mark not done',
      allDay: 'All day',
      hint: 'You can also ask in chat: “Remind me about the meeting tomorrow at 3 pm”',
    };

    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const todayStr = () => ymd(new Date());
    function parseYmd(s) {
      const p = s.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    }
    function relLabel(s, today, t) {
      if (!s) return '';
      if (s === today) return t('today');
      const diff = Math.round((parseYmd(s) - parseYmd(today)) / 86400000);
      if (diff === 1) return t('tomorrow');
      if (diff === -1) return t('yesterday');
      const d = parseYmd(s);
      const sameYear = d.getFullYear() === parseYmd(today).getFullYear();
      return d.toLocaleDateString(t('dateLocale'), sameYear
        ? { month: 'short', day: 'numeric', weekday: 'short' }
        : { year: 'numeric', month: 'short', day: 'numeric' });
    }

    async function call(body) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok || !data || data.ok === false) {
        throw new Error((data && data.error) || ('HTTP ' + response.status));
      }
      return data;
    }

    const ICONS = {
      left: ['M15 6l-6 6 6 6'],
      right: ['M9 6l6 6-6 6'],
      plus: ['M12 5v14', 'M5 12h14'],
      check: ['M5 12.5l4.5 4.5L19 7'],
      clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7.5V12l3 2'],
      trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
      calendar: ['M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', 'M4 10h16', 'M8 2.5v3', 'M16 2.5v3'],
      sparkle: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z'],
      alert: ['M12 8v5', 'M12 16.5v.01', 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0'],
    };
    function Icon(props) {
      const size = props.size || 16;
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: props.stroke || 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block', flex: 'none' },
      }, (ICONS[props.name] || []).map((d, i) => h('path', { key: i, d })));
    }

    function PanelIcon(props) {
      const size = props.size || 18;
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
        strokeWidth: props.active ? 2 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      },
        h('rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }),
        h('path', { d: 'M3.5 10h17M8 3v4M16 3v4' }),
        h('path', { d: 'M8.5 14.5l2 2 4-4' }),
      );
    }

    function Item(props) {
      const { item, t, onToggle, onDelete, today, showDate } = props;
      const late = !item.done && item.date && item.date < today;
      const isToday = !item.done && item.date === today;
      const cls = ['cr-item'];
      if (item.done) cls.push('is-done');
      if (late) cls.push('is-late');
      else if (isToday) cls.push('is-today');
      const when = [];
      if (showDate && item.date) when.push(relLabel(item.date, today, t));
      if (item.time) when.push(item.time);
      return h('div', { className: cls.join(' ') },
        h('button', {
          type: 'button', className: 'cr-check', role: 'checkbox', 'aria-checked': item.done,
          'aria-label': item.done ? t('markOpen') : t('markDone'), title: item.done ? t('markOpen') : t('markDone'),
          onClick: () => onToggle(item),
        }, h(Icon, { name: 'check', size: 12, stroke: 2.6 })),
        h('div', { className: 'cr-item-body' },
          h('div', { className: 'cr-item-title' }, item.title),
          (when.length || item.notes) ? h('div', { className: 'cr-item-meta' },
            when.length ? h('span', { className: 'cr-chip' }, h(Icon, { name: 'clock', size: 12 }), when.join(' · ')) : null,
            item.notes ? h('span', { className: 'cr-item-notes' }, item.notes) : null,
          ) : null,
        ),
        h('button', { type: 'button', className: 'cr-del', 'aria-label': t('delete'), title: t('delete'), onClick: () => onDelete(item) },
          h(Icon, { name: 'trash', size: 15 })),
      );
    }

    function Group(props) {
      if (!props.items.length) return null;
      return h('section', { className: 'cr-group' },
        h('header', { className: 'cr-group-head' + (props.tone ? ' ' + props.tone : '') },
          h('span', { className: 'cr-group-bar' }),
          h('span', null, props.title),
          h('span', { className: 'cr-badge' }, props.items.length),
        ),
        h('div', { className: 'cr-group-list' },
          props.items.map((item) => h(Item, {
            key: item.id, item, t: props.t, today: props.today, showDate: props.showDate,
            onToggle: props.onToggle, onDelete: props.onDelete,
          })),
        ),
      );
    }

    function Month(props) {
      const { cursor, selected, counts, today, t } = props;
      const labels = t('weekdays').split(',');
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = new Date(first); start.setDate(1 - first.getDay());
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const key = ymd(d);
        const c = counts[key];
        const cls = ['cr-day'];
        if (d.getMonth() !== cursor.getMonth()) cls.push('is-out');
        if (d.getDay() === 0 || d.getDay() === 6) cls.push('is-weekend');
        if (key === today) cls.push('is-today');
        if (key === selected) cls.push('is-selected');
        const dots = c ? Math.min(c.n, 3) : 0;
        cells.push(h('button', {
          key, type: 'button', className: cls.join(' '), onClick: () => props.onSelect(key),
          'aria-pressed': key === selected, 'aria-label': key + (c ? ' (' + c.n + ')' : ''),
        },
          h('span', { className: 'cr-day-num' }, d.getDate()),
          h('span', { className: 'cr-dots' },
            Array.from({ length: dots }, (_, j) => h('i', { key: j, className: 'cr-dot' + (c.late ? ' is-late' : '') })),
          ),
        ));
      }
      return h('div', { className: 'cr-month' },
        h('div', { className: 'cr-week' }, labels.map((l, i) => h('span', { key: i, className: i === 0 || i === 6 ? 'is-weekend' : '' }, l))),
        h('div', { className: 'cr-grid' }, cells),
      );
    }

    function Stat(props) {
      return h('div', { className: 'cr-stat' + (props.tone ? ' ' + props.tone : '') },
        h('span', { className: 'cr-stat-icon' }, h(Icon, { name: props.icon, size: 16 })),
        h('span', { className: 'cr-stat-body' },
          h('span', { className: 'cr-stat-num' }, props.value),
          h('span', { className: 'cr-stat-label' }, props.label),
        ),
      );
    }

    function Empty(props) {
      return h('div', { className: 'cr-empty' },
        h('span', { className: 'cr-empty-icon' }, h(Icon, { name: props.icon || 'sparkle', size: 22 })),
        h('span', null, props.text),
      );
    }

    function Panel(props) {
      const t = props.t || ((k) => k);
      const [items, setItems] = useState(null);
      const [error, setError] = useState(null);
      const [today, setToday] = useState(todayStr());
      const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
      const [selected, setSelected] = useState(todayStr());
      const [title, setTitle] = useState('');
      const [date, setDate] = useState(todayStr());
      const [time, setTime] = useState('');
      const [tab, setTab] = useState('open');
      const [busy, setBusy] = useState(false);
      const alive = useRef(true);

      const refresh = useCallback(async () => {
        try {
          const data = await call({ action: 'list' });
          if (!alive.current) return;
          setItems(data.items); setToday(data.today); setError(null);
        } catch (e) {
          if (alive.current) setError(t('loadFailed', { error: e.message }));
        }
      }, [t]);

      useEffect(() => {
        alive.current = true;
        refresh();
        const id = setInterval(refresh, 30000);
        return () => { alive.current = false; clearInterval(id); };
      }, [refresh]);

      const act = useCallback(async (body) => {
        setBusy(true);
        try { await call(body); await refresh(); return true; }
        catch (e) { if (alive.current) setError(t('saveFailed', { error: e.message })); return false; }
        finally { if (alive.current) setBusy(false); }
      }, [refresh, t]);

      const onAdd = (event) => {
        event.preventDefault();
        if (!title.trim() || busy) return;
        act({ action: 'add', title: title.trim(), date: date || '', time: time || '' })
          .then((ok) => { if (ok && alive.current) { setTitle(''); setTime(''); } });
      };
      const onToggle = (item) => act({ action: item.done ? 'reopen' : 'complete', id: item.id });
      const onDelete = (item) => act({ action: 'delete', id: item.id });

      const list = items || [];
      const counts = useMemo(() => {
        const map = {};
        for (const item of list) {
          if (!item.date || item.done) continue;
          const c = map[item.date] || (map[item.date] = { n: 0, late: false });
          c.n++; if (item.date < today) c.late = true;
        }
        return map;
      }, [list, today]);

      const open = list.filter((i) => !i.done);
      const dayItems = list.filter((i) => i.date === selected);
      const overdue = open.filter((i) => i.date && i.date < today);
      const todayItems = open.filter((i) => i.date === today);
      const upcoming = open.filter((i) => i.date && i.date > today);
      const someday = open.filter((i) => !i.date);
      const doneItems = list.filter((i) => i.done).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      const shared = { t, today, onToggle, onDelete };

      const monthName = cursor.toLocaleDateString(t('dateLocale'), { month: 'long' });
      const monthLabel = t('monthTitle', { year: cursor.getFullYear(), month: cursor.getMonth() + 1, monthName });
      const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
      const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayStr()); setDate(todayStr()); };
      const selectDay = (k) => {
        setSelected(k); setDate(k);
        const d = parseYmd(k);
        if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
      };
      const todayLong = parseYmd(today).toLocaleDateString(t('dateLocale'), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const selectedLong = parseYmd(selected).toLocaleDateString(t('dateLocale'), { month: 'long', day: 'numeric', weekday: 'long' });

      const header = h('header', { className: 'cr-hero' },
        h('div', { className: 'cr-hero-text' },
          h('span', { className: 'cr-eyebrow' }, todayLong),
          h('h1', { className: 'cr-title' }, t('title')),
        ),
        h('div', { className: 'cr-stats' },
          h(Stat, { icon: 'calendar', value: todayItems.length, label: t('statToday'), tone: 'tone-brand' }),
          h(Stat, { icon: 'alert', value: overdue.length, label: t('statOverdue'), tone: overdue.length ? 'tone-error' : '' }),
          h(Stat, { icon: 'check', value: open.length, label: t('statOpen'), tone: 'tone-success' }),
        ),
      );

      const form = h('form', { className: 'cr-add', onSubmit: onAdd },
        h('span', { className: 'cr-add-icon' }, h(Icon, { name: 'plus', size: 18 })),
        h('input', { className: 'cr-add-title', value: title, onChange: (e) => setTitle(e.target.value), placeholder: t('addPlaceholder'), 'aria-label': t('addPlaceholder'), maxLength: 200 }),
        h('label', { className: 'cr-field', title: t('date') },
          h(Icon, { name: 'calendar', size: 14 }),
          h('input', { type: 'date', value: date, onChange: (e) => setDate(e.target.value), 'aria-label': t('date') }),
        ),
        h('label', { className: 'cr-field', title: t('time') },
          h(Icon, { name: 'clock', size: 14 }),
          h('input', { type: 'time', value: time, onChange: (e) => setTime(e.target.value), 'aria-label': t('time') }),
        ),
        h('button', { type: 'submit', className: 'cr-primary', disabled: busy || !title.trim() }, t('add')),
      );

      const calendar = h('section', { className: 'cr-card cr-cal' },
        h('div', { className: 'cr-cal-head' },
          h('strong', { className: 'cr-month-label' }, monthLabel),
          h('div', { className: 'cr-cal-nav' },
            h('button', { type: 'button', className: 'cr-ghost', onClick: goToday }, t('today')),
            h('button', { type: 'button', className: 'cr-round', onClick: () => shift(-1), 'aria-label': t('prev'), title: t('prev') }, h(Icon, { name: 'left' })),
            h('button', { type: 'button', className: 'cr-round', onClick: () => shift(1), 'aria-label': t('next'), title: t('next') }, h(Icon, { name: 'right' })),
          ),
        ),
        h(Month, { cursor, selected, counts, today, t, onSelect: selectDay }),
        h('div', { className: 'cr-agenda' },
          h('div', { className: 'cr-agenda-head' },
            h('span', { className: 'cr-agenda-day' }, selectedLong),
            selected === today ? h('span', { className: 'cr-pill' }, t('today')) : null,
          ),
          dayItems.length
            ? h('div', { className: 'cr-group-list' }, dayItems.map((item) => h(Item, { key: item.id, item, ...shared })))
            : h(Empty, { icon: 'calendar', text: t('emptyDay') }),
        ),
      );

      const tabs = h('div', { className: 'cr-tabs', role: 'tablist' },
        [['open', t('tabOpen'), open.length], ['done', t('tabDone'), doneItems.length]].map(([id, label, n]) =>
          h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, className: 'cr-tab' + (tab === id ? ' is-active' : ''), onClick: () => setTab(id) },
            label, h('span', { className: 'cr-tab-n' }, n))),
      );

      const listBody = tab === 'open'
        ? (open.length
          ? h(React.Fragment, null,
            h(Group, { title: t('overdue'), tone: 'tone-error', items: overdue, showDate: true, ...shared }),
            h(Group, { title: t('todaySection'), tone: 'tone-brand', items: todayItems, ...shared }),
            h(Group, { title: t('upcoming'), items: upcoming, showDate: true, ...shared }),
            h(Group, { title: t('someday'), tone: 'tone-idle', items: someday, ...shared }))
          : h(Empty, { icon: 'sparkle', text: t('emptyOpen') }))
        : (doneItems.length
          ? h('div', { className: 'cr-group-list' }, doneItems.map((item) => h(Item, { key: item.id, item, showDate: true, ...shared })))
          : h(Empty, { icon: 'check', text: t('emptyDone') }));

      const listCard = h('section', { className: 'cr-card cr-list' }, tabs, h('div', { className: 'cr-list-body' }, listBody));

      return h('div', { className: 'cr-root' },
        h('style', null, CSS),
        h('div', { className: 'cr-inner' },
          header,
          error ? h('div', { className: 'cr-error', role: 'alert' },
            h(Icon, { name: 'alert', size: 16 }), h('span', null, error),
            h('button', { type: 'button', className: 'cr-link', onClick: refresh }, t('retry'))) : null,
          form,
          items === null && !error
            ? h('div', { className: 'cr-loading' }, t('loading'))
            : h('div', { className: 'cr-cols' }, calendar, listCard),
          h('p', { className: 'cr-hint' }, h(Icon, { name: 'sparkle', size: 13 }), t('hint')),
        ),
      );
    }

    const tint = (token, pct) => 'color-mix(in srgb, var(' + token + ') ' + pct + '%, transparent)';
    const BRAND = '--dsw-alias-brand-primary';
    const ERR = '--dsw-alias-state-error-primary';
    const OK = '--dsw-alias-state-success-primary';
    const IDLE = '--dsw-alias-state-idle-primary';
    /* @glass */

    const CSS = [
      '.cr-root{' + GLASS_ROOT + ';box-sizing:border-box;height:100%;overflow:auto;color:var(--dsw-alias-label-primary);font-size:13px}',
      ...glassFallback('.cr-root'),
      '.cr-root *,.cr-root *::before,.cr-root *::after{box-sizing:border-box}',
      '.cr-inner{max-width:1120px;margin:0 auto;padding:28px 32px 40px}',
      '.cr-root button{font:inherit}',
      '.cr-root :focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:2px}',

      /* hero */
      '.cr-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:20px}',
      '.cr-eyebrow{display:block;font-size:12px;line-height:18px;color:var(' + BRAND + ');font-weight:500;letter-spacing:.02em}',
      '.cr-title{margin:2px 0 0;font-size:24px;line-height:32px;font-weight:650;letter-spacing:-.01em}',
      '.cr-stats{display:flex;gap:10px;flex-wrap:wrap}',
      '.cr-stat{display:flex;align-items:center;gap:10px;min-width:112px;padding:10px 14px 10px 10px;border-radius:14px;' + GLASS + '}',
      '.cr-stat-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;color:var(--dsw-alias-label-secondary);' + GLASS_SOFT + '}',
      '.cr-stat-body{display:flex;flex-direction:column}',
      '.cr-stat-num{font-size:18px;line-height:22px;font-weight:650;font-variant-numeric:tabular-nums}',
      '.cr-stat-label{font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}',
      '.cr-stat.tone-brand .cr-stat-icon{color:var(' + BRAND + ');background:' + tint(BRAND, 14) + '}',
      '.cr-stat.tone-error .cr-stat-icon{color:var(' + ERR + ');background:' + tint(ERR, 14) + '}',
      '.cr-stat.tone-error .cr-stat-num{color:var(' + ERR + ')}',
      '.cr-stat.tone-success .cr-stat-icon{color:var(' + OK + ');background:' + tint(OK, 14) + '}',

      /* error + add bar */
      '.cr-error{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;border-radius:12px;background:' + tint(ERR, 12) + ';border:1px solid ' + tint(ERR, 22) + ';color:var(' + ERR + ')}',
      '.cr-error span{flex:1}',
      '.cr-add{display:flex;align-items:center;gap:6px;margin-bottom:18px;padding:6px 6px 6px 14px;border-radius:14px;' + GLASS + ';transition:border-color .15s,box-shadow .15s}',
      '.cr-add:focus-within{border-color:var(' + BRAND + ');box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 0 0 3px ' + tint(BRAND, 16) + '}',
      '.cr-add-icon{color:var(' + BRAND + ');display:inline-flex}',
      '.cr-add-title{flex:1 1 200px;min-width:120px;height:36px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px}',
      '.cr-add-title::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.cr-root .cr-add-title:focus-visible{outline:0}',
      '.cr-field{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:9px;' + GLASS_SOFT + ';color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.cr-field input{border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-variant-numeric:tabular-nums;color-scheme:light dark}',
      '.cr-primary{height:34px;padding:0 18px;border-radius:10px;border:0;background:var(' + BRAND + ');color:#fff;font-weight:600;cursor:pointer;transition:filter .15s,opacity .15s}',
      '.cr-primary:hover:not(:disabled){filter:brightness(1.08)}',
      '.cr-primary:disabled{opacity:.4;cursor:default}',

      /* layout + cards */
      '.cr-cols{display:grid;grid-template-columns:minmax(320px,1.05fr) minmax(300px,1fr);gap:18px;align-items:start}',
      '@media (max-width:820px){.cr-cols{grid-template-columns:1fr}.cr-inner{padding:20px 16px 32px}.cr-hero{align-items:flex-start}}',
      '.cr-card{' + GLASS + ';border-radius:18px;padding:18px}',
      '.cr-loading{padding:40px 0;text-align:center;color:var(--dsw-alias-label-secondary)}',

      /* calendar */
      '.cr-cal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}',
      '.cr-month-label{font-size:16px;line-height:24px;font-weight:650}',
      '.cr-cal-nav{display:flex;align-items:center;gap:4px}',
      '.cr-ghost{height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--lp-glass-edge);' + GLASS_SOFT + ';color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
      '.cr-ghost:hover{background:var(--lp-glass-strong)}',
      '.cr-round{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.cr-round:hover{' + GLASS_SOFT + ';color:var(--dsw-alias-label-primary)}',
      '.cr-week,.cr-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}',
      '.cr-week{margin-bottom:4px}',
      '.cr-week span{text-align:center;font-size:11px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.cr-week span.is-weekend{opacity:.7}',
      '.cr-day{position:relative;aspect-ratio:1/0.86;min-height:38px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;transition:background .12s}',
      '.cr-day:hover{' + GLASS_SOFT + '}',
      '.cr-day-num{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:13px;font-variant-numeric:tabular-nums}',
      '.cr-day.is-weekend .cr-day-num{color:var(--dsw-alias-label-secondary)}',
      '.cr-day.is-out{opacity:.35}',
      '.cr-day.is-today .cr-day-num{background:var(' + BRAND + ');color:#fff;font-weight:650;box-shadow:0 4px 12px -2px ' + tint(BRAND, 55) + '}',
      '.cr-day.is-selected{background:' + tint(BRAND, 12) + '}',
      '.cr-day.is-selected:not(.is-today) .cr-day-num{color:var(' + BRAND + ');font-weight:650}',
      '.cr-dots{display:flex;gap:3px;height:4px}',
      '.cr-dot{width:4px;height:4px;border-radius:50%;background:var(' + BRAND + ')}',
      '.cr-dot.is-late{background:var(' + ERR + ')}',

      /* agenda */
      '.cr-agenda{margin-top:14px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.cr-agenda-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.cr-agenda-day{font-size:13px;font-weight:600}',
      '.cr-pill{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;color:var(' + BRAND + ');background:' + tint(BRAND, 14) + '}',

      /* tabs + groups */
      '.cr-tabs{display:inline-flex;gap:2px;padding:3px;margin-bottom:14px;border-radius:11px;' + GLASS_SOFT + ';border:1px solid var(--lp-glass-edge)}',
      '.cr-tab{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12.5px;font-weight:500;cursor:pointer}',
      '.cr-tab.is-active{background:var(--lp-glass-strong);color:var(--dsw-alias-label-primary);box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 1px 3px ' + tint('--dsw-alias-label-primary', 14) + '}',
      '.cr-tab-n{font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}',
      '.cr-group{margin-bottom:16px}',
      '.cr-group:last-child{margin-bottom:0}',
      '.cr-group-head{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
      '.cr-group-bar{width:3px;height:12px;border-radius:2px;background:var(--dsw-alias-border-l2)}',
      '.cr-group-head.tone-error{color:var(' + ERR + ')}',
      '.cr-group-head.tone-error .cr-group-bar{background:var(' + ERR + ')}',
      '.cr-group-head.tone-brand{color:var(' + BRAND + ')}',
      '.cr-group-head.tone-brand .cr-group-bar{background:var(' + BRAND + ')}',
      '.cr-group-head.tone-idle .cr-group-bar{background:var(' + IDLE + ')}',
      '.cr-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;' + GLASS_SOFT + ';color:var(--dsw-alias-label-secondary)}',
      '.cr-group-list{display:flex;flex-direction:column;gap:2px}',

      /* item */
      '.cr-item{position:relative;display:flex;align-items:flex-start;gap:12px;padding:9px 10px;border-radius:12px;transition:background .12s}',
      '.cr-item:hover{' + GLASS_SOFT + '}',
      '.cr-check{flex:none;width:20px;height:20px;margin-top:1px;padding:0;border-radius:50%;border:1.6px solid var(--dsw-alias-border-l2);background:transparent;color:transparent;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}',
      '.cr-check:hover{border-color:var(' + BRAND + ');color:' + tint(BRAND, 55) + '}',
      '.cr-item.is-today .cr-check{border-color:var(' + BRAND + ')}',
      '.cr-item.is-late .cr-check{border-color:var(' + ERR + ')}',
      '.cr-item.is-done .cr-check{background:var(' + OK + ');border-color:var(' + OK + ');color:#fff}',
      '.cr-item-body{flex:1;min-width:0}',
      '.cr-item-title{font-size:13.5px;line-height:20px;overflow-wrap:anywhere}',
      '.cr-item.is-done .cr-item-title{text-decoration:line-through;color:var(--dsw-alias-label-secondary)}',
      '.cr-item-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:16px}',
      '.cr-chip{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}',
      '.cr-item.is-late .cr-chip{color:var(' + ERR + ')}',
      '.cr-item.is-today .cr-chip{color:var(' + BRAND + ')}',
      '.cr-item-notes{overflow-wrap:anywhere}',
      '.cr-del{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin:-4px -4px 0 0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;transition:opacity .12s}',
      '.cr-item:hover .cr-del,.cr-del:focus-visible{opacity:1}',
      '.cr-del:hover{color:var(' + ERR + ');background:' + tint(ERR, 12) + '}',
      '@media (hover:none){.cr-del{opacity:1}}',

      /* empty + misc */
      '.cr-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 12px;color:var(--dsw-alias-label-secondary);font-size:12.5px;text-align:center}',
      '.cr-empty-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;color:var(' + BRAND + ');background:' + tint(BRAND, 10) + '}',
      '.cr-link{border:0;background:transparent;padding:0;color:inherit;font-weight:600;text-decoration:underline;cursor:pointer}',
      '.cr-hint{display:flex;align-items:center;gap:6px;justify-content:center;margin:22px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '@media (prefers-reduced-motion:reduce){.cr-root *{transition:none!important}}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'calendar-reminders: dictionaries');
        const t = ctx.locale.bind(NS);

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: PANEL_ID, locale: NS,
        }, Panel));

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => t('panel'), locale: NS,
        }, PanelIcon));
      },
    };
  },
});
