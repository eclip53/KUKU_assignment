// Minimal Groq (OpenAI-compatible) client: no SDK, so cold starts stay fast.
const BASE = 'https://api.groq.com/openai/v1';

export const MODELS = {
  router: process.env.ROUTER_MODEL || 'openai/gpt-oss-20b',
  answer: process.env.ANSWER_MODEL || 'openai/gpt-oss-120b',
  fallback: process.env.FALLBACK_MODEL || 'openai/gpt-oss-20b',
  whisper: process.env.WHISPER_MODEL || 'whisper-large-v3',
};

const isReasoning = (m) => /gpt-oss|qwen3|deepseek-r1/i.test(m);

function body(model, messages, { maxTokens, json, stream, temperature = 0.3 }) {
  const b = { model, messages, temperature, max_completion_tokens: maxTokens, stream };
  if (isReasoning(model)) b.reasoning_effort = 'low'; // fewer hidden tokens, lower latency
  if (json) b.response_format = { type: 'json_object' };
  return b;
}

async function post(model, messages, opts) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Object.assign(new Error('GROQ_API_KEY is not set'), { status: 500 });
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body(model, messages, opts)),
    signal: opts.signal,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw Object.assign(new Error(`Groq ${r.status}: ${text.slice(0, 300)}`), { status: r.status });
  }
  return r;
}

const retriable = (e) => [429, 500, 502, 503, 413].includes(e.status) || e.name === 'TimeoutError';

/** Non-streaming JSON call (router / summariser). */
export async function chatJSON(messages, { model = MODELS.router, maxTokens = 700 } = {}) {
  if (process.env.MOCK_LLM) return { data: mockRouter(messages), usage: { total_tokens: 0 } };
  let r;
  try {
    r = await post(model, messages, { maxTokens, json: true, signal: AbortSignal.timeout(12000) });
  } catch (e) {
    if (!retriable(e) || model === MODELS.fallback) throw e;
    r = await post(MODELS.fallback, messages, { maxTokens, json: true, signal: AbortSignal.timeout(12000) });
  }
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '{}';
  return { data: safeJSON(txt), usage: j.usage };
}

/** Plain text call (summariser). */
export async function chatText(messages, { model = MODELS.router, maxTokens = 450 } = {}) {
  if (process.env.MOCK_LLM) return { text: 'User asked about a deposit dispute; advice on legal notice given.', usage: {} };
  const r = await post(model, messages, { maxTokens, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  return { text: (j.choices?.[0]?.message?.content || '').trim(), usage: j.usage };
}

/**
 * Streaming call. Yields text deltas; returns { usage, model } when finished.
 * Falls back to a second model on rate-limit / overload before any token is sent.
 */
export async function* chatStream(messages, { maxTokens = 1500, signal } = {}) {
  if (process.env.MOCK_LLM) { yield* mockStream(messages); return { usage: { total_tokens: 0 }, model: 'mock' }; }
  let model = MODELS.answer;
  let r;
  try {
    r = await post(model, messages, { maxTokens, stream: true, signal });
  } catch (e) {
    if (!retriable(e)) throw e;
    model = MODELS.fallback;
    r = await post(model, messages, { maxTokens, stream: true, signal });
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let usage = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content; // reasoning deltas are ignored
        if (delta) yield delta;
        if (j.usage) usage = j.usage;
        if (j.x_groq?.usage) usage = j.x_groq.usage;
      } catch { /* partial line */ }
    }
  }
  return { usage, model };
}

export function safeJSON(txt) {
  try { return JSON.parse(txt); } catch { /* fallthrough */ }
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
  return {};
}

export async function transcribe(blob, filename, language) {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('model', MODELS.whisper);
  fd.append('response_format', 'json');
  fd.append('temperature', '0');
  if (language === 'hi' || language === 'en') fd.append('language', language);
  const r = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: fd,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Object.assign(new Error(`Whisper ${r.status}: ${(await r.text()).slice(0, 200)}`), { status: r.status });
  return (await r.json()).text || '';
}

// ---------- offline mock (MOCK_LLM=1) so the UI + pipeline can be tested without keys ----------
function mockRouter(messages) {
  const u = messages[messages.length - 1].content;
  const hi = /[ऀ-ॿ]/.test(u);
  return {
    lang: hi ? 'hi' : 'en', kind: 'legal', domain: 'tenancy', state: 'Uttarakhand',
    query_en: 'security deposit landlord refund tenant consumer legal notice', web: false,
    urgency: /hit|maar|threat/i.test(u) ? 'emergency' : 'none', lawyer: 'advisable',
    lawyer_why: 'Amount is significant and the landlord has refused in writing.',
    case: {
      title: 'Security deposit not returned', parties: ['Tenant (you)', 'Landlord'],
      facts: ['Vacated the flat', 'Landlord refuses to return deposit'],
      timeline: [{ when: 'March 2026', what: 'Vacated flat' }], evidence: ['Rent agreement', 'UPI payment proofs'],
      missing: ['Move-out photos', 'Written refusal from landlord'], amount: '₹40,000', goal: 'Get deposit back',
    },
  };
}
async function* mockStream(messages) {
  const sys = messages[0].content;
  let text;
  if (sys.includes('ROLE-PLAY')) {
    text = 'Look, the flat needed painting after you left. I am keeping the deposit for that. Why should I pay you anything?\n[[COACH: Ask him to show the painting bill and point to the rent agreement clause on deductions.]]';
  } else if (sys.includes('DRAFT MODE')) {
    text = 'Here is a draft you can edit.\n\n---DRAFT START---\nLEGAL NOTICE\n\nTo,\n[Landlord name]\n[Address]\n\nSubject: Demand for refund of security deposit of ₹40,000\n\nI, [Your name], was your tenant at [address] from [date] to [date]...\n\nYours faithfully,\n[Your name]\n---DRAFT END---\n\n**Before you send:** fill every [placeholder], keep a copy, and send by registered post.\n[[FOLLOWUPS: How do I send this by registered post? | What if he ignores the notice? | Draft it in Hindi]]';
  } else {
    text = 'I understand how stressful this is — ₹40,000 is a lot of money to have stuck.\n\n### Where you stand\nA security deposit is usually refundable after deducting only genuine dues, as per your rent agreement [H1]. Under Section 27 of the Rent Act the landlord must pay interest.\n\n### What you can do\n1. **Ask in writing** — send a WhatsApp/email asking for the refund by a clear date.\n2. **Send a legal notice** — I can draft one for you.\n3. **Go to the Rent Authority or civil court** if he still refuses (verify the forum for your state).\n\n### Keep this proof\n- Rent agreement\n- UPI/bank proof of the deposit\n- Move-out photos and keys handover message\n\nWhich state is the flat in, and when did you vacate?\n[[FOLLOWUPS: Draft a legal notice | Can I deduct deposit from last rent? | Do I need a lawyer?]]';
  }
  for (const piece of text.match(/.{1,6}/gs)) {
    await new Promise((r) => setTimeout(r, 12));
    yield piece;
  }
}
