// GET /api/health — tells the UI which optional features are configured.
import { MODELS } from '../lib/groq.js';

export function GET() {
  return Response.json({
    ok: true,
    llm: Boolean(process.env.GROQ_API_KEY || process.env.MOCK_LLM),
    denseRetrieval: Boolean(process.env.HF_TOKEN),
    webSearch: Boolean(process.env.TAVILY_API_KEY),
    models: { router: MODELS.router, answer: MODELS.answer },
  });
}
