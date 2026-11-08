# ⚖️ Nyay Sahayak (न्याय सहायक): an AI lawyer for everyday problems in India

Nyay Sahayak helps an ordinary person deal with an everyday legal problem, such as a deposit that was never returned, a refund that never came, unpaid salary, or a notice they can't understand. You can **type or speak in Hindi, English or Hinglish**. It turns your messy story into a **case file**, explains **where you stand** in plain words, **drafts** the notice or complaint you need, and lets you **practise the conversation** with the other side. It **tells you when you need a real lawyer**, and it is built so it **cannot quietly invent laws**.

Stack: plain HTML/CSS/JS frontend and Node.js serverless functions on Vercel. There are **zero npm dependencies** and **no build step**.

---

## ✨ Features

| | Feature | Why it matters |
|---|---|---|
| 🎙️ | **Voice in, in Hindi & English.** Uses the browser's Web Speech API (`hi-IN` / `en-IN`), with a Groq Whisper fallback for Firefox/Safari | People who don't type comfortably can still use it |
| 🔊 | **Voice out.** Every answer can be read aloud, and a **hands-free mode** listens again after each answer | Works like a phone call |
| 🌐 | **Auto language detection.** Hindi (Devanagari), English or Hinglish (Roman Hindi). It replies in the same script, and the UI switches between EN/हिं | No language barrier |
| 📁 | **Live case file.** Parties, facts, timeline, proof you have, a checklist of proof to collect, the amount and your goal. It builds up as you talk, and you can edit or print it | "Build the case" |
| ⚖️ | **"Do you need a lawyer?" meter** (no / advisable / necessary), with the reason, plus free legal aid (NALSA 15100 / DLSA) | Honest escalation |
| 🚨 | **Urgency detection.** Emergencies (violence, danger) and time-sensitive matters show one-tap helplines (112, 181, 1930, 15100, 14416) | Safety comes first |
| 📝 | **Draft mode.** Legal notice, consumer complaint, police complaint, reply to a notice, RTI, Labour Commissioner complaint, legal-aid application. Unknown details stay as highlighted `[placeholders]`. You can edit in place, copy, download a `.doc`, or print/PDF | "Prepare what they need" |
| 🎭 | **Practice mode.** The AI plays your landlord, HR, customer care, the police SHO, or the opposing lawyer. You get a 💡 coach tip every turn, then feedback with a score out of 10 | "Help them argue" |
| 📄 | **Explain-a-notice mode.** Attach a **photo or PDF** of the notice. It's read **in the browser** (pdf.js + Tesseract OCR, English and Hindi), so it costs **0 tokens** and nothing is uploaded | "A notice they don't understand" |
| 🛡️ | **Citation Guard.** Every Act, section, article and case name in an answer is checked against the retrieved sources. Anything unsupported is underlined ⚠ "verify" | Shows hallucinations instead of hiding them |
| 📚 | **Clickable source tags** `[H1]` / `[W2]`. They open the exact handbook page or web source, with an authority label | You can check every claim |
| 💬 | **Streaming answers** with a visible pipeline (*Understanding → Searching handbook → Checking web → Writing*) | Feels fast and shows its work |
| 🗂️ | **Chat history.** Every case is saved on the device. You can search, rename, delete, and continue any old chat. Chats can be exported or imported as JSON | Privacy: legal data never sits on our server |
| 🧠 | **Short-term memory.** The **10 most recent messages** go with each request, plus a **running summary** of everything older (built in the background, so no added latency). A "Memory" chip shows exactly what the AI remembers | Long chats stay coherent and cheap |
| 🌗 | Dark mode, mobile-first responsive layout, installable (PWA manifest), keyboard shortcuts (Enter, Shift+Enter, Esc, Ctrl/⌘+K) | Polish |

---

## 🏗️ Architecture

The four-agent Self-RAG design from the notebook is kept. It was re-engineered for serverless, low latency and the free API tier.


