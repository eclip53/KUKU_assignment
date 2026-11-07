// POST /api/chat — the 4-agent pipeline, streamed to the browser as NDJSON events.
//
//  Agent 1  Intake & Router (gpt-oss-20b, JSON)   ─┐ run in parallel
//           bge-m3 query embedding (HF API)       ─┘
//  Agent 2  Self-RAG retrieval: hybrid BM25 + dense search, relevance grading, web decision
//  Agent 3  Web research (Tavily, only when the handbook is not enough)
//  Agent 4  Guidance / Drafting / Practice (gpt-oss-120b, streamed)
//  Post     Citation Guard (deterministic, 0 tokens)
import { chatJSON, chatStream } from '../lib/groq.js';
import { routerMessages, answerMessages } from '../lib/prompts.js';
import { searchHandbook, embedQuery } from '../lib/retrieval.js';
import { webSearch } from '../lib/web.js';
import { citationGuard } from '../lib/guard.js';

const MODES = new Set(['advice', 'draft', 'practice', 'explain']);
const HINGLISH = /\b(hai|hain|mera|meri|mujhe|nahi|nahin|kya|kaise|kyun|paisa|paise|karna|kar|raha|rahi|wala|unhone|maine|ghar|kiraya|naukri|batao|madad)\b/i;

function guessLang(text) {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  return HINGLISH.test(text) ? 'hinglish' : 'en';
}

function sanitizeHistory(h) {
  if (!Array.isArray(h)) return [];
  return h
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10) // short-term memory window: 10 most recent messages
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const message = String(body.message || '').trim().slice(0, 9000);
  if (!message) return Response.json({ error: 'Empty message' }, { status: 400 });
  const mode = MODES.has(body.mode) ? body.mode : 'advice';
  const langPref = ['en', 'hi', 'auto'].includes(body.lang) ? body.lang : 'auto';
  const recent = sanitizeHistory(body.history);
  const summary = String(body.summary || '').slice(0, 1500);
  const caseFile = body.caseFile && typeof body.caseFile === 'object' ? body.caseFile : {};
  const docType = String(body.docType || '').slice(0, 80);
  const role = String(body.role || '').slice(0, 80);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      const t0 = Date.now();
      const usage = { prompt: 0, completion: 0 };
      const addUsage = (u) => { if (u) { usage.prompt += u.prompt_tokens || 0; usage.completion += u.completion_tokens || 0; } };

      try {
        send({ type: 'stage', stage: 'understand' });
        const isPracticeTurn = mode === 'practice';
        const lastUser = [...recent].reverse().find((m) => m.role === 'user')?.content || '';

        // ---- Agent 1 (router) + query embedding, in parallel ----
        const [routed, vector] = await Promise.all([
          isPracticeTurn
            ? Promise.resolve(null)
            : chatJSON(routerMessages({ message, recent: recent.slice(-4), summary, caseFile, mode }))
              .then((r) => { addUsage(r.usage); return r.data; })
              .catch((e) => { console.error('router', e.message); return null; }),
          isPracticeTurn ? Promise.resolve(null) : embedQuery(`${lastUser.slice(-400)}\n${message}`.trim()),
        ]);

        const r = routed || {};
        const langSample = /^(START|END)_PRACTICE$/.test(message)
          ? [...recent].reverse().find((m) => m.role === 'user' && !/_PRACTICE$/.test(m.content))?.content || message
          : message;
        const detected = ['en', 'hi', 'hinglish'].includes(r.lang) ? r.lang : guessLang(langSample);
        const lang = langPref === 'auto' ? detected : langPref;
        const meta = {
          lang,
          kind: r.kind || 'legal',
          domain: r.domain || caseFile.domain || 'other',
          state: r.state || caseFile.state || '',
          urgency: ['none', 'high', 'emergency'].includes(r.urgency) ? r.urgency : 'none',
          lawyer: ['no', 'advisable', 'necessary'].includes(r.lawyer) ? r.lawyer : 'no',
          lawyerWhy: r.lawyer_why || '',
        };
        send({ type: 'meta', meta, caseAdd: r.case || null });

        // ---- Agent 2 (Self-RAG) + Agent 3 (web) ----
        let evidence = [];
        let retrieval = { mode: 'skipped', web: false };
        if (!isPracticeTurn && meta.kind === 'legal') {
          send({ type: 'stage', stage: 'search' });
          const queryEn = r.query_en || message;
          const hb = searchHandbook({ queryEn, rawQuery: message, vector, k: 3 });
          evidence = hb.passages;
          const weakBar = hb.dense ? Number(process.env.WEB_THRESHOLD || 0.55) : 0.6;
          const weak = hb.passages.length === 0 || hb.top < weakBar;
          const needWeb = mode !== 'draft' ? (r.web === true || weak) : (r.web === true && weak);
          retrieval = { mode: hb.mode, top: hb.top, web: false };
          if (needWeb && process.env.TAVILY_API_KEY) {
            send({ type: 'stage', stage: 'web' });
            const web = await webSearch(`${queryEn} ${meta.state || ''}`.trim());
            evidence = [...evidence, ...web];
            retrieval.web = web.length > 0;
          }
          send({
            type: 'sources',
            items: evidence.map((e) => ({ ...e, text: e.text.slice(0, 320) })),
          });
        }

        // ---- Agent 4 (answer, streamed) ----
        send({ type: 'stage', stage: 'write' });
        const msgs = answerMessages({ mode, lang, docType, role, message, recent, summary, caseFile, evidence, meta });
        const maxTokens = mode === 'draft' ? 2600 : lang === 'en' ? 1500 : 2200; // Devanagari needs more tokens
        const gen = chatStream(msgs, { maxTokens, signal: request.signal });
        let answer = '';
        let firstTokenMs = null;
        let res;
        for (;;) {
          res = await gen.next();
          if (res.done) break;
          if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
          answer += res.value;
          send({ type: 'token', t: res.value });
        }
        addUsage(res.value?.usage);

        // ---- Citation Guard ----
        // the user's own words / attached document are a legitimate source for references too
        const guardEvidence = [...evidence, { id: 'USER', kind: 'user', text: `${message}\n${recent.map((m) => m.content).join('\n')}` }];
        const guard = mode === 'practice' ? [] : citationGuard(answer, guardEvidence);
        if (guard.length) send({ type: 'guard', items: guard });

        send({
          type: 'done',
          stats: {
            ms: Date.now() - t0, firstTokenMs, model: res.value?.model, retrieval,
            tokens: usage.prompt + usage.completion, promptTokens: usage.prompt, completionTokens: usage.completion,
          },
        });
      } catch (e) {
        console.error(e);
        const rate = e.status === 429;
        send({
          type: 'error',
          message: rate
            ? 'The free AI quota is busy right now. Please wait a minute and try again.'
            : 'Something went wrong while preparing the answer. Please try again.',
          detail: process.env.DEBUG ? e.message : undefined,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
