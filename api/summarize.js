// POST /api/summarize — Memory agent. Folds messages that slid out of the 10-message
// window into a <=120-word running summary. Called by the browser in the background
// after an answer finishes, so it never adds latency to a reply.
import { chatText } from '../lib/groq.js';
import { summaryMessages } from '../lib/prompts.js';

export async function POST(request) {
  try {
    const { summary = '', messages = [] } = await request.json();
    const msgs = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(0, 12);
    if (!msgs.length) return Response.json({ summary });
    const { text, usage } = await chatText(summaryMessages({ summary: String(summary).slice(0, 1500), messages: msgs }));
    return Response.json({ summary: text || summary, tokens: usage?.total_tokens || 0 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status === 429 ? 429 : 500 });
  }
}