flowchart LR
    U(["User: text / voice / photo"]) -->|"Web Speech or Whisper; PDF.js / Tesseract OCR"| FE["Browser app<br/>Chat history + memory + case file in localStorage"]

    FE -->|"POST /api/chat: last 10 messages + summary + case file"| A1

    subgraph V["Vercel Function - streamed NDJSON"]
        A1["Agent 1: Intake and Router<br/>gpt-oss-20b - JSON<br/>Language, domain, state, urgency<br/>Lawyer need, case-file additions<br/>English search query, web flag"]

        E["bge-m3 query embedding<br/>HF Inference API"]

        A1 -.->|"Parallel embedding"| E

        A1 --> A2["Agent 2: Self-RAG Retrieval<br/>Hybrid BM25 + dense retrieval<br/>Handbook search<br/>RRF fusion + relevance grading<br/>Drop weak passages"]

        E --> A2

        A2 -->|"Weak handbook / uncovered topic / state-specific"| A3["Agent 3: Web Research<br/>Tavily - authority-ranked sources<br/>India Code, courts, government sites, others"]

        A2 --> A4["Agent 4: Guidance / Draft / Practice / Explain<br/>gpt-oss-120b - streamed"]

        A3 --> A4

        A4 --> G["Citation Guard<br/>Deterministic - 0 tokens"]
    end

    G -->|"Tokens, sources, guard, stats"| FE

    FE -->|"After answer - background request"| S["/api/summarize<br/>Memory Agent - gpt-oss-20b"]

### What changed from the notebook, and why

