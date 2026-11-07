// Voice in (Web Speech API, with Groq-Whisper fallback) and voice out (speechSynthesis).
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export class VoiceInput {
  constructor({ onText, onState, onError }) {
    Object.assign(this, { onText, onState, onError });
    this.active = false;
  }

  get native() { return Boolean(SR); }
  get available() { return Boolean(SR || (navigator.mediaDevices && window.MediaRecorder)); }

  start(lang, { autoStop = false } = {}) {
    if (this.active) return;
    this.lang = lang;
    return SR ? this.#startNative(lang, autoStop) : this.#startRecorder(lang, autoStop);
  }

  stop() {
    if (!this.active) return;
    if (this.rec) this.rec.stop();
    if (this.media && this.media.state !== 'inactive') this.media.stop();
  }

  #startNative(lang, autoStop) {
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = '';
    let silence;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      this.onText((finalText + interim).trim(), false);
      if (autoStop) { clearTimeout(silence); silence = setTimeout(() => rec.stop(), 1800); }
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') this.onError(e.error); };
    rec.onend = () => {
      clearTimeout(silence);
      this.active = false; this.rec = null;
      this.onState('idle');
      this.onText(finalText.trim(), true);
    };
    this.rec = rec;
    this.active = true;
    this.onState('listening');
    rec.start();
  }

  async #startRecorder(lang, autoStop) {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { this.onError('not-allowed'); return; }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const parts = [];
    media.ondataavailable = (e) => e.data.size && parts.push(e.data);
    media.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      this.active = false; this.media = null;
      this.onState('transcribing');
      try {
        const blob = new Blob(parts, { type: media.mimeType || 'audio/webm' });
        const r = await fetch(`/api/transcribe?lang=${lang === 'hi' ? 'hi' : lang === 'en' ? 'en' : ''}`, {
          method: 'POST', headers: { 'Content-Type': blob.type }, body: blob,
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        this.onText((j.text || '').trim(), true);
      } catch (e) { this.onError(e.message || 'transcribe'); this.onText('', true); }
      this.onState('idle');
    };
    this.media = media;
    this.active = true;
    this.onState('listening');
    media.start();
    const limit = setTimeout(() => this.stop(), 60000); // hard cap 60 s
    media.addEventListener('stop', () => clearTimeout(limit));
    if (autoStop) this.#vad(stream, () => this.stop());
  }

  // crude voice-activity detection for hands-free mode in the recorder path
  #vad(stream, done) {
    try {
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(an);
      const data = new Uint8Array(an.fftSize);
      let heard = false, quietSince = Date.now();
      const tick = () => {
        if (!this.active) { ctx.close(); return; }
        an.getByteTimeDomainData(data);
        const level = Math.max(...data.map((v) => Math.abs(v - 128)));
        if (level > 12) { heard = true; quietSince = Date.now(); }
        if (heard && Date.now() - quietSince > 1800) { ctx.close(); done(); return; }
        requestAnimationFrame(tick);
      };
      tick();
    } catch { /* ignore */ }
  }
}

// ---------------- Text to speech ----------------
let voices = [];
const loadVoices = () => { voices = window.speechSynthesis?.getVoices() || []; };
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

function pickVoice(lang) {
  const want = lang === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-GB', 'en-US', 'en'];
  for (const w of want) {
    const v = voices.find((x) => x.lang?.replace('_', '-').startsWith(w) && /google|natural|neural/i.test(x.name)) ||
      voices.find((x) => x.lang?.replace('_', '-').startsWith(w));
    if (v) return v;
  }
  return null;
}

export const tts = {
  get supported() { return Boolean(window.speechSynthesis); },
  speaking: false,
  speak(text, lang, onEnd) {
    if (!window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const isHi = lang === 'hi' || /[ऀ-ॿ]/.test(text);
    const voice = pickVoice(isHi ? 'hi' : 'en');
    // Chrome stops long utterances, so speak sentence-sized chunks
    const chunks = text.match(/[^.!?।\n]{1,220}[.!?।]?/g) || [text];
    this.speaking = true;
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c.trim());
      if (voice) u.voice = voice;
      u.lang = voice?.lang || (isHi ? 'hi-IN' : 'en-IN');
      u.rate = isHi ? 0.95 : 1;
      if (i === chunks.length - 1) u.onend = () => { this.speaking = false; onEnd?.(); };
      u.onerror = () => { if (i === chunks.length - 1) { this.speaking = false; onEnd?.(); } };
      speechSynthesis.speak(u);
    });
  },
  stop() { window.speechSynthesis?.cancel(); this.speaking = false; },
};
