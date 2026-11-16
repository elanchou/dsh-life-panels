    /* ===== life-panels groups (shared/client/suite.js, inlined by scripts/build.mjs at `/* @suite *\/`) =====
     * The elans-stack plugin groups member panels under one sidebar entry, in two groups (personal, news, settings). A member registers
     * itself here with lifeGroupRegister: while elans-stack is active the member shows as a tab inside its group's
     * panel and gives up its own sidebar icon; without elans-stack it registers its icon as before.
     * entry: { id, group: 'personal'|'news', order, label(), icon (glyph component), render(props), badge? }
     * badge: { subscribe(fn) -> unsubscribe, tone() -> 'brand'|'ok'|'err'|null } drives the dot on the group icon.
     */
    const LIFE_PANEL = 'elans-stack';
    const LIFE_GROUPS = ['personal', 'news', 'settings'];
    function lifeReg() {
      if (!window.__lifeSuite) window.__lifeSuite = { panels: {}, suite: 0, subs: new Set(), tab: '' };
      return window.__lifeSuite;
    }
    function lifeNotify() { lifeReg().subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
    function lifeGroupRegister(ctx, entry, registerIcon) {
      const reg = lifeReg();
      let on = false;
      let off = null;
      const sync = () => {
        if (reg.suite > 0) { if (on) { if (off) off(); off = null; on = false; } }
        else if (!on) { off = registerIcon(); on = true; }
      };
      ctx.effect(() => {
        reg.panels[entry.id] = entry; reg.subs.add(sync); sync(); lifeNotify();
        return () => {
          reg.subs.delete(sync);
          if (reg.panels[entry.id] === entry) delete reg.panels[entry.id];
          if (on) { if (off) off(); off = null; on = false; }
          lifeNotify();
        };
      }, entry.id + ': life group');
    }
    /** Bring a member panel to the front: its tab inside the group when elans-stack is active, else its own sidebar panel. */
    function lifeOpen(ctx, id) {
      let layout = null;
      try { layout = ctx && ctx.get('layout'); } catch { layout = null; }
      if (!layout) return;
      const reg = lifeReg();
      const entry = reg.panels[id];
      try {
        if (reg.suite > 0 && entry && LIFE_GROUPS.includes(entry.group)) {
          reg.tab = id;
          try { localStorage.setItem('elans-stack.tab', id); } catch { /* storage blocked */ }
          lifeNotify();
          layout.selectPanel(LIFE_PANEL);
        } else layout.selectPanel(id);
      } catch { /* panel not registered */ }
    }
    /* ===== end life-panels groups ===== */
