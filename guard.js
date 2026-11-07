// Citation Guard — a zero-token, deterministic hallucination check run after every answer.
// It extracts legal references (sections, articles, Acts, case names, source tags) from the
// answer and checks each one against the evidence that was actually retrieved.
const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[‘’']/g, "'").replace(/\s+/g, ' ');

// Acts the app itself tells the model about (see LAW_UPDATES in prompts.js) — not hallucinations.
const SYSTEM_KNOWN = [
  'bharatiya nyaya sanhita', 'bharatiya nagarik suraksha sanhita', 'bharatiya sakshya adhiniyam',
  'consumer protection act', 'legal services authorities act', 'code on wages', 'industrial relations code',
  'code on social security', 'occupational safety, health and working conditions code', 'labour code',
];

export function citationGuard(answer, evidence) {
  const ev = norm(evidence.map((e) => `${e.title || ''} ${e.chapter || ''} ${e.text}`).join(' \n '));
  const tags = new Set(evidence.filter((e) => e.kind !== 'user').map((e) => e.id));
  const out = [];
  const seen = new Set();
  const add = (text, ok, kind) => {
    const key = norm(text);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text: text.trim(), kind, status: ok ? 'verified' : 'unverified' });
  };

  // [H1] / [W3] tags that don't exist
  for (const m of answer.matchAll(/\[([HW]\d{1,2})\]/g)) if (!tags.has(m[1])) add(m[0], false, 'tag');

  // Sections / articles / rules  (English + Hindi)
  const secRe = /\b(Sections?|Sec\.|Article|Art\.|Rule|Order)\s+(\d{1,4}[A-Z]{0,2}(?:\s?\(\d+\))?)|(धारा|अनुच्छेद|नियम)\s+(\d{1,4}[A-Z]?)/gi;
  for (const m of answer.matchAll(secRe)) {
    const num = (m[2] || m[4]).replace(/\s/g, '');
    const word = (m[1] || m[3]).toLowerCase();
    const isArt = /art|अनुच्छेद/.test(word);
    const base = num.replace(/\(.*/, '').toLowerCase();
    const pat = isArt
      ? new RegExp(`(article|art\\.?)\\s*${base}\\b`)
      : new RegExp(`(section|sec\\.?|s\\.|u/s|rule|order|धारा|नियम)\\s*${base}\\b`);
    add(m[0], pat.test(ev), 'provision');
  }

  // Act / Code names
  const actRe = /\b((?:The\s)?[A-Z][A-Za-z.'&()-]*(?:\s(?:of|and|for|on|to|the|[A-Z][A-Za-z.'&()-]*)){0,8}\s(?:Act|Code|Sanhita|Adhiniyam|Rules))\b(?:,?\s*(\d{4}))?/g;
  for (const m of answer.matchAll(actRe)) {
    const name = norm(m[1]).replace(/^the /, '');
    if (name.split(' ').length < 2) continue;
    const known = SYSTEM_KNOWN.some((k) => name.includes(k));
    const inEv = ev.includes(name) && (!m[2] || ev.includes(m[2]));
    add(m[0], known || inEv, 'act');
  }

  // Case names "X v. Y" / "X vs Y"
  const caseRe = /\b([A-Z][A-Za-z&]+(?:\s[A-Z][A-Za-z&]+){0,4})\s+(?:v\.|vs\.?|versus)\s+([A-Z][A-Za-z&]+(?:\s(?:of\s)?[A-Z][A-Za-z&]+){0,4})/g;
  for (const m of answer.matchAll(caseRe)) {
    const left = m[1].replace(/^(See|In|As|Under|Per|Refer|Also|Case|The)\s+/, '');
    const a = norm(left).split(' ').pop();
    const b = norm(m[2]).split(' ')[0];
    add(`${left} v. ${m[2]}`, ev.includes(a) && ev.includes(b), 'case');
  }
  return out;
}
