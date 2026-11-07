// Local dev server that mimics Vercel: serves /public and routes /api/* to the same
// Web-standard handlers that run in production. No dependencies.
//   node dev-server.mjs            (reads .env)
//   MOCK_LLM=1 node dev-server.mjs (no API keys needed — canned responses)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.resolve('public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z_-]/gi, '');
    const file = path.resolve('api', `${name}.js`);
    if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
    const mod = await import(`${file}?t=${fs.statSync(file).mtimeMs}`);
    const handler = mod[req.method];
    if (!handler) { res.writeHead(405).end(); return; }
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ac.abort(); });
    const request = new Request(url, {
      method: req.method, headers: req.headers, signal: ac.signal,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req), duplex: 'half',
    });
    try {
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      res.end();
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end(String(e));
    }
    return;
  }
  let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
  if (!p.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) p = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`Nyay Sahayak dev server → http://localhost:${PORT}${process.env.MOCK_LLM ? '  (MOCK_LLM)' : ''}`));
