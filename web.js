// Web Research Agent: one targeted Tavily search (basic depth, snippets only) to keep
// latency ~1-2 s and prompt tokens small. Results are ranked by an authority signal.
export function authority(url = '') {
  const u = url.toLowerCase();
  if (/indiacode\.nic\.in|egazette\.(nic|gov)\.in/.test(u)) return { rank: 0, label: 'Official law text (India Code / Gazette)' };
  if (/sci\.gov\.in|ecourts\.gov\.in|highcourt|hc\.nic\.in|nclt|ncdrc|e-?daakhil/.test(u)) return { rank: 1, label: 'Court / tribunal site' };
  if (/\.gov\.in|\.nic\.in|nalsa|legalservices/.test(u)) return { rank: 2, label: 'Government guidance' };
  if (/livelaw|barandbench|scconline|indiankanoon/.test(u)) return { rank: 3, label: 'Legal news / database' };
  return { rank: 4, label: 'Secondary source — verify' };
}

export async function webSearch(query, { max = 4, timeoutMs = 6000 } = {}) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query) return [];
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: `${query} India`.slice(0, 380),
        search_depth: 'basic',
        max_results: 6,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const seen = new Set();
    return (j.results || [])
      .filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
      .map((x) => ({ ...x, auth: authority(x.url) }))
      .sort((a, b) => a.auth.rank - b.auth.rank || (b.score || 0) - (a.score || 0))
      .slice(0, max)
      .map((x, i) => ({
        id: `W${i + 1}`, kind: 'web', title: (x.title || 'Untitled').slice(0, 140), url: x.url,
        authority: x.auth.label, text: String(x.content || '').replace(/\s+/g, ' ').slice(0, 700),
      }));
  } catch {
    return [];
  }
}
