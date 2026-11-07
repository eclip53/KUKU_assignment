// Tiny, safe markdown renderer tuned for streamed legal answers.
// Escapes everything first, then adds a whitelisted set of tags.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Split a raw model answer into its parts (main text, draft document, coach tips, follow-ups). */
export function parseAnswer(raw, streaming = false) {
  let text = String(raw || '');
  let followups = [];
  const coach = [];
  text = text.replace(/\[\[\s*FOLLOWUPS?\s*:([\s\S]*?)\]\]/i, (_, q) => {
    followups = q.split('|').map((s) => s.trim().replace(/^["'\d.\-)\s]+|["']$/g, '')).filter(Boolean).slice(0, 3);
    return '';
  });
  text = text.replace(/\[\[\s*COACH\s*:([\s\S]*?)\]\]/gi, (_, c) => { coach.push(c.trim()); return ''; });
  if (streaming) text = text.replace(/\[\[[^\]]*$/, ''); // hide a half-streamed [[TAG
  else text = text.replace(/\[\[[^\]]*\]?\]?\s*$/, '');

  if (streaming) text = text.replace(/-{2,}[A-Z ]{0,12}-*$/, ''); // half-streamed ---DRAFT START---
  let before = text, draft = null, after = '';
  const s = text.search(/-{2,}\s*DRAFT START\s*-{2,}/i);
  if (s >= 0) {
    before = text.slice(0, s);
    let rest = text.slice(s).replace(/^-{2,}\s*DRAFT START\s*-{2,}/i, '');
    const e = rest.search(/-{2,}\s*DRAFT END\s*-{2,}/i);
    let complete = false;
    if (e >= 0) {
      after = rest.slice(e).replace(/^-{2,}\s*DRAFT END\s*-{2,}/i, '');
      rest = rest.slice(0, e);
      complete = true;
    } else if (streaming) {
      rest = rest.replace(/-{1,}\s*D?R?A?F?T?\s*E?N?D?\s*-*$/i, '');
    }
    rest = rest.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '');
    draft = { text: rest.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\n+|\s+$/g, ''), complete: complete || !streaming };
  }
  return { before: before.trim(), draft, after: after.trim(), coach, followups };
}

function inline(s) {
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${c}</code>`));
  s = s.replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+[^\s<).,;:])/g, (_, p, u) => p + keep(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</a>`));
  s = s.replace(/\[((?:[HW]\d{1,2})(?:\s*[,;]\s*[HW]\d{1,2})*)\]/g, (_, ids) =>
    ids.split(/[,;]/).map((id) => keep(`<button class="cite" data-cite="${id.trim()}" type="button">${id.trim()}</button>`)).join(''));
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[i]);
}

export function md(src) {
  const lines = esc(src).replace(/\r/g, '').split('\n');
  let html = '';
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { html += `<p>${inline(para.join('<br>'))}</p>`; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flushPara(); closeList(); continue; }

    let m;
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) {
      flushPara(); closeList();
      const lvl = Math.min(4, m[1].length + 2);
      html += `<h${lvl}>${inline(m[2].replace(/#+$/, ''))}</h${lvl}>`;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); html += '<hr>'; continue; }
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      flushPara(); closeList();
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      html += `<div class="tbl"><table><thead><tr>${cells(t).map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) { html += `<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join('')}</tr>`; i++; }
      i--;
      html += '</tbody></table></div>';
      continue;
    }
    if ((m = t.match(/^(?:[-*•]|•)\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      const box = m[1].match(/^\[( |x)\]\s+(.*)/i);
      html += box ? `<li class="todo${box[1] !== ' ' ? ' done' : ''}">${inline(box[2])}</li>` : `<li>${inline(m[1])}</li>`;
      continue;
    }
    if ((m = t.match(/^(\d{1,2})[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ol') { closeList(); html += `<ol start="${m[1]}">`; list = 'ol'; }
      html += `<li>${inline(m[2])}</li>`;
      continue;
    }
    if ((m = t.match(/^&gt;\s?(.*)$/))) { flushPara(); closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if (list && /^\s{2,}/.test(line)) { html = html.replace(/<\/li>$/, `<br>${inline(t)}</li>`); continue; }
    closeList();
    para.push(t);
  }
  flushPara(); closeList();
  return html;
}

/** Draft text → HTML with highlighted [placeholders]. */
export function draftHtml(text) {
  return esc(text).replace(/\[([^\]\n]{1,80})\]/g, '<mark class="ph">[$1]</mark>');
}

/** Wrap unverified legal references inside a rendered element (text nodes only). */
export function markUnverified(root, items, tip) {
  const bad = items.filter((x) => x.status === 'unverified' && x.kind !== 'tag').map((x) => x.text).filter((x) => x.length > 3);
  if (!bad.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('mark,.cite,a,.draft') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    for (const ref of bad) {
      const idx = node.nodeValue.indexOf(ref);
      if (idx < 0) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + ref.length);
      const mark = document.createElement('mark');
      mark.className = 'unverified';
      mark.title = tip;
      mark.tabIndex = 0;
      range.surroundContents(mark);
      break; // node was split; remaining refs handled by later nodes
    }
  }
}

/** Plain text for text-to-speech. */
export function speakable(raw) {
  const p = parseAnswer(raw);
  const strip = (s) => s.replace(/\[[HW]\d+\]/g, '').replace(/[#*_`>|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ', ');
  return [strip(p.before), p.draft ? '' : '', strip(p.after), ...p.coach].filter(Boolean).join('. ');
}
