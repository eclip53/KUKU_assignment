// POST /api/transcribe?lang=hi|en — voice fallback for browsers without the Web Speech API
// (Firefox, some Safari builds). Body: raw audio (webm/ogg/mp4). Uses Groq Whisper.
import { transcribe } from '../lib/groq.js';

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const type = request.headers.get('content-type') || 'audio/webm';
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return Response.json({ error: 'No audio' }, { status: 400 });
    if (buf.byteLength > 4_000_000) return Response.json({ error: 'Recording too long' }, { status: 413 });
    const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'mp4' : type.includes('wav') ? 'wav' : 'webm';
    const text = await transcribe(new Blob([buf], { type }), `voice.${ext}`, url.searchParams.get('lang'));
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
