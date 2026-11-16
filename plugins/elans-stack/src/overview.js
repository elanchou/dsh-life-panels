    /* ===== Today overview: reads the member panels' own routes, so it shows whatever is enabled ===== */
    const ovCal = makeCall('/plugin-api/calendar-reminders');
    const ovFocus = makeCall('/plugin-api/focus');
    const ovVocab = makeCall('/plugin-api/vocabulary');
    const ovNews = makeCall('/plugin-api/news-feeds');
    const ovTube = makeCall('/plugin-api/youtube');
    const ovRead = makeCall('/plugin-api/reading-list');
    const ovMarket = makeCall('/plugin-api/market');
    const ovNotes = makeCall('/plugin-api/notes');
    const ovTrips = makeCall('/plugin-api/travel-planner');
    const ovSelf = makeCall('/plugin-api/elans-stack');
    const ovIcafe = makeCall('/plugin-api/icafe-workflow');
    const ovDevloop = makeCall('/plugin-api/ios-devloop');
    const ovAgent = makeCall('/plugin-api/agent-api');
    const ovSync = makeCall('/plugin-api/cloud-sync');

    /** A member that is not installed answers 404; that hides its card instead of showing an error. */
    async function settle(p) {
      try { return { ok: true, data: await p }; } catch (e) { return { ok: false, missing: e.status === 404, error: e.message }; }
    }
    const WX = [[0, '☀️'], [2, '⛅'], [3, '☁️'], [48, '🌫️'], [57, '🌦️'], [67, '🌧️'], [77, '🌨️'], [82, '🌧️'], [86, '🌨️'], [99, '⛈️']];
    const wxIcon = (code) => { for (const [max, icon] of WX) if (code <= max) return icon; return '🌡️'; };
    const marketColors = () => { try { return localStorage.getItem('market.colors') === 'us' ? 'us' : 'cn'; } catch { return 'cn'; } };
    const signed = (n) => (n > 0 ? '+' : '') + n.toFixed(2);

    function OvCard(props) {
      const { icon, title, onOpen, openLabel, children, wide } = props;
      return h('section', { className: 'lp-card ov-card' + (wide ? ' is-wide' : '') },
        h('div', { className: 'ov-card-head' },
          h('h3', { className: 'lp-card-title' }, h(Icon, { name: icon, className: 'lp-ico' }), title),
          onOpen ? h('button', { type: 'button', className: 'lp-ghost ov-open', onClick: onOpen }, openLabel, h(Icon, { name: 'right', size: 12 })) : null),
        children);
    }

    function WeatherCard(props) {
      const { t, res, onSaved } = props;
      const [city, setCity] = useState('');
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState(null);
      const [editing, setEditing] = useState(false);
      const save = async (e) => {
        e.preventDefault();
        setBusy(true); setErr(null);
        try { await ovSelf({ action: 'set_city', city: city.trim() }); setEditing(false); onSaved(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
      };
      const d = res && res.ok ? res.data : null;
      const w = d && d.weather;
      const form = h('form', { className: 'ov-city', onSubmit: save },
        h('input', { className: 'ov-input', value: city, onChange: (e) => setCity(e.target.value), placeholder: t('ovCityPh'), 'aria-label': t('ovCityPh'), autoFocus: true }),
        h('button', { type: 'submit', className: 'lp-primary', disabled: busy || !city.trim() }, busy ? t('ovSaving') : t('ovSave')),
        err ? h('div', { className: 'ov-err' }, err) : null);
      return h(OvCard, { icon: 'sun', title: t('ovWeather') + (d && d.city ? ' · ' + d.city : '') },
        !res ? h('div', { className: 'lp-skel', style: { height: 88, borderRadius: 12 } })
          : !d || !d.location || editing ? h('div', null, h('p', { className: 'lp-muted ov-p' }, t('ovCityHint')), form)
            : !w ? h('div', { className: 'lp-muted ov-p' }, t('ovWxFail'), ' ', h('button', { type: 'button', className: 'lp-link', onClick: () => setEditing(true) }, t('ovChangeCity')))
              : h(React.Fragment, null,
                h('div', { className: 'ov-wx-now' },
                  h('span', { className: 'ov-wx-ico' }, wxIcon(w.now.code)),
                  h('span', { className: 'ov-wx-temp' }, Math.round(w.now.temp) + '°'),
                  h('span', { className: 'ov-wx-meta lp-muted' }, t('ovFeels', { n: Math.round(w.now.feels) }), ' · ', t('ovHumidity', { n: w.now.humidity }), ' · ', t('ovWind', { n: Math.round(w.now.wind) }))),
                h('div', { className: 'ov-wx-days' }, w.days.slice(0, 4).map((x, i) => h('div', { key: x.date, className: 'ov-wx-day' },
                  h('span', { className: 'lp-muted' }, i === 0 ? t('ovToday') : i === 1 ? t('ovTomorrow') : fmtDate(x.date, t('dateLocale'), { weekday: 'short' })),
                  h('span', { className: 'ov-wx-dico' }, wxIcon(x.code)),
                  h('span', null, Math.round(x.max) + '° / ' + Math.round(x.min) + '°'),
                  x.rain >= 30 ? h('span', { className: 'ov-rain' }, x.rain + '%') : null))),
                h('button', { type: 'button', className: 'lp-link ov-change', onClick: () => setEditing(true) }, t('ovChangeCity'))));
    }

    function TodayCard(props) {
      const { t, cal, focus, vocab, go, reload } = props;
      const [busyId, setBusyId] = useState(null);
      const items = cal && cal.ok ? (cal.data.items || []) : [];
      const today = cal && cal.ok ? cal.data.today : '';
      const due = items.filter((i) => i.date && i.date <= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      const next = items.filter((i) => i.date && i.date > today).sort((a, b) => a.date.localeCompare(b.date))[0];
      const complete = async (id) => { setBusyId(id); try { await ovCal({ action: 'complete', id }); await reload(); } catch { /* the next refresh shows the truth */ } finally { setBusyId(null); } };
      const f = focus && focus.ok ? focus.data : null;
      const v = vocab && vocab.ok ? vocab.data : null;
      return h(OvCard, { icon: 'calendar', title: t('ovTodo'), onOpen: () => go('calendar-reminders'), openLabel: t('ovOpen') },
        !cal ? h('div', { className: 'lp-skel', style: { height: 70, borderRadius: 12 } })
          : !cal.ok ? h('div', { className: 'lp-muted ov-p' }, cal.missing ? t('ovMissing') : cal.error)
            : due.length ? h('ul', { className: 'ov-list' }, due.slice(0, 6).map((i) => h('li', { key: i.id, className: 'ov-todo' + (i.date < today ? ' is-late' : '') },
              h('button', { type: 'button', className: 'ov-check', disabled: busyId === i.id, onClick: () => complete(i.id), 'aria-label': t('ovDone') + ' ' + i.title, title: t('ovDone') }),
              h('span', { className: 'ov-todo-t' }, i.title),
              h('span', { className: 'lp-muted ov-todo-d' }, i.date < today ? t('ovOverdue') : i.time || ''))))
              : h('div', { className: 'lp-muted ov-p' }, t('ovNothingDue'), next ? ' · ' + t('ovNext', { d: fmtDate(next.date, t('dateLocale')), title: next.title }) : ''),
        due.length > 6 ? h('div', { className: 'lp-muted ov-p' }, t('ovMoreN', { n: due.length - 6 })) : null,
        h('div', { className: 'ov-chips' },
          f ? h('button', { type: 'button', className: 'ov-chip', onClick: () => go('focus') }, h(Icon, { name: 'clock', size: 13 }),
            t('ovFocusToday', { n: f.stats.today.count, goal: f.stats.today.goal, m: f.stats.today.minutes })) : null,
          v ? h('button', { type: 'button', className: 'ov-chip' + (v.due ? ' is-hot' : ''), onClick: () => go('vocabulary') }, h(Icon, { name: 'book', size: 13 }),
            t('ovWords', { due: v.due, fresh: v.newRemaining })) : null));
    }

    function TripCard(props) {
      const { t, res, go } = props;
      const today = (() => { const d = new Date(); return ymd(d); })();
      const trips = res && res.ok ? (res.data.trips || []) : [];
      const active = trips.find((x) => x.startDate <= today && x.endDate >= today);
      const upcoming = trips.filter((x) => x.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      const trip = active || upcoming;
      if (!trip) return null;
      const days = dayDiff(trip.startDate, today);
      return h(OvCard, { icon: 'plane', title: t('ovTrip'), onOpen: () => go('travel-planner'), openLabel: t('ovOpen') },
        h('div', { className: 'ov-trip' },
          h('div', { className: 'ov-trip-main' }, h('b', null, trip.name || trip.destination), h('span', { className: 'lp-muted' }, fmtDate(trip.startDate, t('dateLocale')) + ' – ' + fmtDate(trip.endDate, t('dateLocale')))),
          h('div', { className: 'ov-trip-count' }, active ? h('span', null, t('ovTripOn', { n: dayDiff(today, trip.startDate) + 1 })) : h(React.Fragment, null, h('b', null, days), h('span', null, t('ovDays'))))));
    }

    function MarketCard(props) {
      const { t, res, go } = props;
      const d = res && res.ok ? res.data : null;
      const colors = marketColors();
      const cls = (n) => (n > 0 ? 'is-up' : n < 0 ? 'is-down' : '');
      const idx = d ? d.indices.filter((i) => i.quote).slice(0, 3) : [];
      const movers = d ? d.items.filter((i) => i.quote && i.quote.pct !== null).sort((a, b) => Math.abs(b.quote.pct) - Math.abs(a.quote.pct)).slice(0, 4) : [];
      return h(OvCard, { icon: 'chart', title: t('ovMarket'), onOpen: () => go('market'), openLabel: t('ovOpen') },
        !res ? h('div', { className: 'lp-skel', style: { height: 88, borderRadius: 12 } })
          : !res.ok ? h('div', { className: 'lp-muted ov-p' }, res.missing ? t('ovMissing') : res.error)
            : h('div', { className: 'ov-mk is-' + colors },
              h('div', { className: 'ov-mk-idx' }, idx.map((i) => h('div', { key: i.key, className: 'ov-mk-i ' + cls(i.quote.pct) }, h('span', { className: 'lp-muted' }, i.name), h('b', null, i.quote.price.toFixed(2)), h('span', null, signed(i.quote.pct) + '%')))),
              movers.length ? h('ul', { className: 'ov-list' }, movers.map((i) => h('li', { key: i.key, className: 'ov-mk-row ' + cls(i.quote.pct) }, h('span', null, i.name), h('span', null, i.quote.price.toFixed(2)), h('b', null, signed(i.quote.pct) + '%'))))
                : h('div', { className: 'lp-muted ov-p' }, t('ovWatchEmpty'))));
    }

    function FeedsCard(props) {
      const { t, news, tube, read, go } = props;
      const items = news && news.ok ? (news.data.items || []).slice(0, 5) : [];
      const newVideos = tube && tube.ok ? (tube.data.channels || []).reduce((a, c) => a + (c.newCount || 0), 0) : null;
      const unread = read && read.ok ? (read.data.counts || {}).unread : null;
      return h(OvCard, { icon: 'rss', title: t('ovNews'), onOpen: () => go('news-feeds'), openLabel: t('ovOpen'), wide: true },
        !news ? h('div', { className: 'lp-skel', style: { height: 120, borderRadius: 12 } })
          : !news.ok ? h('div', { className: 'lp-muted ov-p' }, news.missing ? t('ovMissing') : news.error)
            : h('ul', { className: 'ov-news' }, items.map((n) => h('li', { key: n.id },
              h('a', { href: n.link, target: '_blank', rel: 'noopener noreferrer', title: n.title }, n.title),
              h('span', { className: 'lp-muted' }, n.source + (n.publishedAt ? ' · ' + ago(n.publishedAt, t) : ''))))),
        h('div', { className: 'ov-chips' },
          newVideos !== null ? h('button', { type: 'button', className: 'ov-chip' + (newVideos ? ' is-hot' : ''), onClick: () => go('youtube') }, h(Icon, { name: 'yt', size: 13 }), t('ovNewVideos', { n: newVideos })) : null,
          unread !== null && unread !== undefined ? h('button', { type: 'button', className: 'ov-chip', onClick: () => go('reading-list') }, h(Icon, { name: 'book', size: 13 }), t('ovUnread', { n: unread })) : null));
    }

    function NotesCard(props) {
      const { t, res, go, reload } = props;
      const [draft, setDraft] = useState('');
      const [busy, setBusy] = useState(false);
      const add = async (e) => {
        e.preventDefault();
        const body = draft.trim();
        if (!body || busy) return;
        setBusy(true);
        try { await ovNotes({ action: 'add', body }); setDraft(''); await reload(); } catch { /* the notes tab reports errors in detail */ } finally { setBusy(false); }
      };
      const items = res && res.ok ? (res.data.items || []).slice(0, 4) : [];
      return h(OvCard, { icon: 'note', title: t('ovNotes'), onOpen: () => go('notes'), openLabel: t('ovOpen') },
        res && !res.ok ? h('div', { className: 'lp-muted ov-p' }, res.missing ? t('ovMissing') : res.error) : h(React.Fragment, null,
          h('form', { className: 'ov-city', onSubmit: add },
            h('input', { className: 'ov-input', value: draft, onChange: (e) => setDraft(e.target.value), placeholder: t('ovNotePh'), 'aria-label': t('ovNotePh'), maxLength: 2000 }),
            h('button', { type: 'submit', className: 'lp-primary', disabled: !draft.trim() || busy }, t('ovSave'))),
          !res ? h('div', { className: 'lp-skel', style: { height: 60, borderRadius: 12, marginTop: 8 } })
            : items.length ? h('ul', { className: 'ov-list ov-notes' }, items.map((n) => h('li', { key: n.id, className: n.pinned ? 'is-pinned' : '' },
              h('span', null, n.title || n.body.split('\n').map((l) => l.replace(/^\s*(#{1,4}|[-*+]|\d+[.)]|>)\s*(\[[ xX]\]\s*)?/, '').trim()).find(Boolean) || ''),
              n.tasks && n.tasks.total ? h('span', { className: 'lp-muted' }, n.tasks.done + '/' + n.tasks.total) : null,
              h('span', { className: 'lp-muted' }, ago(n.updatedAt, t)))))
              : null));
    }

    /**
     * Work: the iCafe requirements you registered (child-card progress, no network call) and running iOS R&D loop
     * jobs. Bugs are not fetched here because that queries several iCafe spaces; the iCafe tab has them.
     */
    function WorkCard(props) {
      const { t, icafe, loops, go } = props;
      if (!icafe || (!icafe.ok && icafe.missing)) return null;
      const reqs = icafe.ok ? (icafe.data.requirements || []).filter((r) => !r.cardFinished) : [];
      const runs = loops && loops.ok ? (loops.data.runs || []).filter((r) => r.status === 'running') : [];
      return h(OvCard, { icon: 'bug', title: t('ovWork'), onOpen: () => go('icafe-workflow'), openLabel: t('ovOpen') },
        !icafe.ok ? h('div', { className: 'lp-muted ov-p' }, icafe.error)
          : !reqs.length ? h('div', { className: 'lp-muted ov-p' }, t('ovNoReqs'))
            : h('ul', { className: 'ov-list' }, reqs.slice(0, 5).map((r) => {
              const pct = r.childTotal ? Math.round((r.childDone / r.childTotal) * 100) : 0;
              return h('li', { key: r.id, className: 'ov-req' },
                h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', title: r.title }, r.title),
                h('span', { className: 'ov-bar', title: r.childDone + '/' + r.childTotal }, h('i', { style: { width: pct + '%' } })),
                h('span', { className: 'lp-muted ov-req-n' }, r.childTotal ? r.childDone + '/' + r.childTotal : (r.cardStatus || '')));
            })),
        runs.length ? h('div', { className: 'ov-chips' }, h('span', { className: 'ov-chip is-hot' }, h(Icon, { name: 'refresh', size: 13, className: 'lp-spin' }), t('ovLoops', { n: runs.length }))) : null);
    }

    /** Where the data can be reached from: cloud sync and the Agent API, so a broken link is noticed. */
    function ReachCard(props) {
      const { t, sync, agent, go } = props;
      const sy = sync && sync.ok ? sync.data : null;
      const ag = agent && agent.ok ? agent.data.api : null;
      if (!sy && !ag) return null;
      const row = (ok, label, detail, id) => h('li', { className: 'ov-reach' }, h('i', { className: 'ov-dot ' + (ok === null ? '' : ok ? 'is-ok' : 'is-bad') }),
        h('button', { type: 'button', className: 'lp-link', onClick: () => go(id) }, label), h('span', { className: 'lp-muted' }, detail));
      return h(OvCard, { icon: 'globe', title: t('ovReach') },
        h('ul', { className: 'ov-list' },
          sy ? row(sy.connected ? !sy.lastError : null, t('ovSync'), !sy.connected ? t('ovSyncOff') : sy.lastError ? sy.lastError.slice(0, 80) : sy.lastSyncAt ? t('ovSyncAt', { t: ago(sy.lastSyncAt, t) }) : t('ovSyncNever'), 'cloud-sync') : null,
          ag ? row(ag.enabled ? (ag.running && !ag.error) : null, t('ovApi'), !ag.enabled ? t('ovApiOff') : (ag.tunnel.url ? t('ovApiPublic') : t('ovApiLocal')) + ' · ' + t('ovTokens', { n: ag.tokens.length }), 'agent-api') : null));
    }

    /**
     * Quick capture: one box for everything. The host decides where it goes (link -> reading list, date/time ->
     * reminder, otherwise a note); a preview chip shows the destination while typing and a click switches it.
     */
    const CAP_TARGETS = ['note', 'reminder', 'reading'];
    function CaptureBar(props) {
      const { t, onSaved, go } = props;
      const [text, setText] = useState('');
      const [guess, setGuess] = useState(null);
      const [forced, setForced] = useState(null);
      const [busy, setBusy] = useState(false);
      const [done, setDone] = useState(null);
      const [err, setErr] = useState(null);
      useEffect(() => {
        const v = text.trim();
        if (!v) { setGuess(null); setForced(null); return undefined; }
        const id = setTimeout(async () => { try { const r = await ovSelf({ action: 'capture', text: v, preview: true }); setGuess(r.preview); } catch { setGuess(null); } }, 220);
        return () => clearTimeout(id);
      }, [text]);
      const target = forced || (guess && guess.target) || 'note';
      const save = async (e) => {
        e.preventDefault();
        const v = text.trim();
        if (!v || busy) return;
        setBusy(true); setErr(null);
        try {
          const r = await ovSelf({ action: 'capture', text: v, ...(forced ? { target: forced } : {}) });
          setDone(r); setText(''); setForced(null); onSaved();
          setTimeout(() => setDone((d) => (d === r ? null : d)), 6000);
        } catch (x) { setErr(x.message); } finally { setBusy(false); }
      };
      const cycle = () => setForced(CAP_TARGETS[(CAP_TARGETS.indexOf(target) + 1) % CAP_TARGETS.length]);
      const when = guess && target === 'reminder' && !forced && guess.date ? ' · ' + fmtDate(guess.date, t('dateLocale'), { month: 'short', day: 'numeric', weekday: 'short' }) + (guess.time ? ' ' + guess.time : '') : '';
      const plugin = { note: 'notes', reminder: 'calendar-reminders', reading: 'reading-list' };
      return h('form', { className: 'ov-cap', onSubmit: save },
        h('span', { className: 'ov-cap-ico' }, h(Icon, { name: 'plus', size: 16 })),
        h('input', {
          className: 'ov-cap-in', value: text, onChange: (e) => { setText(e.target.value); setDone(null); }, placeholder: t('capPh'), 'aria-label': t('capPh'), maxLength: 4000,
          onKeyDown: (e) => { if (e.key === 'Tab' && text.trim() && !e.shiftKey) { e.preventDefault(); cycle(); } },
        }),
        text.trim() ? h('button', { type: 'button', className: 'ov-cap-tgt is-' + target, onClick: cycle, title: t('capSwitch') }, t('cap_' + target) + when) : null,
        h('button', { type: 'submit', className: 'lp-primary ov-cap-go', disabled: !text.trim() || busy }, busy ? t('ovSaving') : t('ovSave')),
        err ? h('div', { className: 'ov-err ov-cap-msg' }, err) : null,
        done ? h('div', { className: 'ov-cap-msg lp-muted' }, h(Icon, { name: 'check', size: 13 }), ' ', t('capDone_' + done.target, { title: done.saved.title || '', when: done.saved.date ? fmtDate(done.saved.date, t('dateLocale'), { month: 'short', day: 'numeric' }) + (done.saved.time ? ' ' + done.saved.time : '') : '' }),
          done.duplicate ? ' ' + t('capDup') : '', ' ', h('button', { type: 'button', className: 'lp-link', onClick: () => go(plugin[done.target]) }, t('ovOpen'))) : null);
    }

    /**
     * DSH sessions that need Elan: waiting for an answer, still running, or finished while he looked elsewhere.
     * Reads the standard useSessions / useSessionStatus props the main slot provides; absent (e.g. on the iPad
     * LAN page) the card is not shown.
     */
    const EMPTY_LIST = { ids: [], byId: {} };
    const sameKeys = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    function SessionsCard(props) {
      const { t, useSessions, useSessionStatus, openSession } = props;
      const rows = useSessions((s) => {
        const st = s || EMPTY_LIST;
        return st.ids.map((id) => st.byId[id]).filter((r) => r && !r.blank && r.origin !== 'subagent' && !r.parentId)
          .map((r) => r.id + '|' + (r.running ? 1 : 0) + '|' + r.updatedAt + '|' + (r.displayTitle || r.title || ''));
      }, sameKeys);
      const statusKeys = useSessionStatus((m) => {
        const out = [];
        if (m && typeof m.forEach === 'function') m.forEach((v, id) => { if (v && (v.pendingInteraction || v.completionUnread || v.running)) out.push(id + '|' + (v.pendingInteraction ? 'w' : v.running ? 'r' : 'u')); });
        return out.sort();
      }, sameKeys);
      const status = new Map(statusKeys.map((k) => { const i = k.lastIndexOf('|'); return [k.slice(0, i), k.slice(i + 1)]; }));
      const list = rows.map((k) => { const [id, run, at, ...title] = k.split('|'); return { id, running: run === '1', at: Number(at), title: title.join('|') }; });
      const waiting = list.filter((r) => status.get(r.id) === 'w');
      const running = list.filter((r) => status.get(r.id) !== 'w' && (status.get(r.id) === 'r' || r.running));
      const unread = list.filter((r) => status.get(r.id) === 'u');
      const shown = [...waiting.map((r) => [r, 'w']), ...running.map((r) => [r, 'r']), ...unread.map((r) => [r, 'u'])].slice(0, 6);
      const recent = shown.length ? [] : list.slice().sort((a, b) => b.at - a.at).slice(0, 3);
      const item = ([r, kind]) => h('li', { key: r.id, className: 'ov-ses' },
        h('i', { className: 'ov-dot ' + (kind === 'w' ? 'is-bad' : kind === 'r' ? 'is-run' : kind === 'u' ? 'is-ok' : '') }),
        h('button', { type: 'button', className: 'ov-ses-t', onClick: () => openSession(r.id), title: r.title }, r.title || t('ovUntitled')),
        h('span', { className: 'lp-muted ov-ses-k' }, kind === 'w' ? t('ovSesWait') : kind === 'r' ? t('ovSesRun') : kind === 'u' ? t('ovSesDone') : ago(new Date(r.at).toISOString(), t)));
      return h(OvCard, { icon: 'sparkle', title: t('ovSessions') + (waiting.length ? ' · ' + t('ovSesNeed', { n: waiting.length }) : '') },
        shown.length ? h('ul', { className: 'ov-list' }, shown.map(item))
          : h(React.Fragment, null, h('div', { className: 'lp-muted ov-p' }, t('ovSesIdle')), recent.length ? h('ul', { className: 'ov-list' }, recent.map((r) => item([r, '']))) : null));
    }

    function Overview(props) {
      const { t, go } = props;
      const [s, setS] = useState({});
      const alive = useRef(true);
      const sig = [...disabledSet()].sort().join(',');
      const load = useCallback(async (refresh) => {
        // A feature that is switched off is not even asked for its data.
        const ask = (id, fn) => (isOff(id) ? Promise.resolve({ ok: false, missing: true }) : settle(fn()));
        const r = await Promise.all([
          cardOn('weather') ? settle(ovSelf({ action: 'weather', refresh: !!refresh })) : Promise.resolve({ ok: false, missing: true }),
          ask('calendar-reminders', () => ovCal({ action: 'list', scope: 'open' })), ask('focus', () => ovFocus({ action: 'status' })),
          ask('vocabulary', () => ovVocab({ action: 'status' })), ask('travel-planner', () => ovTrips({ action: 'list_trips' })), ask('market', () => ovMarket({ action: 'quotes' })),
          ask('news-feeds', () => ovNews({ action: 'headlines', limit: 5 })), ask('youtube', () => ovTube({ action: 'channels' })), ask('reading-list', () => ovRead({ action: 'list', status: 'unread' })), ask('notes', () => ovNotes({ action: 'list', limit: 4 })),
          cardOn('work') ? settle(ovIcafe({ action: 'req_list' })) : Promise.resolve({ ok: false, missing: true }),
          cardOn('work') ? settle(ovDevloop({ action: 'list' })) : Promise.resolve({ ok: false, missing: true }),
          cardOn('reach') ? settle(ovSync({ action: 'status' })) : Promise.resolve({ ok: false, missing: true }),
          cardOn('reach') ? settle(ovAgent({ action: 'status' })) : Promise.resolve({ ok: false, missing: true }),
        ]);
        if (alive.current) setS({ wx: r[0], cal: r[1], focus: r[2], vocab: r[3], trips: r[4], market: r[5], news: r[6], tube: r[7], read: r[8], notes: r[9], icafe: r[10], loops: r[11], sync: r[12], agent: r[13] });
      }, [sig]);
      useEffect(() => {
        alive.current = true; load();
        const id = setInterval(() => { if (!document.hidden) load(); }, 60000);
        return () => { alive.current = false; clearInterval(id); };
      }, [load]);
      const hour = new Date().getHours();
      const greet = hour < 6 ? t('ovNight') : hour < 12 ? t('ovMorning') : hour < 18 ? t('ovAfternoon') : t('ovEvening');
      const reload = () => load(false);
      return h('div', { className: 'lp-root ov-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, fmtDate(todayStr(), t('dateLocale'), { month: 'long', day: 'numeric', weekday: 'long' })), h('h1', { className: 'lp-title' }, greet + ', Elan')),
            h('button', { type: 'button', className: 'lp-round', onClick: () => load(true), title: t('ovRefresh'), 'aria-label': t('ovRefresh') }, h(Icon, { name: 'refresh', size: 16 }))),
          h(CaptureBar, { t, go, onSaved: reload }),
          h('div', { className: 'ov-grid' },
            cardOn('sessions') && typeof props.useSessions === 'function' && typeof props.useSessionStatus === 'function' && props.openSession
              ? h(SessionsCard, { t, useSessions: props.useSessions, useSessionStatus: props.useSessionStatus, openSession: props.openSession }) : null,
            cardOn('weather') ? h(WeatherCard, { t, res: s.wx, onSaved: () => load(true) }) : null,
            cardOn('todo') ? h(TodayCard, { t, cal: s.cal, focus: isOff('focus') ? null : s.focus, vocab: isOff('vocabulary') ? null : s.vocab, go, reload }) : null,
            cardOn('work') ? h(WorkCard, { t, icafe: s.icafe, loops: s.loops, go }) : null,
            cardOn('trip') ? h(TripCard, { t, res: s.trips, go }) : null,
            cardOn('market') ? h(MarketCard, { t, res: s.market, go }) : null,
            cardOn('notes') ? h(NotesCard, { t, res: s.notes, go, reload }) : null,
            cardOn('feeds') ? h(FeedsCard, { t, news: s.news, tube: isOff('youtube') ? null : s.tube, read: isOff('reading-list') ? null : s.read, go }) : null,
            cardOn('reach') ? h(ReachCard, { t, sync: s.sync, agent: s.agent, go }) : null,
            OV_CARDS.every(([id]) => !cardOn(id)) ? h('div', { className: 'lp-card' }, h(Empty, { icon: 'sparkle', text: t('ovAllOff') })) : null)),
        h('style', null, KIT_CSS + OV_CSS));
    }

    const OV_CSS = [
      '.ov-root{--lp-amb-a:var(' + BRAND + ');--lp-amb-b:var(' + WARN + ');--lp-amb-c:var(' + OK + ')}',
      '.ov-cap{position:relative;display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:8px 8px 8px 14px;border-radius:16px;border:1px solid var(--lp-glass-edge);' + GLASS + ';flex-wrap:wrap}',
      '.ov-cap:focus-within{border-color:' + tint(BRAND, 50) + '}',
      '.ov-cap-ico{display:inline-flex;color:' + FG2 + '}',
      '.ov-cap-in{flex:1;min-width:180px;height:34px;border:0;outline:0;background:transparent;color:' + FG + ';font:inherit;font-size:14.5px}',
      '.ov-cap-in::placeholder{color:' + FG2 + ';opacity:.75}',
      '.ov-cap-tgt{flex:none;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--lp-glass-edge);background:var(--lp-glass-soft);color:' + FG + ';font-size:12.5px;cursor:pointer;white-space:nowrap}',
      '.ov-cap-tgt.is-reminder{color:var(' + BRAND + ');border-color:' + tint(BRAND, 40) + '}',
      '.ov-cap-tgt.is-reading{color:var(' + OK + ');border-color:' + tint(OK, 40) + '}',
      '.ov-cap-go{height:34px}',
      '.ov-cap-msg{flex-basis:100%;padding:2px 30px 2px;font-size:12.5px}',
      '.ov-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px;align-items:start}',
      '.ov-card{padding:14px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.ov-card.is-wide{grid-column:1/-1}',
      '.ov-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.ov-open{height:26px;padding:0 8px;font-size:12px}',
      '.ov-p{margin:0;font-size:12.5px;line-height:19px}',
      '.ov-err{color:var(' + ERR + ');font-size:12px;margin-top:4px}',
      '.ov-city{display:flex;gap:8px;flex-wrap:wrap}',
      '.ov-input{flex:1;min-width:140px;height:32px;box-sizing:border-box;padding:0 10px;border-radius:9px;border:1px solid var(--lp-glass-edge);outline:0;background:var(--lp-glass-soft);color:' + FG + ';font:inherit;font-size:13px}',
      '.ov-input:focus-visible{border-color:' + tint(BRAND, 50) + '}',
      '.ov-wx-now{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}',
      '.ov-wx-ico{font-size:34px;line-height:1}',
      '.ov-wx-temp{font-size:34px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.ov-wx-meta{font-size:12px}',
      '.ov-wx-days{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
      '.ov-wx-day{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border-radius:12px;background:var(--lp-glass-soft);font-size:12px;font-variant-numeric:tabular-nums}',
      '.ov-wx-dico{font-size:20px}',
      '.ov-rain{color:' + FG2 + ';font-size:11px}',
      '.ov-change{align-self:flex-start;font-size:12px}',
      '.ov-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
      '.ov-todo{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--lp-glass-edge)}',
      '.ov-todo:first-child{border-top:0}',
      '.ov-todo-t{flex:1;min-width:0;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-todo-d{font-size:12px;font-variant-numeric:tabular-nums}',
      '.ov-todo.is-late .ov-todo-d{color:var(' + ERR + ')}',
      '.ov-check{flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid ' + FG2 + ';background:transparent;cursor:pointer;padding:0}',
      '.ov-check:hover{border-color:var(' + OK + ');background:' + tint(OK, 20) + '}',
      '.ov-check:disabled{opacity:.4}',
      '.ov-chips{display:flex;gap:8px;flex-wrap:wrap}',
      '.ov-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--lp-glass-edge);background:var(--lp-glass-soft);color:' + FG + ';font-size:12.5px;cursor:pointer}',
      '.ov-chip.is-hot{color:var(' + BRAND + ');border-color:' + tint(BRAND, 40) + '}',
      '.ov-trip{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.ov-trip-main{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.ov-trip-main b{font-size:15px}',
      '.ov-trip-count{display:flex;align-items:baseline;gap:4px;font-size:13px}',
      '.ov-trip-count b{font-size:28px;font-variant-numeric:tabular-nums}',
      '.ov-mk{--mk-up:var(' + ERR + ');--mk-down:var(' + OK + ');display:flex;flex-direction:column;gap:10px}',
      '.ov-mk.is-us{--mk-up:var(' + OK + ');--mk-down:var(' + ERR + ')}',
      '.ov-mk-idx{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.ov-mk-i{display:flex;flex-direction:column;gap:1px;padding:8px 10px;border-radius:12px;background:var(--lp-glass-soft);font-size:12px;font-variant-numeric:tabular-nums;min-width:0}',
      '.ov-mk-i b{font-size:15px}',
      '.ov-mk .is-up{color:var(--mk-up)}',
      '.ov-mk .is-down{color:var(--mk-down)}',
      '.ov-mk-row{display:grid;grid-template-columns:minmax(0,1fr) auto 76px;gap:10px;padding:6px 0;border-top:1px solid var(--lp-glass-edge);font-size:13px;font-variant-numeric:tabular-nums}',
      '.ov-mk-row:first-child{border-top:0}',
      '.ov-mk-row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + FG + '}',
      '.ov-mk-row b{text-align:right}',
      '.ov-news{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
      '.ov-news li{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid var(--lp-glass-edge)}',
      '.ov-news li:first-child{border-top:0}',
      '.ov-news a{flex:1;min-width:0;color:' + FG + ';text-decoration:none;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-news a:hover{text-decoration:underline}',
      '.ov-news li span{flex:none;font-size:11.5px}',
      '.ov-notes li{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--lp-glass-edge);font-size:13px}',
      '.ov-notes li:first-child{border-top:0}',
      '.ov-notes li span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-notes li.is-pinned span:first-child::before{content:"📌 "}',
      '.ov-notes li span + span{flex:none;font-size:11.5px}',
      '.ov-req{display:grid;grid-template-columns:minmax(0,1fr) 64px 44px;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--lp-glass-edge)}',
      '.ov-req:first-child{border-top:0}',
      '.ov-req a{color:' + FG + ';text-decoration:none;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-req a:hover{text-decoration:underline}',
      '.ov-bar{height:6px;border-radius:999px;background:var(--lp-glass-soft);overflow:hidden}',
      '.ov-bar i{display:block;height:100%;background:var(' + OK + ')}',
      '.ov-req-n{font-size:11.5px;text-align:right;font-variant-numeric:tabular-nums}',
      '.ov-reach{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px}',
      '.ov-reach .lp-muted{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(' + IDLE + ')}',
      '.ov-dot.is-ok{background:var(' + OK + ')}', '.ov-dot.is-run{background:var(' + BRAND + ');animation:ov-pulse 1.4s ease-in-out infinite}',
      '@keyframes ov-pulse{50%{opacity:.35}}',
      '.ov-ses{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--lp-glass-edge)}', '.ov-ses:first-child{border-top:0}',
      '.ov-ses-t{flex:1;min-width:0;border:0;padding:0;background:transparent;color:' + FG + ';font:inherit;font-size:13.5px;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ov-ses-t:hover{text-decoration:underline}', '.ov-ses-k{flex:none;font-size:11.5px}', '.ov-dot.is-bad{background:var(' + ERR + ')}',
    ].join('');
    /* ===== end overview ===== */
