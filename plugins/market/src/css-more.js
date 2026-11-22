    const CSS2 = `
.mkd-hero{position:relative;height:clamp(460px,68vh,680px);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;touch-action:none;user-select:none;container-type:inline-size}
.mkd-hero{--mkd-lw:clamp(230px,27%,310px)}
.mkd-hero-globe{position:absolute;top:0;bottom:0;right:0;left:calc(var(--mkd-lw) + 32px)}
.mkd-hero-hint{position:absolute;left:calc(var(--mkd-lw) + 32px);right:0;bottom:10px;text-align:center;pointer-events:none;color:var(--dsw-alias-label-secondary);font-size:12px;z-index:1}
.mkd-side{position:absolute;top:16px;bottom:16px;left:16px;width:var(--mkd-lw);z-index:1;display:flex;flex-direction:column;padding:14px 8px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 62%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.mkd-side-h{margin:0 6px 12px;display:grid;gap:8px}
.mkd-side-h b{font-size:13px;font-weight:600}
.mkd-split{display:flex;height:4px;border-radius:2px;overflow:hidden;gap:2px;background:var(--dsw-alias-fill-l1)}
.mkd-split i{display:block;height:100%;transition:width .4s}
.mkd-split i:first-child{background:var(--mkd-up)}.mkd-split i:last-child{background:var(--mkd-dn)}
.mkd-split-l{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.mkd-side-rows{display:grid;gap:2px;flex:1;min-height:0;overflow:auto;align-content:start;padding-right:2px;scrollbar-width:thin}
.mkd-row{appearance:none;font:inherit;color:inherit;background:none;border:0;border-radius:8px;padding:7px 8px 9px;cursor:pointer;text-align:left;position:relative;display:grid;grid-template-columns:18px minmax(0,1fr) auto;column-gap:8px;align-items:center;transition:background .15s}
.mkd-row:hover,.mkd-row[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.mkd-row-n{color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}
.mkd-row-t{min-width:0}
.mkd-row-t span{display:block;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-row-t em{display:block;font-style:normal;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.mkd-pill{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--mkd-c) 16%,transparent);color:var(--mkd-c)}
.mkd-pill.mkd-up{--mkd-c:var(--mkd-up)}.mkd-pill.mkd-dn{--mkd-c:var(--mkd-dn)}
.mkd-row-bar{grid-column:2/4;height:2px;margin-top:6px;border-radius:2px;background:color-mix(in srgb,var(--mkd-c) 14%,transparent);overflow:hidden}
.mkd-row-bar i{display:block;height:100%;border-radius:2px;background:var(--mkd-c)}
.mkd-row-bar.mkd-up{--mkd-c:var(--mkd-up)}.mkd-row-bar.mkd-dn{--mkd-c:var(--mkd-dn)}
@container (max-width:860px){.mkd-side{display:none}.mkd-hero-globe,.mkd-hero-hint{left:0}}
.mkd-gl-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mkd-gl-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.mkd-gl{position:absolute;left:0;top:0;display:flex;gap:6px;align-items:baseline;white-space:nowrap;font-size:11px;line-height:16px;padding:1px 7px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 78%,transparent);border:1px solid transparent;opacity:0;will-change:transform,opacity}
.mkd-gl span{color:var(--dsw-alias-label-secondary)}
.mkd-gl b{font-weight:600;font-variant-numeric:tabular-nums}
.mkd-gl[data-active="1"]{border-color:var(--dsw-alias-border-l1);font-size:12px}
.mkd-gl[data-active="1"] span{color:var(--dsw-alias-label-primary)}
.mkd-cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:16px;align-items:start}
.mkd-col{display:grid;gap:16px;min-width:0}
.mkd-group{display:flex;align-items:baseline;gap:8px;margin-top:4px}
.mkd-panel{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:14px;min-width:0}
.mkd-ph{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
.mkd-big{font-size:20px;font-weight:600;line-height:1.25}
.mkd-mu{color:var(--dsw-alias-label-secondary);font-size:12px}
.mkd-r{text-align:right}
.mkd-seg{display:flex;gap:2px;flex-wrap:wrap}
.mkd-seg button{appearance:none;font:inherit;font-size:12px;cursor:pointer;border:0;background:none;color:var(--dsw-alias-label-secondary);padding:3px 10px;border-radius:6px}
.mkd-seg button:hover{color:var(--dsw-alias-label-primary)}
.mkd-seg button[aria-pressed="true"]{background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-primary)}
.mkd-chart{position:relative;height:320px;margin:8px 0}
.mkd-chart svg{width:100%;height:100%;display:block}
.mkd-tip{position:absolute;top:0;pointer-events:none;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);padding:0 4px}
.mkd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px}
.mkd-stats span{display:block;color:var(--dsw-alias-label-secondary);font-size:12px}
.mkd-form{display:flex;gap:6px}
.mkd-in{font:inherit;font-size:12px;width:210px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 8px}
.mkd-tbl{width:100%;border-collapse:collapse}
.mkd-tbl th{color:var(--dsw-alias-label-secondary);font-weight:400;font-size:12px;text-align:left;padding:4px 6px}
.mkd-tbl td{padding:7px 6px;border-top:1px solid var(--dsw-alias-border-l1)}
.mkd-tbl tbody tr{cursor:pointer}
.mkd-tbl tbody tr:hover,.mkd-tbl tbody tr[aria-selected="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.mkd-tbl .mkd-r{text-align:right}
.mkd-nm{display:block;color:var(--dsw-alias-label-secondary);font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mkd-x{appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;padding:0 4px}
.mkd-err{color:var(--dsw-alias-label-secondary);padding:24px 0;text-align:center}
@media(max-width:900px){.mkd-cols{grid-template-columns:1fr}.mkd-grid{grid-template-columns:1fr}.mkd-main{grid-row:auto}.mkd-stats{grid-template-columns:repeat(2,1fr)}}
.mkd-hits{list-style:none;margin:0 0 8px;padding:0;max-height:260px;overflow:auto}
.mkd-hits li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1)}
.mkd-addErr{color:var(--mkd-up);font-size:12px;margin:-4px 0 8px}
.mkd-pos{display:grid;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);margin-top:12px;padding-top:12px}
.mkd-pos-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mkd-pos label{display:grid;gap:3px;color:var(--dsw-alias-label-secondary);font-size:12px}
.mkd-pos .mkd-in{width:100%}
.mkd-pos-act{display:flex;justify-content:space-between;align-items:center;gap:8px}
.mkd-pnl{display:flex;justify-content:space-between;gap:10px;font-weight:600}
.mkd-cols>.mkd-col:first-child{align-content:start}
`;
