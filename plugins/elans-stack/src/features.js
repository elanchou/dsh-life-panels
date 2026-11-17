    /* ===== Feature switches: which panels and overview cards ElansStack shows =====
     * Stored on the host (elans-stack.json, synced) and mirrored in localStorage so the tabs do not flash
     * on and off while the setting loads. Hiding a feature only removes it from ElansStack; its data and its
     * agent tool stay as they are. To stop a plugin entirely, turn it off in the plugin manager.
     */
    const FEATURE_LS = 'elans-stack.disabled';
    function disabledSet() {
      const reg = lifeReg();
      if (!reg.disabled) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(FEATURE_LS) || '[]'); } catch { list = []; }
        reg.disabled = new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
      }
      return reg.disabled;
    }
    const isOff = (id) => disabledSet().has(id);
    function adoptDisabled(list) {
      const next = new Set((Array.isArray(list) ? list : []).filter((x) => typeof x === 'string'));
      const cur = disabledSet();
      if (next.size === cur.size && [...next].every((x) => cur.has(x))) return;
      lifeReg().disabled = next;
      try { localStorage.setItem(FEATURE_LS, JSON.stringify([...next])); } catch { /* storage blocked */ }
      lifeNotify();
    }
    async function loadFeatureSettings() {
      try { const r = await ovSelf({ action: 'settings' }); adoptDisabled(r.disabled); } catch { /* keep the local copy */ }
    }
    /** Turn one feature on or off; returns the error message, or null. Reverts the local change when the host refuses it. */
    async function setFeature(id, on) {
      const before = [...disabledSet()];
      const next = on ? before.filter((x) => x !== id) : [...new Set([...before, id])];
      adoptDisabled(next);
      try { const r = await ovSelf({ action: 'set_disabled', disabled: next }); adoptDisabled(r.disabled); return null; }
      catch (e) { adoptDisabled(before); return e.message; }
    }
    async function resetFeatures() {
      const before = [...disabledSet()];
      adoptDisabled([]);
      try { await ovSelf({ action: 'set_disabled', disabled: [] }); return null; } catch (e) { adoptDisabled(before); return e.message; }
    }

    /** Overview cards: [id, the panel it depends on, label key]. A card also hides when its panel is hidden. */
    const OV_CARDS = [['sessions', null, 'ovSessions'], ['weather', null, 'ovWeather'], ['todo', 'calendar-reminders', 'ovTodo'], ['trip', 'travel-planner', 'ovTrip'],
      ['market', 'market', 'ovMarket'], ['notes', 'notes', 'ovNotes'], ['feeds', 'news-feeds', 'ovNews'], ['reach', null, 'ovReach']];
    const cardOn = (id) => { const c = OV_CARDS.find((x) => x[0] === id); return !isOff('card:' + id) && !(c && c[1] && isOff(c[1])); };

    function FeatureSwitch(props) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': !!props.on, 'aria-label': props.label, disabled: props.disabled,
        className: 'ft-switch' + (props.on ? ' is-on' : ''), onClick: () => props.onChange(!props.on),
      }, h('i'));
    }

    function FeaturesPanel(props) {
      const t = props.t || ((k) => k);
      const [err, setErr] = useState(null);
      const [busyId, setBusyId] = useState(null);
      useRegistry();
      useEffect(() => { loadFeatureSettings(); }, []);
      const everyone = Object.values(lifeReg().panels).filter((p) => GROUP_ORDER.includes(p.group) && !HIDE_FROM_SETTINGS.includes(p.id))
        .sort((a, b) => (GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)) || ((a.order || 0) - (b.order || 0)));
      const flip = async (id, on) => { setBusyId(id); setErr(null); const e = await setFeature(id, on); if (e) setErr(t('ftFailed', { error: e })); setBusyId(null); };
      const groups = ['personal', 'news', 'settings'].map((g) => [g, everyone.filter((p) => p.group === g)]).filter((x) => x[1].length);
      return h('div', { className: 'lp-root ft-root' },
        h('div', { className: 'lp-inner' },
          h('header', { className: 'lp-hero' },
            h('div', null, h('span', { className: 'lp-eyebrow' }, t('ftEyebrow')), h('h1', { className: 'lp-title' }, t('ftTitle'))),
            h('button', { type: 'button', className: 'lp-ghost', disabled: !disabledSet().size, onClick: async () => { setErr(null); const e = await resetFeatures(); if (e) setErr(t('ftFailed', { error: e })); } }, h(Icon, { name: 'refresh', size: 14 }), t('ftReset'))),
          h(ErrorBar, { error: err, onClose: () => setErr(null) }),
          h('p', { className: 'lp-muted ft-intro' }, t('ftIntro')),
          groups.map(([g, list]) => h('section', { key: g, className: 'lp-card ft-card' },
            h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, t(g))),
            h('ul', { className: 'ft-list' }, list.map((p) => h('li', { key: p.id, className: 'ft-row' },
              h('span', { className: 'ft-ico' }, h(p.icon, { size: 16 })),
              h('span', { className: 'ft-name' }, labelOf(p)),
              h(FeatureSwitch, { on: !isOff(p.id), label: labelOf(p), disabled: busyId === p.id, onChange: (on) => flip(p.id, on) })))))),
          h('section', { className: 'lp-card ft-card' },
            h('div', { className: 'lp-card-head' }, h('h3', { className: 'lp-card-title' }, t('ftCards'))),
            h('ul', { className: 'ft-list' }, OV_CARDS.map(([id, dep, key]) => {
              const parentOff = dep && isOff(dep);
              return h('li', { key: id, className: 'ft-row' },
                h('span', { className: 'ft-name' }, t(key), parentOff ? h('span', { className: 'lp-muted ft-sub' }, t('ftFollows')) : null),
                h(FeatureSwitch, { on: cardOn(id), label: t(key), disabled: busyId === 'card:' + id || !!parentOff, onChange: (on) => flip('card:' + id, on) }));
            }))),
          h('p', { className: 'lp-muted ft-note' }, t('ftNote'))),
        h('style', null, KIT_CSS + FT_CSS));
    }

    const FT_CSS = [
      '.ft-intro,.ft-note{margin:0 2px 14px;font-size:12.5px;line-height:19px}',
      '.ft-card{margin-bottom:14px}',
      '.ft-list{list-style:none;margin:6px 0 0;padding:0}',
      '.ft-row{display:flex;align-items:center;gap:12px;padding:10px 4px;border-top:1px solid var(--lp-glass-edge)}',
      '.ft-row:first-child{border-top:0}',
      '.ft-ico{display:inline-flex;color:' + FG2 + '}',
      '.ft-name{flex:1;min-width:0;font-size:14px}',
      '.ft-sub{margin-left:8px;font-size:11.5px}',
      '.ft-switch{position:relative;flex:none;width:44px;height:26px;padding:0;border:0;border-radius:999px;background:var(' + IDLE + ');cursor:pointer;transition:background .15s}',
      '.ft-switch i{position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}',
      '.ft-switch.is-on{background:var(' + OK + ')}',
      '.ft-switch.is-on i{transform:translateX(18px)}',
      '.ft-switch:disabled{opacity:.45;cursor:default}',
      '.ft-switch:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:2px}',
    ].join('');
    /* ===== end feature switches ===== */
