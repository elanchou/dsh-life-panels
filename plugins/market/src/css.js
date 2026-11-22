    const CSS = `
.mkd{--mkd-up:var(--dsw-alias-state-success-primary);--mkd-dn:var(--dsw-alias-state-error-primary);
 height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.mkd[data-colors="down"]{--mkd-up:var(--dsw-alias-state-error-primary);--mkd-dn:var(--dsw-alias-state-success-primary)}
.mkd *{box-sizing:border-box}
.mkd button:focus-visible,.mkd tr:focus-visible,.mkd input:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:1px}
.mkd-wrap{max-width:1240px;margin:0 auto;padding:clamp(18px,3vw,32px) clamp(16px,3vw,32px) 48px;display:grid;gap:16px}
.mkd-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.mkd-title{margin:0;font-size:clamp(22px,2.6vw,28px);font-weight:650;letter-spacing:-.02em;line-height:1.15}
.mkd-sub{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px}
.mkd-btn{appearance:none;font:inherit;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:5px 12px}
.mkd-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.mkd-btn:disabled{opacity:.5;cursor:default}
.mkd-bar{display:flex;gap:8px;align-items:center}
.mkd-idx{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.mkd-card{appearance:none;text-align:left;font:inherit;color:inherit;cursor:pointer;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;min-width:0}
.mkd-card:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mkd-card[aria-pressed="true"]{border-color:var(--dsw-alias-label-secondary)}
.mkd-cn{color:var(--dsw-alias-label-secondary);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mkd-cp{font-size:17px;font-weight:600;margin-top:2px}
.mkd-num{font-variant-numeric:tabular-nums}
.mkd-up{color:var(--mkd-up)}.mkd-dn{color:var(--mkd-dn)}
.mkd-note{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px}
.mkd-err{color:var(--dsw-alias-label-secondary);padding:24px 0;text-align:center}
.mkd-bad{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--mkd-dn)}
.mkd-bad button{appearance:none;border:0;background:none;color:inherit;font:inherit;text-decoration:underline;cursor:pointer}
.mkd-foot{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px}
`;
