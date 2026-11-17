window.__ModuleLoader__.load({
  id: '@local/elans-stack',
  factory(require) {
    /* @kit */
    /* @suite */

    const NS = 'elans-stack';
    const GROUP_ORDER = ['overview', 'personal', 'news', 'settings'];

    const zh = {
      panel: 'ElansStack', overview: '总览', personal: '个人事务', news: '资讯', settings: '设置', tabToday: '今日',
      tabFeatures: '功能', tabSettings: '设置', setNav: '设置项目', ftEyebrow: '显示哪些功能', ftTitle: '功能开关', ftReset: '全部恢复',
      ftIntro: '关掉的功能不再出现在 ElansStack 的标签页和总览里。它们的数据和对话里的工具都不受影响，随时可以再打开。',
      ftCards: '今日总览里的卡片', ftFollows: '（跟随对应功能）', ftFailed: '保存失败：{error}',
      ftNote: '这里只控制 ElansStack 里显示什么。想彻底停用某个插件（比如停掉它的后台任务），请在插件管理里关闭它。',
      ovToday: '今天', ovWeather: '天气', ovTodo: '今日待办', ovTrip: '行程', ovMarket: '全球市场', ovMarketsOpen: '{n} 个市场开市中', ovNews: '资讯', ovNotes: '速记',
      ovOpen: '打开', ovRefresh: '刷新', ovMissing: '这个功能没有启用', ovSave: '保存', ovSaving: '保存中…', ovDone: '完成',
      ovMorning: '早上好', ovAfternoon: '下午好', ovEvening: '晚上好', ovNight: '夜深了',
      ovCityHint: '设置你所在的城市，这里就会显示天气。', ovCityPh: '城市，例如 上海', ovChangeCity: '更换城市', ovWxFail: '天气暂时加载失败。',
      ovFeels: '体感 {n}°', ovHumidity: '湿度 {n}%', ovWind: '风 {n} km/h', ovTomorrow: '明天',
      ovNothingDue: '今天没有待办', ovNext: '下一个：{d} {title}', ovOverdue: '已过期', ovMoreN: '还有 {n} 项',
      ovFocusToday: '专注 {n}/{goal} 个番茄 · {m} 分钟', ovWords: '待复习 {due} · 新词 {fresh}',
      ovTripOn: '旅行第 {n} 天', ovDays: '天后出发', ovWatchEmpty: '还没有关注的标的',
      capPh: '记点什么：一句话、一个链接，或“明天下午3点 看牙”', capSwitch: '点一下或按 Tab 换个地方存', cap_note: '存为笔记', cap_reminder: '存为提醒', cap_reading: '存到稍后读', capDone_note: '已存为笔记', capDone_reminder: '已加提醒：{title} {when}', capDone_reading: '已加到稍后读', capDup: '（之前就存过）',
      ovSessions: 'DSH 会话', ovSesNeed: '{n} 个等你回复', ovSesWait: '等你回复', ovSesRun: '运行中', ovSesDone: '已完成', ovSesIdle: '没有运行中或等你回复的会话', ovUntitled: '未命名会话',
      ovReach: '数据连接', ovSync: '云同步', ovSyncOff: '未连接', ovSyncAt: '{t}同步', ovSyncNever: '还没同步过', ovApi: 'Agent 接口', ovApiOff: '已关闭', ovApiPublic: '公网可用', ovApiLocal: '仅本机', ovTokens: '{n} 个令牌',
      ovAllOff: '总览里的卡片都关掉了，可以在「功能」标签里重新打开。', ovNewVideos: '{n} 个未看新视频', ovUnread: '{n} 篇待读', ovNotePh: '记一条…（回车保存）',
      empty: '没有启用任何面板。',
    };
    const en = {
      panel: 'ElansStack', overview: 'Overview', personal: 'Personal', news: 'Feeds', settings: 'Settings', tabToday: 'Today',
      tabFeatures: 'Features', tabSettings: 'Settings', setNav: 'Settings sections', ftEyebrow: 'What to show', ftTitle: 'Feature switches', ftReset: 'Reset all',
      ftIntro: 'A feature you turn off no longer appears in the ElansStack tabs or the overview. Its data and its chat tool are untouched, and you can turn it back on any time.',
      ftCards: 'Cards on the Today overview', ftFollows: '(follows its feature)', ftFailed: 'Could not save: {error}',
      ftNote: 'This only controls what ElansStack shows. To stop a plugin completely, including its background work, turn it off in the plugin manager.',
      ovToday: 'Today', ovWeather: 'Weather', ovTodo: 'Due today', ovTrip: 'Trip', ovMarket: 'Global markets', ovMarketsOpen: '{n} markets open', ovNews: 'Headlines', ovNotes: 'Quick note',
      ovOpen: 'Open', ovRefresh: 'Refresh', ovMissing: 'This feature is not enabled', ovSave: 'Save', ovSaving: 'Saving…', ovDone: 'Done',
      ovMorning: 'Good morning', ovAfternoon: 'Good afternoon', ovEvening: 'Good evening', ovNight: 'Up late',
      ovCityHint: 'Set your city to see the weather here.', ovCityPh: 'City, e.g. Shanghai', ovChangeCity: 'Change city', ovWxFail: 'Weather could not be loaded right now.',
      ovFeels: 'Feels {n}°', ovHumidity: 'Humidity {n}%', ovWind: 'Wind {n} km/h', ovTomorrow: 'Tomorrow',
      ovNothingDue: 'Nothing due today', ovNext: 'Next: {d} {title}', ovOverdue: 'Overdue', ovMoreN: '{n} more',
      ovFocusToday: 'Focus {n}/{goal} pomodoros · {m} min', ovWords: '{due} to review · {fresh} new',
      ovTripOn: 'Trip day {n}', ovDays: 'days to go', ovWatchEmpty: 'The watchlist is empty',
      capPh: 'Capture anything: a thought, a link, or “tomorrow 3pm dentist”', capSwitch: 'Click or press Tab to save it elsewhere', cap_note: 'as a note', cap_reminder: 'as a reminder', cap_reading: 'to read later', capDone_note: 'Saved as a note', capDone_reminder: 'Reminder added: {title} {when}', capDone_reading: 'Added to the reading list', capDup: '(already saved before)',
      ovSessions: 'DSH sessions', ovSesNeed: '{n} need you', ovSesWait: 'needs you', ovSesRun: 'running', ovSesDone: 'finished', ovSesIdle: 'Nothing running or waiting for you', ovUntitled: 'Untitled session',
      ovReach: 'Data access', ovSync: 'Cloud sync', ovSyncOff: 'not connected', ovSyncAt: 'synced {t}', ovSyncNever: 'never synced', ovApi: 'Agent API', ovApiOff: 'off', ovApiPublic: 'public URL on', ovApiLocal: 'local only', ovTokens: '{n} tokens',
      ovAllOff: 'All overview cards are off. Turn them back on in the Features tab.', ovNewVideos: '{n} new videos', ovUnread: '{n} to read', ovNotePh: 'Jot something… (Enter to save)',
      empty: 'No panels are enabled.',
    };

    Object.assign(zh, { dateLocale: 'zh-CN', justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前' });
    Object.assign(en, { dateLocale: 'en-US', justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago' });
    Object.assign(ICONS, {
      yt: ['M3 8.5a3.5 3.5 0 0 1 3.5-3.5h11A3.5 3.5 0 0 1 21 8.5v7a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 15.5z', 'M10 9.2v5.6l4.8-2.8z'],
      chart: ['M4 19V5', 'M4 19h16', 'M7 15l3.5-4 3 2.5L19 7'],
      globe: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18', 'M12 3c2.5 3 2.5 15 0 18', 'M12 3c-2.5 3-2.5 15 0 18'],
      home: ['M4 11l8-7 8 7', 'M6 10v9a1 1 0 0 0 1 1h3.5v-5h3V20H17a1 1 0 0 0 1-1v-9'],
    });

    /* @include features.js */
    /* @include overview.js */

    /** All member panels, overview first, then personal, each group in its own order. */
    const HIDE_FROM_SETTINGS = ['elans-overview', 'elans-features'];
    const members = () => Object.values(lifeReg().panels)
      .filter((p) => GROUP_ORDER.includes(p.group) && !isOff(p.id))
      .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || ((a.order || 0) - (b.order || 0)));
    const labelOf = (p) => (typeof p.label === 'function' ? p.label() : p.label || p.id);
    const SETTINGS_TAB = 'elans-settings';
    const SETTINGS_LS = 'elans-stack.settings';
    const isSetting = (m) => m.group === 'settings';
    /** The tab bar: every member except the settings ones, which share one Settings tab at the end. */
    function barTabs() {
      const all = members();
      const out = all.filter((m) => !isSetting(m));
      const inner = all.filter(isSetting);
      if (inner.length) out.push({ id: SETTINGS_TAB, group: 'settings', order: 0, label: () => TT('tabSettings'), icon: PanelGlyph('settings'), render: (p) => h(SettingsPage, p), inner });
      return out;
    }
    let TT = (k) => k; // the hub's translator, set when the panel renders

    /** Re-render when members come or go, or a member asks for a tab. */
    function useRegistry() {
      const [, setN] = useState(0);
      useEffect(() => { const reg = lifeReg(); const f = () => setN((n) => n + 1); reg.subs.add(f); return () => { reg.subs.delete(f); }; }, []);
    }
    function savedTab() {
      let id = lifeReg().tab;
      if (!id) { try { id = localStorage.getItem('elans-stack.tab') || ''; } catch { id = ''; } }
      return id;
    }
    function currentTab(list) {
      const id = savedTab();
      // A deep link to one settings panel (cloud-sync, agent-api, …) lands on the Settings tab.
      const tab = list.find((m) => m.id === id) || list.find((m) => m.inner && m.inner.some((x) => x.id === id));
      return tab ? tab.id : (list[0] && list[0].id) || '';
    }
    function currentSetting(inner) {
      const id = savedTab();
      if (inner.some((x) => x.id === id)) return id;
      let sub = ''; try { sub = localStorage.getItem(SETTINGS_LS) || ''; } catch { sub = ''; }
      return inner.some((x) => x.id === sub) ? sub : inner[0].id;
    }
    function pickTab(id) {
      if (id === SETTINGS_TAB) {
        // The bar's Settings tab: reopen the settings panel used last.
        let sub = ''; try { sub = localStorage.getItem(SETTINGS_LS) || ''; } catch { sub = ''; }
        id = lifeReg().panels[sub] && isSetting(lifeReg().panels[sub]) ? sub : (members().find(isSetting) || {}).id || id;
      }
      const entry = lifeReg().panels[id];
      if (entry && isSetting(entry)) { try { localStorage.setItem(SETTINGS_LS, id); } catch { /* storage blocked */ } }
      lifeReg().tab = id;
      try { localStorage.setItem('elans-stack.tab', id); } catch { /* storage blocked */ }
      lifeNotify();
    }

    /** One Settings page: the panels of the settings group as a list on the left (a strip on narrow screens). */
    function SettingsPage(props) {
      const { t: _t, ...rest } = props;
      useRegistry();
      const inner = members().filter(isSetting);
      if (!inner.length) return null;
      const active = currentSetting(inner);
      const current = inner.find((x) => x.id === active);
      return h('div', { className: 'st-page' },
        h('nav', { className: 'st-nav', role: 'tablist', 'aria-label': TT('setNav') }, inner.map((x) => h('button', {
          key: x.id, type: 'button', role: 'tab', 'aria-selected': active === x.id, className: 'st-item' + (active === x.id ? ' is-active' : ''), onClick: () => pickTab(x.id),
        }, h('span', { className: 'st-ico' }, h(x.icon, { size: 16, active: active === x.id })), h('span', { className: 'st-name' }, labelOf(x))))),
        h('div', { className: 'st-body' }, current ? h(React.Fragment, { key: current.id }, current.render(rest)) : null));
    }

    function HubPanel(props) {
      const t = props.t || ((k) => k);
      const { t: _t, ...rest } = props;
      useRegistry();
      TT = t;
      const list = barTabs();
      const active = currentTab(list);
      const current = list.find((m) => m.id === active);
      const onKey = (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = list.findIndex((m) => m.id === active);
        const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
        if (next) pickTab(next.id);
      };
      const tabs = [];
      list.forEach((m, i) => {
        if (i > 0 && list[i - 1].group !== m.group) tabs.push(h('span', { key: 'sep-' + m.group, className: 'lh-sep', role: 'separator', 'aria-label': t(m.group) }));
        tabs.push(h('button', {
          key: m.id, type: 'button', role: 'tab', 'aria-selected': active === m.id, tabIndex: active === m.id ? 0 : -1,
          title: t(m.group) + ' · ' + labelOf(m),
          className: 'lh-tab' + (active === m.id ? ' is-active' : ''), onClick: () => pickTab(m.id),
        }, h('span', { className: 'lh-tab-ico' }, h(m.icon, { size: 15, active: active === m.id })), h('span', null, labelOf(m))));
      });
      return h('div', { className: 'lh-hub' },
        h('style', null, KIT_CSS + HUB_CSS),
        list.length ? h('nav', { className: 'lh-bar', role: 'tablist', onKeyDown: onKey }, tabs) : null,
        h('div', { className: 'lh-body' },
          h('div', { className: 'lh-body-in' },
            current ? h(React.Fragment, { key: current.id }, current.render(rest))
              : h('div', { className: 'lp-root' }, h('div', { className: 'lp-inner' }, h(Empty, { icon: 'sparkle', text: t('empty') }))))));
    }

    /** Sidebar glyph with a dot while a member reports activity (timer running, audio playing). */
    function HubGlyph(props) {
      const [, setN] = useState(0);
      const sig = members().map((m) => m.id).join(',');
      useEffect(() => {
        const reg = lifeReg();
        const f = () => setN((n) => n + 1);
        reg.subs.add(f);
        const offs = members().filter((m) => m.badge).map((m) => m.badge.subscribe(f));
        return () => { reg.subs.delete(f); offs.forEach((o) => { if (typeof o === 'function') o(); }); };
      }, [sig]);
      const tones = members().map((m) => (m.badge ? m.badge.tone() : null)).filter(Boolean);
      const tone = tones.includes('err') ? 'err' : tones.includes('ok') ? 'ok' : tones.includes('brand') ? 'brand' : null;
      return h('span', { className: 'lh-glyph' }, h(Icon, { name: 'home', size: props.size || 18, stroke: props.active ? 2 : 1.6 }),
        tone ? h('i', { className: 'lh-dot is-' + tone }) : null);
    }

    const HUB_CSS = [
      '.lh-hub{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base,#fff)}',
      '.lh-bar{flex:none;display:flex;gap:4px;padding:8px 16px;overflow-x:auto;border-bottom:1px solid ' + B1 + ';scrollbar-width:none}',
      '.lh-bar::-webkit-scrollbar{display:none}',
      '.lh-tab{flex:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:' + FG2 + ';font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap}',
      '.lh-tab:hover{color:' + FG + '}',
      '.lh-tab:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:1px}',
      '.lh-tab.is-active{color:var(' + BRAND + ');background:' + tint(BRAND, 14) + ';font-weight:600}',
      '.lh-tab-ico{display:inline-flex}',
      '.st-page{display:flex;height:100%;min-height:0}',
      '.st-nav{flex:none;width:200px;display:flex;flex-direction:column;gap:2px;padding:14px 8px 14px 14px;border-right:1px solid ' + B1 + ';overflow-y:auto}',
      '.st-item{display:flex;align-items:center;gap:10px;height:36px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:' + FG2 + ';font:inherit;font-size:13.5px;text-align:left;cursor:pointer}',
      '.st-item:hover{color:' + FG + '}',
      '.st-item:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:1px}',
      '.st-item.is-active{color:var(' + BRAND + ');background:' + tint(BRAND, 14) + ';font-weight:600}',
      '.st-ico{display:inline-flex}',
      '.st-body{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}',
      '.st-body > *{flex:1;min-height:0}',
      '@media (max-width:720px){.st-page{flex-direction:column}.st-nav{width:auto;flex-direction:row;padding:8px 12px;border-right:0;border-bottom:1px solid ' + B1 + ';overflow-x:auto;overflow-y:hidden}.st-item{flex:none;height:30px}}',
      '.lh-sep{flex:none;width:1px;height:18px;align-self:center;margin:0 6px;background:' + B2 + '}',
      '.lh-body{flex:1;min-height:0;position:relative}',
      '.lh-body-in{position:absolute;inset:0;display:flex;flex-direction:column;min-height:0}',
      '.lh-body-in > *{flex:1;min-height:0}',
      '.lh-glyph{position:relative;display:inline-flex}',
      '.lh-dot{position:absolute;top:-1px;right:-2px;width:7px;height:7px;border-radius:50%;background:var(' + BRAND + ');box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base))}',
      '.lh-dot.is-err{background:var(' + ERR + ')}',
      '.lh-dot.is-ok{background:var(' + OK + ')}',
    ].join('');

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'elans-stack: dictionaries');
        const t = ctx.locale.bind(NS);
        // While this plugin is active the members hand their sidebar icons over to this one entry.
        ctx.effect(() => {
          const reg = lifeReg(); reg.suite += 1; lifeNotify();
          return () => { reg.suite -= 1; lifeNotify(); };
        }, 'elans-stack: take over member icons');
        // The overview is the hub's own first tab; it joins the same registry the member panels use.
        ctx.effect(() => {
          const reg = lifeReg();
          const entry = { id: 'elans-overview', group: 'overview', order: 0, label: () => t('tabToday'), icon: PanelGlyph('home'), render: (p) => h(Overview, { ...p, t, openSession: (id) => { let ws = null; try { ws = ctx.get('uiWorkspace'); } catch { ws = null; } if (ws) { try { ws.openSession(id); } catch { /* gone */ } } }, go: (id) => {
            // A hub member opens as a tab; anything else (the iCafe panel) opens as its own panel.
            if (lifeReg().panels[id] && !isOff(id)) { pickTab(id); return; }
            let layout = null; try { layout = ctx.get('layout'); } catch { layout = null; }
            if (layout) { try { layout.selectPanel(id); } catch { /* not registered */ } }
          } }) };
          reg.panels[entry.id] = entry; lifeNotify();
          return () => { if (reg.panels[entry.id] === entry) delete reg.panels[entry.id]; lifeNotify(); };
        }, 'elans-stack: overview tab');
        ctx.effect(() => {
          const reg = lifeReg();
          const entry = { id: 'elans-features', group: 'settings', order: 99, label: () => t('tabFeatures'), icon: PanelGlyph('settings'), render: (p) => h(FeaturesPanel, { ...p, t }) };
          reg.panels[entry.id] = entry; lifeNotify();
          return () => { if (reg.panels[entry.id] === entry) delete reg.panels[entry.id]; lifeNotify(); };
        }, 'elans-stack: features tab');
        // Load the stored switches once; until they arrive the local copy keeps the tabs from flashing.
        ctx.effect(() => { loadFeatureSettings(); }, 'elans-stack: feature settings');
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: LIFE_PANEL, locale: NS }, HubPanel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: LIFE_PANEL, order: 20, label: () => t('panel'), locale: NS,
        }, HubGlyph));
      },
    };
  },
});
