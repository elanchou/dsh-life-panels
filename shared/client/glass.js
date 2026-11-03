    /* ===== life-panels glass (shared/client/glass.js) =====
     * Frosted glass. Surfaces are translucent theme layers with a backdrop blur over a soft ambient
     * gradient painted on .lp-root, so light and dark themes both work. The variables are declared on
     * .lp-root; panels may override --lp-amb-a/b/c to tint their backdrop.
     * GLASS: standalone surfaces (cards, bars, stats). GLASS_SOFT: rows nested inside a glass surface,
     * translucent without a second blur. Both fall back to opaque layers without backdrop-filter support
     * or with prefers-reduced-transparency. GLASS_ROOT goes on the panel root rule.
     */
    const GLASS_SHADOW = 'inset 0 1px 0 var(--lp-glass-hi),0 10px 30px -14px ' + 'color-mix(in srgb,var(--dsw-alias-label-primary) 22%,transparent)';
    const GLASS = 'background:var(--lp-glass);border:1px solid var(--lp-glass-edge);box-shadow:' + GLASS_SHADOW + ';-webkit-backdrop-filter:var(--lp-glass-blur);backdrop-filter:var(--lp-glass-blur)';
    const GLASS_HOVER = 'background:var(--lp-glass-strong);border-color:' + 'color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent)' + ';box-shadow:inset 0 1px 0 var(--lp-glass-hi),0 16px 36px -16px ' + 'color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent)';
    const GLASS_SOFT = 'background:var(--lp-glass-soft)';
    const GLASS_VARS = [
      '--lp-glass:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 58%,transparent)',
      '--lp-glass-strong:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 76%,transparent)',
      '--lp-glass-soft:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 52%,transparent)',
      '--lp-glass-edge:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)',
      '--lp-glass-hi:color-mix(in srgb,color-mix(in srgb,var(--dsw-alias-bg-layer-1) 65%,#fff) 75%,transparent)',
      '--lp-glass-blur:blur(18px) saturate(170%)',
    ].join(';');
    const GLASS_OPAQUE = '--lp-glass:var(--dsw-alias-bg-layer-1);--lp-glass-strong:var(--dsw-alias-bg-layer-1);--lp-glass-soft:var(--dsw-alias-bg-layer-2);--lp-glass-blur:none';
    const AMBIENT = [
      'radial-gradient(46% 42% at 6% -4%,color-mix(in srgb,var(--lp-amb-a) 30%,transparent),transparent 72%)',
      'radial-gradient(40% 38% at 100% 8%,color-mix(in srgb,var(--lp-amb-b) 22%,transparent),transparent 72%)',
      'radial-gradient(52% 46% at 62% 104%,color-mix(in srgb,var(--lp-amb-c) 20%,transparent),transparent 74%)',
      'var(--dsw-alias-bg-base)',
    ].join(',');
    const GLASS_ROOT = GLASS_VARS + ';--lp-amb-a:var(--dsw-alias-brand-primary);--lp-amb-b:var(--dsw-alias-state-success-primary);--lp-amb-c:var(--dsw-alias-state-warn-primary);background:' + AMBIENT;
    /** Fallback rules for a panel root selector. */
    const glassFallback = (root) => [
      '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){' + root + '{' + GLASS_OPAQUE + '}}',
      '@media (prefers-reduced-transparency:reduce){' + root + '{' + GLASS_OPAQUE + '}}',
    ];
    /* ===== end glass ===== */
