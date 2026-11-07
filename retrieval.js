// Hybrid retrieval over the Legal Aid Handbook.
// Dense: BAAI/bge-m3 query embedding (HF Inference API) vs. the int8 vectors exported
//        from the notebook's FAISS index.  Sparse: in-memory BM25.  Fused with RRF.
// Everything is loaded once per warm function instance (~5 ms).
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
let STORE = null;

const STOP = new Set(('a an the of to in on for and or is are was were be been it this that with as by at from my me i ' +
  'you your he she they them his her our we what how can do does did not no yes if then so but about any all ' +
  'have has had will would should could may might there their which who whom when where why also into than ' +
  'under such other these those its per etc shall upon being am').split(' '));

function tokenize(text) {
  return (text.toLowerCase().normalize('NFKC').match(/[a-z0-9ऀ-ॿ]+/g) || [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ies|es|s|ing|ed)$/, '') : w));
}

function load() {
  if (STORE) return STORE;
  const chunks = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'chunks.json'), 'utf8'));
  const buf = fs.readFileSync(path.join(DATA_DIR, 'vectors.bin'));
  const n = buf.readInt32LE(0);
  const dim = buf.readInt32LE(4);
  const scales = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + 8 + 4 * n));
  const q = new Int8Array(buf.buffer, buf.byteOffset + 8 + 4 * n, n * dim);

  // BM25 index
  const df = new Map();
  const docs = chunks.map((c) => {
    const toks = tokenize(`${c.c} ${c.t}`);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { tf, len: toks.length };
  });
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  STORE = { chunks, n, dim, scales, q, df, docs, avgLen };
  return STORE;
}

function bm25(query, s) {
  const k1 = 1.4, b = 0.75;
  const terms = [...new Set(tokenize(query))];
  const scores = new Float32Array(s.n);
  for (const t of terms) {
    const df = s.df.get(t);
    if (!df) continue;
    const idf = Math.log(1 + (s.n - df + 0.5) / (df + 0.5));
    for (let i = 0; i < s.n; i++) {
      const f = s.docs[i].tf.get(t);
      if (!f) continue;
      scores[i] += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * s.docs[i].len) / s.avgLen)));
    }
  }
  return scores;
}

function dense(vec, s) {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  const scores = new Float32Array(s.n);
  for (let i = 0; i < s.n; i++) {
    let dot = 0;
    const base = i * s.dim;
    for (let j = 0; j < s.dim; j++) dot += vec[j] * s.q[base + j];
    scores[i] = (dot * s.scales[i]) / norm;
  }
  return scores;
}

/** Embed a query with bge-m3 via the free HF Inference API. Returns null on any failure. */
export async function embedQuery(text, timeoutMs = 2500) {
  const token = process.env.HF_TOKEN;
  if (!token || !text) return null;
  const url = process.env.HF_EMBED_URL ||
    'https://router.huggingface.co/hf-inference/models/BAAI/bge-m3/pipeline/feature-extraction';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 1500) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    let v = await r.json();
    while (Array.isArray(v) && Array.isArray(v[0])) v = v[0]; // unwrap [[...]]
    return Array.isArray(v) && v.length === load().dim ? v : null;
  } catch {
    return null;
  }
}

/**
 * Self-RAG style retrieval: retrieve, grade, and keep only passages that clear a relevance bar.
 * Returns { passages, top, dense, mode } — `top` lets the caller decide whether to go to the web.
 */
export function searchHandbook({ queryEn, rawQuery, vector, k = 3 }) {
  const s = load();
  const sparse = bm25(`${queryEn} ${queryEn} ${rawQuery || ''}`, s);
  const dn = vector ? dense(vector, s) : null;

  const rank = (arr) => {
    const idx = [...arr.keys()].filter((i) => s.chunks[i].c !== 'Front matter' && arr[i] > 0);
    idx.sort((a, b) => arr[b] - arr[a]);
    const r = new Map();
    idx.slice(0, 40).forEach((i, pos) => r.set(i, pos));
    return r;
  };
  const rs = rank(sparse);
  const rd = dn ? rank(dn) : new Map();
  const fused = new Map();
  for (const [i, pos] of rs) fused.set(i, (fused.get(i) || 0) + 1 / (60 + pos));
  for (const [i, pos] of rd) fused.set(i, (fused.get(i) || 0) + 1.2 / (60 + pos));

  // term coverage = share of the English query's keywords present in the chunk
  const qTerms = [...new Set(tokenize(queryEn))];
  const coverage = (i) => (qTerms.length ? qTerms.filter((t) => s.docs[i].tf.has(t)).length / qTerms.length : 0);
  const graded = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => ({ i, d: dn ? dn[i] : null, sp: coverage(i) }))
    // relevance grade (the "Self-RAG" filter): dense cosine if available, else keyword coverage
    .filter((x) => (x.d !== null ? x.d >= Number(process.env.DENSE_MIN || 0.42) : x.sp >= 0.4));

  const picked = [];
  for (const g of graded) {
    // avoid near-duplicate neighbours from the same page
    if (picked.some((p) => p.p === s.chunks[g.i].p)) continue;
    picked.push({ i: g.i, p: s.chunks[g.i].p, score: g.d ?? g.sp });
    if (picked.length >= k) break;
  }
  const passages = picked.map((x, n) => {
    const c = s.chunks[x.i];
    return {
      id: `H${n + 1}`, kind: 'handbook', page: c.p, printedPage: c.pl, chapter: c.c,
      score: Number(x.score.toFixed(3)), text: c.t.slice(0, 900),
    };
  });
  const top = picked.length ? Math.max(...picked.map((x) => x.score)) : 0;
  // normalised "how well does the handbook cover this" score used for the web decision
  return { passages, top, dense: Boolean(dn), mode: dn ? 'hybrid' : 'bm25' };
}

export const HANDBOOK_CHAPTERS =
  'consumer protection, copyright, cyber bullying, dowry harassment, farmers rights, fishermen, fundamental duties, ' +
  'MGNREGA, maternity benefit, MTP, motor accidents, NDPS, NGT, biodiversity, plastic waste, power of attorney, animal cruelty, ' +
  'POCSO, right to education, RTI, legal aid, disability rights, workers rights, senior citizens, street vendors, ' +
  'succession certificate, surrogacy, traffic rules, urban local bodies, victim compensation, women safety';