| Notebook | Production app | Effect |
|---|---|---|
| 4 sequential LLM calls (intake → Self-RAG grade → search plan → answer) | **2 calls**: the router does intake, query rewriting and the web decision; Self-RAG grading is done **numerically** (cosine / keyword coverage thresholds) | Half the LLM round-trips before the answer starts streaming, and far fewer tokens per turn |
| `bge-m3` + FAISS + torch in-process (GBs, impossible on Vercel's 250 MB limit) | FAISS index **exported once** (`scripts/export_index.py`) to `data/chunks.json` + **int8-quantised** `vectors.bin` (490 KB, cosine error < 0.0003). The query is embedded via the free HF API, and search is pure JS (< 2 ms) | Tiny, fast-starting function; same embeddings as the notebook |
| Dense-only retrieval | **Hybrid**: BM25 + dense, fused with Reciprocal Rank Fusion. Falls back to BM25 if the embedding API is down | Robust, and Hindi questions still hit English passages (bge-m3 is multilingual) |
| 5 Tavily "advanced" searches with raw page content | 1 "basic" search, snippets only, re-ranked by an authority signal | Much smaller web context and a single short search instead of five deep ones |
| Long persona prompt sent every call | Compact prompts plus a **"known law changes" block** (BNS/BNSS/BSA replaced IPC/CrPC/Evidence Act from 1 Jul 2024; the four Labour Codes are in force from 21 Nov 2025) | Fewer tokens; fixes the 2022 handbook's outdated references |
| `max_tokens=1800` on a reasoning model | `reasoning_effort: low`, mode-specific budgets, and a 120b → 20b **fallback on 429** | Fewer hidden reasoning tokens; survives free-tier rate limits |
| Answer-only | Stage events, sources, case-file updates, guard results and stats are **streamed** as NDJSON | Smooth UI that shows its work |

---

## 🛡️ How it avoids inventing laws, sections and cases

1. **Retrieval-first, with a relevance gate.** The model only sees handbook passages that pass a relevance threshold (bge-m3 cosine ≥ 0.42, or ≥ 40 % keyword coverage). Irrelevant "nearest neighbours" are dropped instead of being passed off as evidence.
2. **Self-RAG routing to the web.** If the handbook is weak or doesn't cover the topic (for example, tenancy is not in the handbook) or the question is state-specific, the web agent fetches sources. Each source carries an authority label (*Official law text*, *Court site*, *Govt guidance*, *Secondary – verify*).
3. **Strict grounding prompt.** Every legal specific must carry a source tag `[H#]` / `[W#]`. Anything without support must be described generally and marked "(verify)". The model is told never to invent Act names, sections, cases, deadlines, fees or authorities.
4. **Known law-change registry.** A short, curated block stops the model (and the 2022 handbook) from presenting IPC/CrPC sections as current law.
5. **Citation Guard (post-generation, deterministic).** It uses regex extraction of `Section/धारा/Article/Rule N`, Act/Code/Sanhita names, `X v. Y` case names, and `[H9]`-style tags. Each item is checked against the retrieved evidence and the user's own document. Unsupported items are **underlined in the answer** and listed: "⚠ 2 not found in sources: verify before relying". This costs no tokens and the model can't skip it.
6. **Honesty about limits.** It asks for the state when the law depends on it, never computes legal deadlines from a notice (it quotes the dates written in it), and recommends a real advocate or free legal aid for arrest, criminal accusation, court summons, family or high-value matters.

---

## 💸 Token & latency budget (free tier)

| Step | Model | Typical tokens* | Notes |
|---|---|---|---|
| Intake / router | `openai/gpt-oss-20b` | ~900 in / ~250 out | Runs in parallel with the embedding call |
| Answer | `openai/gpt-oss-120b` | ~2–3.5k in / ~400–900 out | Streamed; fallback is `gpt-oss-20b` |
| Memory summary | `openai/gpt-oss-20b` | ~600 in / ~150 out | Only after 10+ messages, in the background |
| Practice turn | `gpt-oss-120b` | ~1.2k in / ~120 out | Router and retrieval are skipped |
| Embedding / OCR / voice / guard | HF API / browser / browser / JS | 0 LLM tokens | |

\*These are design estimates. Every answer shows its **real** token count and timing under the message, and the test runner records them.

---

## 🚀 Deploy on Vercel (about 5 minutes)

1. Get free keys:
   - **GROQ_API_KEY** (required): https://console.groq.com/keys
   - **HF_TOKEN** (recommended, enables bge-m3 semantic search): https://huggingface.co/settings/tokens (a "read" token is enough)
   - **TAVILY_API_KEY** (recommended, enables web research): https://app.tavily.com
2. Push this folder to a GitHub repo, then **Vercel → Add New → Project → Import**. Choose Framework preset **Other**. No build command is needed: `vercel.json` sets `public/` as the output and bundles `data/` with the function.
3. Under **Settings → Environment Variables**, add the keys above (see `.env.example` for optional model overrides).
4. Click Deploy. Open the URL and check **⚙ Settings**, which shows which features are active.

Or use the CLI: `npm i -g vercel && vercel --prod`.

### Run locally
```bash
cp .env.example .env      # add your keys
node dev-server.mjs       # http://localhost:3000  (same handlers as production)
MOCK_LLM=1 node dev-server.mjs   # UI demo with canned answers, no keys needed
```

### Rebuild the retrieval data (only if you change the handbook)
Build the FAISS index in the notebook, then run:
```bash
python3 -I scripts/export_index.py path/to/index.faiss path/to/index.pkl data/
```
This needs only numpy. It never imports LangChain, and the pickle is read with a restricted unpickler.

---

## 🧪 Test cases & raw outputs

`tests/cases.json` holds 14 scenarios:

- English, Hindi and Hinglish questions
- Multi-turn case building that ends in a drafted notice
- Explaining a cheque-bounce notice
- A 4-turn practice session with feedback
- A domestic-violence emergency
- A hallucination bait ("give me the SC judgment for 18 % interest")
- An outdated-law trap (IPC 420)
- An off-topic request
- A handbook-only question
- Hindi cyber-bullying
- A 7-turn memory test
- A missing-state question

```bash
node tests/run_tests.mjs https://<your-app>.vercel.app        # all cases
node tests/run_tests.mjs http://localhost:3000 08_hallucination_bait   # one case
```

The runner reproduces the browser's memory logic and writes **raw outputs** to `tests/outputs/`. For each case you get a readable transcript `<case>.md` (pipeline stages, intake JSON, retrieved sources, raw answer, Citation Guard verdicts, tokens and latency) and the raw stream `<case>.ndjson`. `SUMMARY.md` collects totals across cases. Commit that folder to submit the outputs.

---

## 📁 Project structure

```
api/
  chat.js         4-agent pipeline, streamed as NDJSON
  summarize.js    memory agent (running summary)
  transcribe.js   Whisper fallback for voice input
  health.js       feature/config check
lib/
  groq.js         tiny Groq client (stream, JSON, fallback, Whisper, mock mode)
  retrieval.js    hybrid BM25 + bge-m3 search, Self-RAG relevance gate
  web.js          Tavily search + authority ranking
  prompts.js      all prompts (router, answer modes, memory)
  guard.js        Citation Guard
data/             handbook chunks + int8 bge-m3 vectors (exported from the notebook's FAISS index)
public/           index.html, styles.css, js/{app,md,voice,attach,i18n}.js
scripts/export_index.py
tests/            cases.json, run_tests.mjs
dev-server.mjs    zero-dependency local server that mimics Vercel
```

## ⚠️ Limitations (stated honestly)

- This is general legal information, not legal advice or representation. The app says so, and it escalates to advocates and free legal aid.
- The knowledge base is one secondary source (Legal Aid Handbook Vol. I, 2022) plus web snippets. Web results are labelled as leads, not verified law.
- The Citation Guard checks that a reference *appears in the sources*. It does not check that the source itself is correct or current.
- Browser speech recognition quality depends on the browser (Chrome/Edge are best). Hindi text-to-speech needs a Hindi voice installed (present on Android/Chrome).
- Chats live in the browser's localStorage. Clearing site data deletes them (use Export).
