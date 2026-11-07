import { STR, PROBLEMS, DOC_TYPES, ROLES, HELPLINES } from './i18n.js';
import { md, esc, parseAnswer, draftHtml, markUnverified, speakable } from './md.js';
import { VoiceInput, tts } from './voice.js';
import { extractText } from './attach.js';

// ------------------------------------------------------------------ icons
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>', stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>',
  clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 1 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  volumeX: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  brain: '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM20 17v5H6.5a2.5 2.5 0 0 1 0-5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>', swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>',
  scale: '<path d="M12 3v18M7 21h10M4 7h16M4 7l-3 7a3 3 0 0 0 6 0zM20 7l-3 7a3 3 0 0 0 6 0z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
};
const ic = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// ------------------------------------------------------------------ state & storage
const KEY = { chats: 'nyay.v1.chats', settings: 'nyay.v1.settings', current: 'nyay.v1.current' };
const WINDOW = 10; // short-term memory: most recent messages sent with every request
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

const S = {
  chats: read(KEY.chats, []),
  settings: { lang: 'auto', theme: 'system', autoSpeak: false, handsFree: false, ...read(KEY.settings, {}) },
  currentId: localStorage.getItem(KEY.current),
  busy: false, abort: null, attachment: null, health: {},
  draftMode: { mode: 'advice', docType: 0, role: 0 },
};

let saveTimer;
function save(now = false) {
  clearTimeout(saveTimer);
  const run = () => {
    try {
      localStorage.setItem(KEY.chats, JSON.stringify(S.chats));
      localStorage.setItem(KEY.settings, JSON.stringify(S.settings));
      if (S.currentId) localStorage.setItem(KEY.current, S.currentId);
    } catch { toast(t().storageFull); }
  };
  now ? run() : (saveTimer = setTimeout(run, 250));
}

const uiLang = () => (S.settings.lang === 'hi' ? 'hi' : S.settings.lang === 'en' ? 'en' : (navigator.language || '').startsWith('hi') ? 'hi' : 'en');
const t = () => STR[uiLang()];
const current = () => S.chats.find((c) => c.id === S.currentId);

function newChatObj() {
  return { id: uid(), title: '', createdAt: Date.now(), updatedAt: Date.now(), messages: [], summary: '', summarizedCount: 0, caseFile: {}, meta: {}, mode: 'advice', docType: 0, role: 0 };
}

