    /* ===== Minimal Markdown to React (no HTML strings, so note text can never inject markup) =====
     * Blocks: # headings, paragraphs, - / * / 1. lists, - [ ] checklists, > quotes, ``` code fences, --- rules.
     * Inline: `code`, **bold**, *italic*, ~~strike~~, [text](url), bare http(s) links, #tags.
     * Checklist items are numbered in document order outside code fences, matching taskLines() on the host.
     */
    const SAFE_URL = /^(https?:|mailto:)/i;

    function mdInline(text, keyBase, onTag) {
      const out = [];
      let rest = String(text);
      let k = 0;
      const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<>"')\]]+)|((?:^|(?<=[\s,，。;；(（]))#[\p{L}\p{N}_-]*\p{L}[\p{L}\p{N}_-]*)/u;
      while (rest) {
        const m = re.exec(rest);
        if (!m) { out.push(rest); break; }
        if (m.index) out.push(rest.slice(0, m.index));
        const tok = m[0];
        const key = keyBase + '-' + k++;
        if (m[1]) out.push(h('code', { key, className: 'md-code' }, tok.slice(1, -1)));
        else if (m[2]) out.push(h('strong', { key }, mdInline(tok.slice(2, -2), key, onTag)));
        else if (m[3]) out.push(h('del', { key }, mdInline(tok.slice(2, -2), key, onTag)));
        else if (m[4]) out.push(h('em', { key }, mdInline(tok.slice(1, -1), key, onTag)));
        else if (m[5]) {
          const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
          out.push(SAFE_URL.test(mm[2]) ? h('a', { key, href: mm[2], target: '_blank', rel: 'noopener noreferrer', onClick: (e) => e.stopPropagation() }, mdInline(mm[1], key, onTag)) : mm[1]);
        } else if (m[6]) out.push(h('a', { key, href: tok, target: '_blank', rel: 'noopener noreferrer', onClick: (e) => e.stopPropagation() }, tok));
        else if (m[7]) {
          const tag = tok.slice(1);
          out.push(onTag ? h('button', { key, type: 'button', className: 'md-tag', onClick: (e) => { e.stopPropagation(); onTag(tag.toLowerCase()); } }, tok) : h('span', { key, className: 'md-tag' }, tok));
        }
        rest = rest.slice(m.index + tok.length);
      }
      return out;
    }

    /** Render Markdown. onCheck(index) makes checklist boxes clickable; onTag(tag) makes #tags clickable. */
    function Markdown(props) {
      const { text, onCheck, onTag, compact } = props;
      const lines = String(text || '').split('\n');
      const blocks = [];
      let task = 0;
      let i = 0;
      const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
      const CHECK = /^\[( |x|X)\]\s?(.*)$/;
      while (i < lines.length) {
        const line = lines[i];
        const key = 'b' + i;
        if (/^\s*```/.test(line)) {
          const body = [];
          i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
          i++;
          blocks.push(h('pre', { key, className: 'md-pre' }, h('code', null, body.join('\n'))));
          continue;
        }
        const hm = /^(#{1,4})\s+(.*)$/.exec(line);
        if (hm) { blocks.push(h('h' + Math.min(6, hm[1].length + 2), { key, className: 'md-h md-h' + hm[1].length }, mdInline(hm[2], key, onTag))); i++; continue; }
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push(h('hr', { key, className: 'md-hr' })); i++; continue; }
        if (/^\s*>/.test(line)) {
          const body = [];
          while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
          blocks.push(h('blockquote', { key, className: 'md-quote' }, mdInline(body.join(' '), key, onTag)));
          continue;
        }
        if (LIST.test(line)) {
          const items = [];
          const ordered = /^\s*\d/.test(line);
          while (i < lines.length && LIST.test(lines[i])) {
            const lm = LIST.exec(lines[i]);
            const indent = Math.min(3, Math.floor(lm[1].replace(/\t/g, '  ').length / 2));
            const cm = CHECK.exec(lm[3]);
            const ikey = 'li' + i;
            if (cm) {
              const idx = task++;
              const done = cm[1] !== ' ';
              items.push(h('li', { key: ikey, className: 'md-task' + (done ? ' is-done' : ''), style: indent ? { marginLeft: indent * 18 } : undefined },
                h('button', {
                  type: 'button', role: 'checkbox', 'aria-checked': done, className: 'md-box' + (done ? ' is-on' : ''), disabled: !onCheck,
                  onClick: (e) => { e.stopPropagation(); if (onCheck) onCheck(idx); },
                }, done ? h(Icon, { name: 'check', size: 11, stroke: 3 }) : null),
                h('span', null, mdInline(cm[2], ikey, onTag))));
            } else {
              items.push(h('li', { key: ikey, style: indent ? { marginLeft: indent * 18 } : undefined }, mdInline(lm[3], ikey, onTag)));
            }
            i++;
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key, className: 'md-list' }, items));
          continue;
        }
        if (!line.trim()) { i++; continue; }
        const para = [];
        while (i < lines.length && lines[i].trim() && !/^\s*(```|>|#{1,4}\s|(-{3,}|\*{3,})\s*$)/.test(lines[i]) && !LIST.test(lines[i])) para.push(lines[i++]);
        blocks.push(h('p', { key, className: 'md-p' }, para.map((p, j) => [j ? h('br', { key: 'br' + j }) : null, ...mdInline(p, key + '-' + j, onTag)])));
      }
      return h('div', { className: 'md' + (compact ? ' is-compact' : '') }, blocks);
    }

    const MD_CSS = [
      '.md{font-size:14px;line-height:22px;word-break:break-word;color:' + FG + '}',
      '.md > :first-child{margin-top:0}',
      '.md > :last-child{margin-bottom:0}',
      '.md-p{margin:0 0 10px}',
      '.md-h{margin:16px 0 8px;line-height:1.3;font-weight:700}',
      '.md-h1{font-size:20px}', '.md-h2{font-size:17px}', '.md-h3{font-size:15px}', '.md-h4{font-size:14px;color:' + FG2 + '}',
      '.md-list{margin:0 0 10px;padding-left:22px}',
      '.md-list li{margin:2px 0}',
      '.md-task{list-style:none;margin-left:-22px !important;display:flex;align-items:flex-start;gap:8px}',
      '.md-task.is-done > span{color:' + FG2 + ';text-decoration:line-through}',
      '.md-box{flex:none;width:17px;height:17px;margin-top:2.5px;padding:0;border-radius:5px;border:1.5px solid ' + FG2 + ';background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}',
      '.md-box.is-on{background:var(' + OK + ');border-color:var(' + OK + ')}',
      '.md-box:disabled{cursor:default}',
      '.md-box:focus-visible{outline:2px solid var(' + BRAND + ');outline-offset:1px}',
      '.md-quote{margin:0 0 10px;padding:4px 12px;border-left:3px solid ' + tint(BRAND, 40) + ';color:' + FG2 + '}',
      '.md-pre{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:var(--lp-glass-soft);overflow:auto;font-size:12.5px;line-height:19px}',
      '.md-pre code,.md-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.md-code{padding:1px 5px;border-radius:5px;background:var(--lp-glass-soft);font-size:.9em}',
      '.md-hr{border:0;border-top:1px solid var(--lp-glass-edge);margin:14px 0}',
      '.md a{color:var(' + BRAND + ');text-decoration:underline;text-underline-offset:2px}',
      '.md-tag{border:0;padding:0 4px;border-radius:5px;background:' + tint(BRAND, 12) + ';color:var(' + BRAND + ');font:inherit;font-size:.92em;cursor:pointer}',
      '.md.is-compact{font-size:13px;line-height:20px}',
      '.md.is-compact .md-h{margin:4px 0;font-size:14px}',
      '.md.is-compact .md-p,.md.is-compact .md-list,.md.is-compact .md-pre,.md.is-compact .md-quote{margin-bottom:6px}',
    ].join('');
    /* ===== end markdown ===== */
