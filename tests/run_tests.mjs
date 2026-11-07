// Runs tests/cases.json against a running deployment and saves RAW outputs.
//   node tests/run_tests.mjs https://your-app.vercel.app        (or http://localhost:3000)
//   node tests/run_tests.mjs http://localhost:3000 07_emergency_dv   (single case)
// Output: tests/outputs/<case>.md (readable transcript) + <case>.ndjson (raw stream) + SUMMARY.md
// The runner reproduces the browser's memory logic: last 10 messages + running summary.
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const ONLY = process.argv[3];
const PAUSE_MS = Number(process.env.PAUSE_MS || 4000); // free-tier friendly
const WINDOW = 10;
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'outputs');
fs.mkdirSync(OUT, { recursive: true });

const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).filter((c) => !ONLY || c.id === ONLY);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/\[\[[\s\S]*?\]\]/g, '').trim();

function mergeCase(cf, meta, add) {
  if (meta?.domain && meta.domain !== 'other') cf.domain = meta.domain;
  if (meta?.state) cf.state = meta.state;
  if (!add) return;
  if (add.title && !cf.title) cf.title = add.title;
  for (const k of ['amount', 'goal']) if (add[k]) cf[k] = add[k];
  for (const k of ['parties', 'facts', 'timeline', 'evidence', 'missing']) {
    if (!Array.isArray(add[k])) continue;
    cf[k] ||= [];
    for (const it of add[k]) {
      const key = JSON.stringify(it).toLowerCase();
      if (!cf[k].some((x) => JSON.stringify(x).toLowerCase() === key)) cf[k].push(it);
    }
  }
}

async function turn(payload) {
  const raw = [];
  const ev = { stages: [], answer: '', sources: [], guard: [], meta: null, caseAdd: null, stats: null, error: null };
  const res = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) { ev.error = `HTTP ${res.status}: ${await res.text()}`; return { ev, raw }; }
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.trim()) continue;
      raw.push(line);
      const e = JSON.parse(line);
      if (e.type === 'stage') ev.stages.push(e.stage);
      if (e.type === 'meta') { ev.meta = e.meta; ev.caseAdd = e.caseAdd; }
      if (e.type === 'sources') ev.sources = e.items;
      if (e.type === 'token') ev.answer += e.t;
      if (e.type === 'guard') ev.guard = e.items;
      if (e.type === 'done') ev.stats = e.stats;
      if (e.type === 'error') ev.error = `${e.message} ${e.detail || ''}`;
    }
  }
  return { ev, raw };
}

const summaryRows = [];
for (const c of cases) {
  console.log(`\n▶ ${c.id}`);
  const chat = { messages: [], summary: '', summarizedCount: 0, caseFile: { ...(c.setupCase || {}) } };
  let md = `# ${c.id}\n\n**What this tests:** ${c.about}\n\n**Expected:** ${c.expect.map((x) => `\`${x}\``).join(', ')}\n\n**Run:** ${new Date().toISOString()} against \`${BASE}\`\n`;
  const rawAll = [];
  let totalTokens = 0, totalMs = 0;
  for (const [i, t] of c.turns.entries()) {
    const prior = chat.messages;
    const start = Math.max(0, Math.min(prior.length - WINDOW, chat.summarizedCount));
    const payload = {
      message: t.message, mode: t.mode || 'advice', lang: t.lang || 'auto',
      history: prior.slice(start).slice(-(WINDOW + 4)).map((m) => ({ role: m.role, content: m.role === 'assistant' ? strip(m.content) : m.content })),
      summary: chat.summary, caseFile: chat.caseFile, docType: t.docType, role: t.role,
    };
    const { ev, raw } = await turn(payload);
    rawAll.push(`// turn ${i + 1}`, ...raw);
    mergeCase(chat.caseFile, ev.meta, ev.caseAdd);
    chat.messages.push({ role: 'user', content: t.message }, { role: 'assistant', content: ev.answer });
    totalTokens += ev.stats?.tokens || 0; totalMs += ev.stats?.ms || 0;

    md += `\n---\n\n## Turn ${i + 1}${t.mode ? ` · mode: ${t.mode}` : ''}\n\n**User:**\n\n> ${t.message.replace(/\n/g, '\n> ')}\n\n`;
    md += `**Pipeline:** stages=\`${ev.stages.join(' → ')}\` · meta=\`${JSON.stringify(ev.meta)}\`\n\n`;
    if (ev.caseAdd) md += `<details><summary>Case-file additions (intake agent)</summary>\n\n\`\`\`json\n${JSON.stringify(ev.caseAdd, null, 2)}\n\`\`\`\n</details>\n\n`;
    if (ev.sources.length) md += `**Retrieved sources:**\n${ev.sources.map((s) => `- [${s.id}] ${s.kind === 'handbook' ? `Handbook — ${s.chapter}, p.${s.printedPage} (score ${s.score})` : `${s.title} — ${s.url} (${s.authority})`}`).join('\n')}\n\n`;
    md += `**Assistant (raw):**\n\n${ev.error ? `❌ ERROR: ${ev.error}` : ev.answer}\n\n`;
    if (ev.guard.length) md += `**Citation Guard:** ${ev.guard.map((g) => `${g.status === 'verified' ? '✅' : '⚠️'} \`${g.text}\``).join(' · ')}\n\n`;
    if (ev.stats) md += `**Stats:** ${ev.stats.tokens} tokens (prompt ${ev.stats.promptTokens} / completion ${ev.stats.completionTokens}) · first token ${ev.stats.firstTokenMs} ms · total ${ev.stats.ms} ms · model ${ev.stats.model} · retrieval ${JSON.stringify(ev.stats.retrieval)}\n`;
    console.log(`  turn ${i + 1}: ${ev.error ? 'ERROR ' + ev.error : `${ev.answer.length} chars, ${ev.stats?.tokens} tok, ${ev.stats?.ms} ms`}`);

    // background memory compaction, exactly like the browser does
    const outOfWindow = chat.messages.length - WINDOW;
    if (outOfWindow - chat.summarizedCount >= 2) {
      const batch = chat.messages.slice(chat.summarizedCount, outOfWindow).map((m) => ({ role: m.role, content: strip(m.content) }));
      const r = await fetch(`${BASE}/api/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: chat.summary, messages: batch }) });
      const j = await r.json().catch(() => ({}));
      if (j.summary) { chat.summary = j.summary; chat.summarizedCount += batch.length; md += `\n🧠 **Memory summary updated:** ${j.summary}\n`; }
    }
    await sleep(PAUSE_MS);
  }
  md += `\n---\n\n### Final case file\n\n\`\`\`json\n${JSON.stringify(chat.caseFile, null, 2)}\n\`\`\`\n`;
  fs.writeFileSync(path.join(OUT, `${c.id}.md`), md);
  fs.writeFileSync(path.join(OUT, `${c.id}.ndjson`), rawAll.join('\n'));
  summaryRows.push(`| ${c.id} | ${c.turns.length} | ${totalTokens} | ${(totalMs / 1000).toFixed(1)} s |`);
}

fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), `# Test run — ${new Date().toISOString()}\n\nTarget: ${BASE}\n\n| Case | Turns | Tokens | Time |\n|---|---|---|---|\n${summaryRows.join('\n')}\n`);
console.log(`\nSaved to ${OUT}`);