// ------------------------------------------------------------------ static i18n
function applyStatic() {
  document.documentElement.lang = uiLang();
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t()[el.dataset.t]; });
  document.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.tagName === 'I') el.outerHTML = ic(el.dataset.icon);
    else if (!el.querySelector('svg.ico')) el.insertAdjacentHTML('afterbegin', ic(el.dataset.icon));
  });
  $('#chatSearch').placeholder = t().search;
  document.querySelectorAll('#langSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === S.settings.lang));
  $('#langSeg [data-lang=auto]').textContent = t().auto;
  setIcon($('#themeBtn'), document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  setIcon($('#speakToggle'), S.settings.autoSpeak ? 'volume' : 'volumeX');
  $('#speakToggle').classList.toggle('on', S.settings.autoSpeak);
}
const setIcon = (el, name) => { el.innerHTML = ic(name); };

// ------------------------------------------------------------------ sidebar
function renderSidebar() {
  const q = $('#chatSearch').value.trim().toLowerCase();
  const list = S.chats
    .filter((c) => c.messages.length)
    .filter((c) => !q || (c.title + ' ' + c.messages.map((m) => m.content).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const groups = [[t().today, list.filter((c) => c.updatedAt >= startOfDay)], [t().earlier, list.filter((c) => c.updatedAt < startOfDay)]];
  const nav = $('#chatList');
  if (!list.length) { nav.innerHTML = `<p class="empty-list">${esc(t().noChats)}</p>`; return; }
  nav.innerHTML = groups.filter(([, g]) => g.length).map(([label, g]) => `<div class="group"><h4>${label}</h4>${g.map((c) => `
    <div class="chat-item${c.id === S.currentId ? ' active' : ''}" data-id="${c.id}" tabindex="0">
      <span class="dot ${c.meta?.urgency === 'emergency' ? 'red' : c.meta?.urgency === 'high' ? 'amber' : ''}"></span>
      <div class="ci-text"><b>${esc(c.title || 'Untitled')}</b><small>${esc(domainLabel(c.meta?.domain))} · ${new Date(c.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small></div>
      <button class="icon xs" data-act="rename" title="${t().rename}">${ic('edit')}</button>
      <button class="icon xs" data-act="delete" title="${t().delete}">${ic('trash')}</button>
    </div>`).join('')}</div>`).join('');
}
const DOMAINS = { tenancy: ['Tenancy', 'किरायेदारी'], consumer: ['Consumer', 'उपभोक्ता'], employment: ['Employment', 'रोज़गार'], cyber: ['Cyber', 'साइबर'], family: ['Family', 'परिवार'], women_safety: ['Women safety', 'महिला सुरक्षा'], criminal: ['Criminal', 'आपराधिक'], property: ['Property', 'संपत्ति'], banking: ['Banking', 'बैंकिंग'], government: ['Government', 'सरकारी'], other: ['General', 'सामान्य'] };
const domainLabel = (d) => (DOMAINS[d] || DOMAINS.other)[uiLang() === 'hi' ? 1 : 0];

// ------------------------------------------------------------------ thread
function renderThread() {
  const chat = current();
  const th = $('#thread');
  $('#chatTitle').textContent = chat?.title || t().newChat;
  if (!chat || !chat.messages.length) { th.innerHTML = heroHtml(); return; }
  th.innerHTML = '';
  chat.messages.forEach((m) => th.appendChild(messageEl(m, chat)));
  th.scrollTop = th.scrollHeight;
}

function heroHtml() {
  const L = uiLang();
  return `<div class="hero">
    <div class="hero-seal">${ic('scale')}</div>
    <h2>${esc(t().heroTitle)}</h2>
    <p>${esc(t().heroSub)}</p>
    <button class="hero-mic" id="heroMic">${ic('mic')}<span>${esc(t().speak)}</span></button>
    <div class="problems">${PROBLEMS.map((p, i) => `<button class="problem" data-prob="${i}"><span class="emo">${p.icon}</span><span>${esc(p[L][0])}</span></button>`).join('')}</div>
    <ul class="trust"><li>${ic('book')}${esc(t().trust1)}</li><li>${ic('shield')}${esc(t().trust2)}</li><li>${ic('check')}${esc(t().trust3)}</li></ul>
  </div>`;
}

function userContentHtml(m) {
  if (m.cmd === 'START_PRACTICE') return `<span class="sys-note">${ic('swords')} ${esc(t().practiceStarted(m.roleLabel || ''))}</span>`;
  if (m.cmd === 'END_PRACTICE') return `<span class="sys-note">${ic('check')} ${esc(t().practiceEnded)}</span>`;
  let html = esc(m.display ?? m.content).replace(/\n/g, '<br>');
  if (m.attachment) html += `<details class="doc-chip"><summary>${ic('file')} ${esc(m.attachment.name)}</summary><pre>${esc(m.attachment.text.slice(0, 3000))}</pre></details>`;
  return html;
}

function messageEl(m, chat) {
  const el = document.createElement('article');
  el.className = `msg ${m.role}${m.mode === 'practice' ? ' practice' : ''}`;
  el.dataset.id = m.id;
  if (m.role === 'user') {
    el.innerHTML = `<div class="bubble">${userContentHtml(m)}</div>`;
    return el;
  }
  el.innerHTML = `<div class="avatar">${m.mode === 'practice' ? ic('swords') : ic('scale')}</div><div class="body">
      <div class="alerts"></div><div class="stages"></div><div class="content"></div><div class="extras"></div></div>`;
  paintAssistant(el, m, chat, false);
  return el;
}

const STAGES = ['understand', 'search', 'web', 'write'];
function paintStages(el, m) {
  const box = $('.stages', el);
  if (!m.stages || (m.content && !m.streaming)) { box.innerHTML = ''; return; }
  const seen = m.stages;
  const cur = seen[seen.length - 1];
  if (m.content) { box.innerHTML = ''; return; }
  box.innerHTML = `<ol class="progress">${STAGES.filter((s) => s !== 'web' || seen.includes('web')).map((s) => {
    const state = s === cur ? 'now' : seen.includes(s) ? 'done' : 'todo';
    return `<li class="${state}">${state === 'done' ? ic('check') : '<i class="spin"></i>'}${esc(t().stages[s])}</li>`;
  }).join('')}</ol>`;
}

function paintAlerts(el, m) {
  const box = $('.alerts', el);
  const u = m.meta?.urgency;
  if (u !== 'emergency' && u !== 'high') { box.innerHTML = ''; return; }
  const d = m.meta?.domain;
  const nums = u === 'emergency' ? ['112'] : [];
  if (d === 'cyber' || d === 'banking') nums.push('1930');
  if (d === 'women_safety' || d === 'family') nums.push('181');
  if (u === 'emergency') nums.push('14416');
  nums.push('15100');
  const L = uiLang() === 'hi' ? 2 : 1;
  box.innerHTML = `<div class="alert ${u}">${ic('alert')}<div><b>${esc(u === 'emergency' ? t().emergency : t().urgentHigh)}</b>
    <div class="calls">${[...new Set(nums)].map((n) => { const h = HELPLINES.find((x) => x[0] === n); return `<a href="tel:${n}" class="call">${ic('phone')}${n}<small>${esc(h ? h[L] : '')}</small></a>`; }).join('')}</div></div></div>`;
}

function paintAssistant(el, m, chat, streaming) {
  paintStages(el, m);
  paintAlerts(el, m);
  const p = parseAnswer(m.content, streaming);
  const content = $('.content', el);
  let html = md(p.before);
  if (p.draft) {
    html += `<div class="draft${p.draft.complete ? '' : ' writing'}">
      <div class="draft-head">${ic('file')}<b>${esc(t().draftTitle)}</b><span class="muted small">${esc(t().draftHint)}</span></div>
      <div class="draft-body" spellcheck="false">${draftHtml(p.draft.text)}</div>
      ${p.draft.complete ? `<div class="draft-actions">
        <button class="btn soft sm" data-act="draft-copy">${ic('copy')}${esc(t().copy)}</button>
        <button class="btn soft sm" data-act="draft-edit">${ic('edit')}${esc(t().edit)}</button>
        <button class="btn soft sm" data-act="draft-doc">${ic('download')}${esc(t().download)}</button>
        <button class="btn soft sm" data-act="draft-print">${ic('printer')}${esc(t().print)}</button></div>` : ''}
    </div>`;
  }
  html += md(p.after);
  p.coach.forEach((c) => { html += `<div class="coach">💡 <b>${esc(t().coach)}:</b> ${esc(c)}</div>`; });
  if (m.error) html += `<div class="err">${ic('alert')} ${esc(m.error)} <button class="btn soft sm" data-act="retry">${ic('refresh')}${esc(t().retry)}</button></div>`;
  if (streaming && !p.draft) html += '<span class="caret"></span>';
  content.innerHTML = html;
  if (!streaming && m.guard) markUnverified(content, m.guard, t().unverifiedTip);

  const extras = $('.extras', el);
  if (streaming) { extras.innerHTML = ''; return; }
  extras.innerHTML = extrasHtml(m, p);
}

function extrasHtml(m, p) {
  let h = '';
  const src = m.sources || [];
  if (m.mode !== 'practice' && m.content && m.meta?.kind === 'legal') {
    const hb = src.filter((s) => s.kind === 'handbook').length, w = src.length - hb;
    h += `<div class="grounding ${src.length ? 'ok' : 'none'}">${ic(src.length ? 'book' : 'alert')}${esc(src.length ? t().grounded(hb, w) : t().ungrounded)}</div>`;
  }
  if (m.guard?.length) {
    const ok = m.guard.filter((g) => g.status === 'verified').length;
    const bad = m.guard.filter((g) => g.status !== 'verified');
    h += `<div class="guard">${ic('shield')}<span>${ok ? `<span class="g-ok">✓ ${esc(t().guardOk(ok))}</span>` : ''}${bad.length ? ` <span class="g-bad">⚠ ${esc(t().guardBad(bad.length))}: ${bad.map((b) => `<code>${esc(b.text)}</code>`).join(' ')}</span>` : ''}</span></div>`;
  }
  if (src.length) {
    h += `<details class="sources"><summary>${esc(t().sources)} (${src.length})</summary><ul>${src.map((s) => `<li id="src-${m.id}-${s.id}" class="src ${s.kind}">
      <span class="tag">${s.id}</span>${s.kind === 'handbook'
        ? `${ic('book')}<div><b>Legal Aid Handbook 2022 — ${esc(s.chapter)}</b> <span class="muted">p.${esc(s.printedPage)}</span><p>${esc(s.text)}…</p></div>`
        : `${ic('globe')}<div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(s.title)}</b></a> <span class="auth">${esc(s.authority)}</span><p>${esc(s.text)}…</p></div>`}</li>`).join('')}</ul></details>`;
  }
  if (p.followups.length) h += `<div class="followups">${p.followups.map((q) => `<button class="chip" data-follow="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
  if (m.content) {
    const st = m.stats;
    h += `<div class="msg-actions">
      <button class="icon xs" data-act="speak" title="${esc(t().readAloud)}">${ic('volume')}</button>
      <button class="icon xs" data-act="copy" title="${esc(t().copy)}">${ic('copy')}</button>
      ${st ? `<span class="stats" title="Tokens used for this answer (router + answer)">${st.tokens ? `${(st.tokens / 1000).toFixed(1)}k tok · ` : ''}${(st.ms / 1000).toFixed(1)}s${st.retrieval?.mode && st.retrieval.mode !== 'skipped' ? ` · ${st.retrieval.mode}${st.retrieval.web ? '+web' : ''}` : ''}</span>` : ''}
    </div>`;
  }
  return h;
}

// ------------------------------------------------------------------ case file
const CASE_ARRAYS = ['parties', 'facts', 'timeline', 'evidence', 'missing'];
function mergeCase(chat, meta, add) {
  const cf = chat.caseFile;
  if (meta) {
    ['domain', 'state'].forEach((k) => { if (meta[k] && meta[k] !== 'other') cf[k] = meta[k]; });
    if (meta.urgency && meta.urgency !== 'none') cf.urgency = meta.urgency;
    if (meta.lawyer) {
      const rank = { no: 0, advisable: 1, necessary: 2 };
      if (!cf.lawyer || rank[meta.lawyer] >= rank[cf.lawyer]) { cf.lawyer = meta.lawyer; if (meta.lawyerWhy) cf.lawyerWhy = meta.lawyerWhy; }
    }
  }
  if (!add || typeof add !== 'object') return;
  if (add.title && !cf.title) cf.title = String(add.title).slice(0, 80);
  ['amount', 'goal'].forEach((k) => { if (add[k] && typeof add[k] === 'string') cf[k] = add[k].slice(0, 160); });
  for (const k of CASE_ARRAYS) {
    if (!Array.isArray(add[k])) continue;
    cf[k] ||= [];
    for (const item of add[k]) {
      const norm = k === 'timeline' ? (item && item.what ? { when: String(item.when || '').slice(0, 40), what: String(item.what).slice(0, 160) } : null) : String(item || '').trim().slice(0, 160);
      if (!norm) continue;
      const key = (k === 'timeline' ? norm.what : norm).toLowerCase();
      if (cf[k].some((x) => (k === 'timeline' ? x.what : x).toLowerCase() === key)) continue;
      cf[k].push(norm);
    }
    cf[k] = cf[k].slice(-12);
  }
}

function caseCount(cf) { return CASE_ARRAYS.reduce((n, k) => n + (cf?.[k]?.length || 0), 0); }

function renderCase() {
  const chat = current();
  const cf = chat?.caseFile || {};
  const n = caseCount(cf);
  const badge = $('#caseCount');
  badge.hidden = !n; badge.textContent = n;
  const T = t();
  const L = uiLang() === 'hi' ? 2 : 1;
  const list = (k, label, cls = '') => (cf[k]?.length ? `<section class="cf-sec ${cls}"><h5>${esc(label)}</h5><ul>${cf[k].map((x, i) => `<li>${k === 'missing'
    ? `<label><input type="checkbox" data-collect="${i}" ${cf.collected?.includes(x) ? 'checked' : ''}> <span>${esc(x)}</span></label>`
    : k === 'timeline' ? `<span class="when">${esc(x.when || '—')}</span><span>${esc(x.what)}</span>` : esc(x)}<button class="rm" data-rm="${k}:${i}" title="${esc(T.delete)}">×</button></li>`).join('')}</ul></section>` : '');
  const lawyer = cf.lawyer || 'no';
  $('#casePanel').innerHTML = `
    <div class="cp-head"><h3>${ic('folder')} ${esc(T.caseFile)}</h3><button class="icon" id="closeCase">${ic('x')}</button></div>
    <div class="cp-body">
    ${n || cf.title ? `
      ${cf.title ? `<h4 class="cf-title">${esc(cf.title)}</h4>` : ''}
      <div class="cf-chips">${cf.domain ? `<span class="chip-s">${esc(domainLabel(cf.domain))}</span>` : ''}${cf.state ? `<span class="chip-s">📍 ${esc(cf.state)}</span>` : ''}${cf.urgency ? `<span class="chip-s ${cf.urgency}">${cf.urgency === 'emergency' ? '🚨' : '⏱'} ${esc(cf.urgency)}</span>` : ''}</div>
      ${cf.amount || cf.goal ? `<div class="cf-kv">${cf.amount ? `<div><small>${esc(T.amount)}</small><b>${esc(cf.amount)}</b></div>` : ''}${cf.goal ? `<div><small>${esc(T.goal)}</small><b>${esc(cf.goal)}</b></div>` : ''}</div>` : ''}
      ${list('parties', T.parties)}${list('facts', T.facts)}${list('timeline', T.timeline, 'tl')}${list('evidence', T.evidence, 'ev')}${list('missing', T.missing, 'miss')}
      <section class="lawyer-meter l-${lawyer}"><h5>${esc(T.lawyerQ)}</h5>
        <div class="meter"><i></i><i></i><i></i></div><b>${esc(T.lawyer[lawyer])}</b>${cf.lawyerWhy ? `<p>${esc(cf.lawyerWhy)}</p>` : ''}
        <p class="aid">${ic('phone')} ${esc(T.freeAid)}</p></section>
      <div class="cf-actions">
        <button class="btn primary sm" data-case="draft">${ic('file')}${esc(T.draftFromCase)}</button>
        <button class="btn soft sm" data-case="practice">${ic('swords')}${esc(T.practiceFromCase)}</button>
        <button class="btn soft sm" data-case="print">${ic('printer')}${esc(T.exportCase)}</button>
      </div>` : `<p class="cf-empty">${ic('folder', 'big')}${esc(T.caseEmpty)}</p>`}
      <section class="helplines"><h5>${esc(T.helplines)}</h5>${HELPLINES.map(([num, en, hi]) => `<a href="tel:${num}">${ic('phone')}<b>${num}</b><span>${esc(L === 2 ? hi : en)}</span></a>`).join('')}</section>
    </div>`;
}

// ------------------------------------------------------------------ composer
function renderComposer() {
  const chat = current();
  const mode = chat?.mode || S.draftMode.mode;
  const T = t();
  const L = uiLang() === 'hi' ? 1 : 0;
  $('#modes').innerHTML = ['advice', 'draft', 'practice', 'explain'].map((k) => `<button role="tab" data-mode="${k}" aria-selected="${k === mode}" title="${esc(T.modeHint[k])}">${ic({ advice: 'scale', draft: 'file', practice: 'swords', explain: 'book' }[k])}<span>${esc(T.modes[k])}</span></button>`).join('');
  const row = $('#modeRow');
  if (mode === 'draft') {
    row.hidden = false;
    row.innerHTML = `<label>${esc(T.docType)} <select id="docType">${DOC_TYPES.map((d, i) => `<option value="${i}" ${i === (chat?.docType ?? S.draftMode.docType) ? 'selected' : ''}>${esc(d[L])}</option>`).join('')}</select></label><span class="hint">${esc(T.modeHint.draft)}</span>`;
  } else if (mode === 'practice') {
    const msgs = chat?.messages || [];
    const lastStart = msgs.map((m) => m.cmd).lastIndexOf('START_PRACTICE');
    const inPractice = lastStart >= 0 && lastStart > msgs.map((m) => m.cmd).lastIndexOf('END_PRACTICE');
    row.hidden = false;
    row.innerHTML = `<label>${esc(T.role)} <select id="roleSel">${ROLES.map((r, i) => `<option value="${i}" ${i === (chat?.role ?? S.draftMode.role) ? 'selected' : ''}>${esc(r[L])}</option>`).join('')}</select></label>
      <button class="btn primary sm" id="startPractice">${ic('swords')}${esc(T.startPractice)}</button>
      ${inPractice ? `<button class="btn soft sm" id="endPractice">${ic('check')}${esc(T.endPractice)}</button>` : ''}`;
  } else if (mode === 'explain') {
    row.hidden = false;
    row.innerHTML = `<span class="hint">${ic('clip')} ${esc(T.modeHint.explain)}</span>`;
  } else { row.hidden = true; row.innerHTML = ''; }
  $('#input').placeholder = { advice: T.placeholder, draft: T.placeholderDraft, practice: T.placeholderPractice, explain: T.placeholderExplain }[mode];
  setSendState();
}

function setSendState() {
  const btn = $('#sendBtn');
  btn.innerHTML = ic(S.busy ? 'stop' : 'send');
  btn.classList.toggle('busy', S.busy);
  btn.setAttribute('aria-label', S.busy ? t().stopGen : t().send);
}

function autoGrow() { const ta = $('#input'); ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`; }

function renderAttachChip() {
  const chip = $('#attachChip');
  const a = S.attachment;
  if (!a) { chip.hidden = true; chip.innerHTML = ''; return; }
  chip.hidden = false;
  chip.innerHTML = a.status
    ? `<i class="spin"></i> ${esc(a.status)}`
    : `${ic('file')} <b>${esc(a.name)}</b> <span class="muted">${a.text.length.toLocaleString()} chars${a.truncated ? ' (trimmed)' : ''}</span><button class="rm" id="rmAttach">×</button>`;
}

// ------------------------------------------------------------------ sending & streaming
function ensureChat() {
  let chat = current();
  if (!chat) {
    chat = newChatObj();
    chat.mode = S.draftMode.mode; chat.docType = S.draftMode.docType; chat.role = S.draftMode.role;
    S.chats.push(chat);
    S.currentId = chat.id;
  }
  return chat;
}

function historyFor(chat, uptoIndex) {
  // short-term memory: the 10 most recent messages before this turn (+ any not yet summarised)
  const prior = chat.messages.slice(0, uptoIndex).filter((m) => !m.error && m.content);
  const start = Math.max(0, Math.min(prior.length - WINDOW, chat.summarizedCount));
  return prior.slice(start).slice(-(WINDOW + 4)).map((m) => ({ role: m.role, content: m.role === 'assistant' ? stripTags(m.content) : m.content }));
}
const stripTags = (s) => s.replace(/\[\[[\s\S]*?\]\]/g, '').trim();

async function send(text, { cmd = null, display = null } = {}) {
  if (S.busy) return;
  const chat = ensureChat();
  const attachment = S.attachment && !S.attachment.status ? S.attachment : null;
  text = (text || '').trim();
  if (!text && !attachment && !cmd) return;
  tts.stop();

  let content = cmd || text;
  if (attachment) {
    if (chat.mode === 'advice') chat.mode = 'explain';
    content = `${text || (uiLang() === 'hi' ? 'कृपया यह दस्तावेज़ समझाइए।' : 'Please explain this document to me.')}\n\n<<DOCUMENT: ${attachment.name}>>\n${attachment.text}\n<<END DOCUMENT>>`;
  }
  const L = uiLang() === 'hi' ? 1 : 0;
  const userMsg = { id: uid(), role: 'user', content, ts: Date.now(), mode: chat.mode };
  if (attachment) { userMsg.display = text || '📄'; userMsg.attachment = { name: attachment.name, text: attachment.text }; }
  if (cmd) { userMsg.cmd = cmd; userMsg.roleLabel = ROLES[chat.role]?.[L]; }
  if (display) userMsg.display = display;

  if (!chat.title && !cmd) chat.title = (text || attachment?.name || '').slice(0, 48);
  const idx = chat.messages.length;
  chat.messages.push(userMsg);
  S.attachment = null; renderAttachChip();
  $('#input').value = ''; autoGrow();

  const thread = $('#thread');
  if (idx === 0) thread.innerHTML = '';
  thread.appendChild(messageEl(userMsg, chat));

  const ai = { id: uid(), role: 'assistant', content: '', ts: Date.now(), mode: chat.mode, stages: [], streaming: true };
  chat.messages.push(ai);
  const el = messageEl(ai, chat);
  thread.appendChild(el);
  scrollDown(true);
  renderSidebar();
  await stream(chat, ai, el, {
    message: content,
    mode: chat.mode,
    lang: S.settings.lang,
    history: historyFor(chat, idx),
    summary: chat.summary,
    caseFile: chat.caseFile,
    docType: DOC_TYPES[chat.docType]?.[0],
    role: ROLES[chat.role]?.[0],
  });
}

let raf = 0;
async function stream(chat, ai, el, payload) {
  const mode0 = payload.mode;
  S.busy = true; setSendState();
  S.abort = new AbortController();
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintAssistant(el, ai, chat, true); scrollDown(); }); };
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: S.abort.signal });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'stage') { ai.stages.push(ev.stage); schedule(); }
        else if (ev.type === 'meta') {
          ai.meta = ev.meta; chat.meta = { ...chat.meta, ...Object.fromEntries(Object.entries(ev.meta).filter(([k, v]) => v && !(k === 'domain' && v === 'other') && !(k === 'urgency' && v === 'none' && mode0 === 'practice'))) };
          mergeCase(chat, ev.meta, ev.caseAdd);
          if (ev.caseAdd?.title && (!chat.title || chat.title === payload.message.slice(0, 48))) chat.title = chat.caseFile.title || chat.title;
          $('#chatTitle').textContent = chat.title || t().newChat;
          renderCase(); schedule();
          if (!chat.caseShown && caseCount(chat.caseFile) && innerWidth >= 1200) { chat.caseShown = true; openPanel('case', true); }
        } else if (ev.type === 'sources') { ai.sources = ev.items; }
        else if (ev.type === 'token') { ai.content += ev.t; schedule(); }
        else if (ev.type === 'guard') { ai.guard = ev.items; }
        else if (ev.type === 'done') { ai.stats = ev.stats; }
        else if (ev.type === 'error') { ai.error = ev.message; }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') { if (!ai.content) ai.content = '…'; }
    else ai.error = navigator.onLine ? t().error : 'You are offline.';
  } finally {
    cancelAnimationFrame(raf); raf = 0;
    ai.streaming = false;
    S.busy = false; S.abort = null; setSendState();
    chat.updatedAt = Date.now();
    paintAssistant(el, ai, chat, false);
    scrollDown();
    renderSidebar(); renderComposer();
    save(true);
    if (ai.content && !ai.error && S.settings.autoSpeak) tts.speak(speakable(ai.content), ai.meta?.lang, () => S.settings.handsFree && startMic(true));
    else if (S.settings.handsFree && !ai.error) startMic(true);
    compactMemory(chat);
  }
}

// Long-term memory: fold messages that left the 10-message window into a running summary.
async function compactMemory(chat) {
  const msgs = chat.messages.filter((m) => !m.error && m.content);
  const outOfWindow = msgs.length - WINDOW;
  if (outOfWindow - chat.summarizedCount < 2) return;
  const batch = msgs.slice(chat.summarizedCount, outOfWindow).slice(0, 10)
    .map((m) => ({ role: m.role, content: m.attachment ? `${m.display} [attached ${m.attachment.name}]` : stripTags(m.content) }));
  try {
    const r = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: chat.summary, messages: batch }) });
    const j = await r.json();
    if (r.ok && j.summary) { chat.summary = j.summary; chat.summarizedCount += batch.length; save(); }
  } catch { /* retried next turn */ }
}

function scrollDown(force = false) {
  const th = $('#thread');
  if (force || th.scrollHeight - th.scrollTop - th.clientHeight < 160) th.scrollTop = th.scrollHeight;
}

// ------------------------------------------------------------------ voice
const voice = new VoiceInput({
  onText: (text, final) => {
    const ta = $('#input');
    ta.value = (voice.base ? `${voice.base} ` : '') + text;
    autoGrow();
    if (final && voice.autoSend && ta.value.trim()) send(ta.value);
  },
  onState: (st) => {
    const b = $('#micBtn');
    b.classList.toggle('live', st === 'listening');
    b.classList.toggle('wait', st === 'transcribing');
    $('#composer').classList.toggle('listening', st === 'listening');
    if (st === 'listening') toast(t().listening, 1500);
    if (st === 'transcribing') toast(t().transcribing, 4000);
  },
  onError: (e) => toast(e === 'not-allowed' ? t().micDenied : `Mic: ${e}`),
});

function micLang() {
  if (S.settings.lang !== 'auto') return S.settings.lang;
  const l = current()?.meta?.lang;
  return l === 'hi' || l === 'hinglish' ? 'hi' : uiLang();
}
function startMic(autoSend = false) {
  if (!voice.available) { toast('Voice input is not supported in this browser.'); return; }
  if (voice.active) { voice.stop(); return; }
  tts.stop();
  voice.base = $('#input').value.trim();
  voice.autoSend = autoSend || S.settings.handsFree;
  voice.start(micLang(), { autoStop: voice.autoSend });
}

// ------------------------------------------------------------------ misc UI helpers
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => toast(t().copied), () => toast('Copy failed'));
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function printHtml(title, bodyHtml) {
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font:15px/1.6 "Noto Serif","Tiro Devanagari Hindi",Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}
    h1{font-size:20px} h2{font-size:16px;margin-top:22px;border-bottom:1px solid #ccc} pre{white-space:pre-wrap;font:inherit}
    .foot{margin-top:30px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:8px} li{margin:3px 0}</style></head>
    <body>${bodyHtml}<p class="foot">Prepared with Nyay Sahayak — general legal information, not legal advice. ${new Date().toLocaleString()}</p>
    <script>onload=()=>{print()}<\/script></body></html>`);
  w.document.close();
}

function caseSummaryHtml(chat) {
  const cf = chat.caseFile, T = t();
  const ul = (arr, f = (x) => esc(x)) => (arr?.length ? `<ul>${arr.map((x) => `<li>${f(x)}</li>`).join('')}</ul>` : '<p>—</p>');
  return `<h1>${esc(T.caseFile)}: ${esc(cf.title || chat.title)}</h1>
    <p><b>${esc(domainLabel(cf.domain))}</b>${cf.state ? ` · ${esc(cf.state)}` : ''}${cf.amount ? ` · ${esc(T.amount)}: ${esc(cf.amount)}` : ''}</p>
    ${cf.goal ? `<p><b>${esc(T.goal)}:</b> ${esc(cf.goal)}</p>` : ''}
    <h2>${esc(T.parties)}</h2>${ul(cf.parties)}<h2>${esc(T.facts)}</h2>${ul(cf.facts)}
    <h2>${esc(T.timeline)}</h2>${ul(cf.timeline, (x) => `<b>${esc(x.when || '—')}</b> — ${esc(x.what)}`)}
    <h2>${esc(T.evidence)}</h2>${ul(cf.evidence)}<h2>${esc(T.missing)}</h2>${ul(cf.missing, (x) => `${cf.collected?.includes(x) ? '☑' : '☐'} ${esc(x)}`)}
    <h2>${esc(T.lawyerQ)}</h2><p>${esc(T.lawyer[cf.lawyer || 'no'])}. ${esc(cf.lawyerWhy || '')}</p><p>${esc(T.freeAid)}</p>
    ${chat.summary ? `<h2>${esc(T.memory)}</h2><p>${esc(chat.summary)}</p>` : ''}`;
}

function setMode(mode) {
  const chat = current();
  if (chat) chat.mode = mode; else S.draftMode.mode = mode;
  renderComposer(); save();
  if (mode === 'explain') $('#fileInput').click();
  $('#input').focus();
}

function openPanel(which, open) {
  document.body.classList.toggle(`${which}-open`, open);
  $('#scrim').classList.toggle('show', document.body.classList.contains('sidebar-open') || (document.body.classList.contains('case-open') && innerWidth < 1200));
}

function selectChat(id) {
  S.currentId = id; tts.stop();
  renderAll(); save();
  openPanel('sidebar', false);
}

function renderAll() { applyStatic(); renderSidebar(); renderThread(); renderCase(); renderComposer(); }

// ------------------------------------------------------------------ events
function bind() {
  $('#newChat').onclick = () => { if (S.busy) return; S.currentId = null; S.draftMode.mode = 'advice'; localStorage.removeItem(KEY.current); renderAll(); openPanel('sidebar', false); $('#input').focus(); };
  $('#chatSearch').oninput = renderSidebar;
  $('#chatList').onclick = (e) => {
    const item = e.target.closest('.chat-item'); if (!item) return;
    const chat = S.chats.find((c) => c.id === item.dataset.id);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'delete') {
      if (!confirm(t().confirmDelete)) return;
      S.chats = S.chats.filter((c) => c !== chat);
      if (S.currentId === chat.id) S.currentId = null;
      save(true); renderAll(); return;
    }
    if (act === 'rename') { const n = prompt(t().rename, chat.title); if (n?.trim()) { chat.title = n.trim().slice(0, 60); save(); renderAll(); } return; }
    if (!S.busy) selectChat(chat.id);
  };
  $('#chatList').onkeydown = (e) => { if (e.key === 'Enter') e.target.closest('.chat-item')?.click(); };
  $('#chatTitle').onclick = () => { const c = current(); if (!c) return; const n = prompt(t().rename, c.title); if (n?.trim()) { c.title = n.trim().slice(0, 60); save(); renderAll(); } };

  $('#langSeg').onclick = (e) => { const b = e.target.closest('[data-lang]'); if (!b) return; S.settings.lang = b.dataset.lang; save(); renderAll(); };
  $('#themeBtn').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    S.settings.theme = dark ? 'dark' : 'light'; save(); applyStatic();
  };
  $('#speakToggle').onclick = () => { S.settings.autoSpeak = !S.settings.autoSpeak; if (!S.settings.autoSpeak) tts.stop(); save(); applyStatic(); toast(`${t().autoSpeak}: ${S.settings.autoSpeak ? 'ON' : 'OFF'}`); };
  $('#settingsBtn').onclick = () => {
    $('#setAutoSpeak').checked = S.settings.autoSpeak; $('#setHandsFree').checked = S.settings.handsFree;
    const h = S.health;
    $('#healthInfo').textContent = h.ok ? `AI: ${h.llm ? '✓' : '✗'} · Semantic (bge-m3) search: ${h.denseRetrieval ? '✓' : 'keyword only'} · Web research: ${h.webSearch ? '✓' : '✗'} · Voice: ${voice.native ? 'browser' : 'Whisper'}` : '';
    $('#settingsDlg').showModal();
  };
  $('#setAutoSpeak').onchange = (e) => { S.settings.autoSpeak = e.target.checked; save(); applyStatic(); };
  $('#setHandsFree').onchange = (e) => { S.settings.handsFree = e.target.checked; if (e.target.checked) S.settings.autoSpeak = true; save(); applyStatic(); };
  $('#exportBtn').onclick = () => downloadFile(`nyay-sahayak-chats-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, chats: S.chats }, null, 2), 'application/json');
  $('#importInput').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const incoming = (data.chats || []).filter((c) => c.id && Array.isArray(c.messages));
      const ids = new Set(S.chats.map((c) => c.id));
      S.chats.push(...incoming.filter((c) => !ids.has(c.id)));
      save(true); renderAll(); toast(`Imported ${incoming.length} chats`);
    } catch { toast('Invalid file'); }
    e.target.value = '';
  };

  $('#menuBtn').onclick = () => openPanel('sidebar', true);
  $('#closeSidebar').onclick = () => openPanel('sidebar', false);
  $('#caseBtn').onclick = () => openPanel('case', !document.body.classList.contains('case-open'));
  $('#scrim').onclick = () => { openPanel('sidebar', false); openPanel('case', false); };

  $('#memoryBtn').onclick = (e) => {
    e.stopPropagation();
    const pop = $('#memoryPop'); const c = current();
    const n = Math.min(WINDOW, c?.messages.length || 0);
    pop.innerHTML = `<b>${ic('brain')} ${esc(t().memory)}</b><p>${esc(t().memoryInfo(n))}</p><p class="${c?.summary ? '' : 'muted'}">${esc(c?.summary || t().memoryNone)}</p>`;
    pop.hidden = !pop.hidden;
  };
  document.addEventListener('click', (e) => { if (!e.target.closest('#memoryPop')) $('#memoryPop').hidden = true; });

  // composer
  const ta = $('#input');
  ta.oninput = autoGrow;
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } };
  $('#sendBtn').onclick = () => (S.busy ? S.abort?.abort() : send(ta.value));
  $('#micBtn').onclick = () => startMic(false);
  $('#modes').onclick = (e) => { const b = e.target.closest('[data-mode]'); if (b && !S.busy) setMode(b.dataset.mode); };
  $('#modeRow').onchange = (e) => {
    const chat = current();
    if (e.target.id === 'docType') { const v = +e.target.value; if (chat) chat.docType = v; else S.draftMode.docType = v; }
    if (e.target.id === 'roleSel') { const v = +e.target.value; if (chat) chat.role = v; else S.draftMode.role = v; }
    save();
  };
  $('#modeRow').onclick = (e) => {
    if (e.target.closest('#startPractice')) { ensureChat().mode = 'practice'; send('', { cmd: 'START_PRACTICE' }); }
    if (e.target.closest('#endPractice')) send('', { cmd: 'END_PRACTICE' });
  };
  $('#fileInput').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    S.attachment = { name: f.name, status: /^image\//.test(f.type) ? t().attachOcr : t().attachReading };
    renderAttachChip();
    try {
      const r = await extractText(f, (kind, pct) => { if (S.attachment) { S.attachment.status = kind === 'ocr' ? `${t().attachOcr} ${pct ?? ''}%` : t().attachReading; renderAttachChip(); } });
      S.attachment = r;
      const chat = current();
      if ((chat?.mode || S.draftMode.mode) === 'advice') setMode('explain');
    } catch (err) { S.attachment = null; toast(`${t().attachFail} (${err.message})`, 4000); }
    renderAttachChip();
  };
  $('#attachChip').onclick = (e) => { if (e.target.id === 'rmAttach') { S.attachment = null; renderAttachChip(); } };

  // thread (event delegation)
  $('#thread').onclick = (e) => {
    const prob = e.target.closest('[data-prob]');
    if (prob) {
      const p = PROBLEMS[+prob.dataset.prob];
      if (p.mode === 'explain') { setMode('explain'); return; }
      send(p[uiLang()][1]); return;
    }
    if (e.target.closest('#heroMic')) { startMic(false); return; }
    const fu = e.target.closest('[data-follow]');
    if (fu) {
      const q = fu.dataset.follow;
      if (/draft|notice|ड्राफ़्ट|नोटिस|letter|complaint|शिकायत/i.test(q) && current()?.mode === 'advice') setMode('draft');
      send(q); return;
    }
    const cite = e.target.closest('.cite');
    if (cite) {
      const msg = cite.closest('.msg');
      const det = $('details.sources', msg);
      if (det) {
        det.open = true;
        const li = $(`#src-${msg.dataset.id}-${cite.dataset.cite}`);
        if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1400); }
      }
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const msgEl = e.target.closest('.msg');
    const chat = current();
    const m = chat?.messages.find((x) => x.id === msgEl?.dataset.id);
    if (!m) return;
    const p = parseAnswer(m.content);
    const draftText = () => $('.draft-body', msgEl)?.innerText || p.draft?.text || '';
    if (act === 'copy') copyText(stripTags(m.content));
    if (act === 'speak') { if (tts.speaking) tts.stop(); else tts.speak(speakable(m.content), m.meta?.lang); }
    if (act === 'draft-copy') copyText(draftText());
    if (act === 'draft-edit') {
      const body = $('.draft-body', msgEl);
      const on = body.getAttribute('contenteditable') !== 'true';
      body.setAttribute('contenteditable', on); body.classList.toggle('editing', on);
      if (on) body.focus();
    }
    if (act === 'draft-doc') {
      const html = `<html><head><meta charset="utf-8"></head><body style="font-family:'Times New Roman',serif;font-size:12pt;white-space:pre-wrap">${esc(draftText())}</body></html>`;
      downloadFile(`${(chat.caseFile.title || 'draft').replace(/[^\wऀ-ॿ]+/g, '-').slice(0, 40)}.doc`, html, 'application/msword');
    }
    if (act === 'draft-print') printHtml(t().draftTitle, `<pre>${esc(draftText())}</pre>`);
    if (act === 'retry') {
      const i = chat.messages.indexOf(m);
      const u = chat.messages[i - 1];
      chat.messages.splice(i - 1, 2);
      renderThread();
      if (u.attachment) S.attachment = { name: u.attachment.name, text: u.attachment.text };
      send(u.cmd ? '' : (u.attachment ? u.display.replace('📄', '') : u.content), { cmd: u.cmd });
    }
  };

  // case panel
  $('#casePanel').onclick = (e) => {
    const chat = current();
    if (e.target.closest('#closeCase')) { openPanel('case', false); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm && chat) { const [k, i] = rm.dataset.rm.split(':'); chat.caseFile[k].splice(+i, 1); save(); renderCase(); return; }
    const a = e.target.closest('[data-case]')?.dataset.case;
    if (!a || !chat || S.busy) return;
    if (a === 'print') printHtml(t().caseFile, caseSummaryHtml(chat));
    if (a === 'draft') { chat.mode = 'draft'; chat.docType = 0; renderComposer(); send(uiLang() === 'hi' ? 'मेरे केस के आधार पर लीगल नोटिस का ड्राफ़्ट बनाइए।' : 'Draft a legal notice based on my case file.'); openPanel('case', false); }
    if (a === 'practice') { chat.mode = 'practice'; renderComposer(); openPanel('case', false); $('#roleSel')?.focus(); }
  };
  $('#casePanel').onchange = (e) => {
    const chat = current(); const i = e.target.dataset.collect;
    if (i === undefined || !chat) return;
    const item = chat.caseFile.missing[+i];
    chat.caseFile.collected ||= [];
    chat.caseFile.collected = e.target.checked ? [...new Set([...chat.caseFile.collected, item])] : chat.caseFile.collected.filter((x) => x !== item);
    save();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { openPanel('sidebar', false); if (innerWidth < 1200) openPanel('case', false); tts.stop(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#newChat').click(); }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (ev) => {
    if (S.settings.theme === 'system') { document.documentElement.dataset.theme = ev.matches ? 'dark' : 'light'; applyStatic(); }
  });
}

// ------------------------------------------------------------------ boot
function boot() {
  S.chats = S.chats.filter((c) => c && c.id && Array.isArray(c.messages));
  // drop half-finished replies from a previous session
  S.chats.forEach((c) => c.messages.forEach((m) => { if (m.streaming) { m.streaming = false; if (!m.content) m.error = t().error; } }));
  if (!current()?.messages?.length) S.currentId = null;
  bind();
  renderAll();
  if (innerWidth >= 1200 && caseCount(current()?.caseFile)) openPanel('case', true);
  fetch('/api/health').then((r) => r.json()).then((h) => { S.health = h; }).catch(() => {});
  $('#input').focus({ preventScroll: true });
}
boot();
