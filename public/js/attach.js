// Read a notice the user attaches — entirely in the browser (no tokens, no upload):
//  PDF  → pdf.js text layer; scanned PDFs fall back to OCR of the first pages
//  Image→ Tesseract.js OCR (English + Hindi)
//  Text → as is
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_CHARS = 8000;

let tesseractLoading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tesseractLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = TESSERACT;
    s.onload = () => res(window.Tesseract);
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

async function ocr(image, onStatus) {
  const T = await loadTesseract();
  const { data } = await T.recognize(image, 'eng+hin', {
    logger: (m) => m.status === 'recognizing text' && onStatus?.('ocr', Math.round(m.progress * 100)),
  });
  return data.text || '';
}

export async function extractText(file, onStatus) {
  const name = file.name || 'document';
  if (file.size > 15 * 1024 * 1024) throw new Error('File too large (max 15 MB)');
  let text = '';
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(name)) {
    onStatus?.('read');
    const pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    for (let i = 1; i <= Math.min(doc.numPages, 15) && text.length < MAX_CHARS; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n\n';
    }
    if (text.replace(/\s/g, '').length < 80) { // scanned PDF → OCR
      text = '';
      for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        text += (await ocr(canvas, onStatus)) + '\n\n';
      }
    }
  } else if (/^image\//.test(file.type)) {
    onStatus?.('ocr', 0);
    text = await ocr(file, onStatus);
  } else {
    onStatus?.('read');
    text = await file.text();
  }
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('No text found');
  return { name, text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS };
}
