window.__ModuleLoader__.load({
  id: '@local/market',
  factory(require) {
    /* @kit */
    /* @suite */

    const PANEL_ID = 'market';
    const NS = 'market';
    const call = makeCall('/plugin-api/market');
    const REFRESH_MS = 12000;
    const LS_COLOR = 'market.updown';

    /* @include i18n.js */

    Object.assign(ICONS, {
      chart: ['M4 19V5', 'M4 19h16', 'M7 15l3.5-4 3 2.5L19 7'],
      arrowup: ['M12 19V6', 'M6.5 11.5L12 6l5.5 5.5'],
      arrowdown: ['M12 5v13', 'M6.5 12.5L12 18l5.5-5.5'],
      globe: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18', 'M12 3c2.5 3 2.5 15 0 18', 'M12 3c-2.5 3-2.5 15 0 18'],
    });
    const MarketGlyph = PanelGlyph('globe');

    /* @include css.js */
    /* @include css-more.js */
    /* @include helpers.js */
    /* @include components.js */
    /* @include page.js */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'market: dictionaries');
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
        lifeGroupRegister(ctx, {
          id: PANEL_ID, group: 'news', order: 15, label: () => t('panel'), icon: MarketGlyph, render: (p) => h(Panel, { ...p, t }),
        }, () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: PANEL_ID, order: 31, label: () => t('panel'), locale: NS,
        }, MarketGlyph)));
      },
    };
  },
});
