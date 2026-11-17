// Shared by the scripts that print pages of the site (CV PDFs, share images):
// builds the site into a temporary folder, serves it locally and opens a browser on it.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};

export async function withBuiltSite(run) {
  const root = process.cwd();
  // A separate folder, so that the published site (dist/) is never built from here.
  const outDir = path.join(root, '.shots-build');

  // Markers are allowed: drafts must be printable. The production build has its own guard.
  process.env.ALLOW_MARKERS = '1';
  const { build } = await import('astro');
  await build({ outDir, logLevel: 'warn' });

  const server = http.createServer((req, res) => {
    let file = path.join(outDir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(outDir)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;

  // playwright-core ships no browser: use the Chrome or Edge already installed.
  const { chromium } = await import('playwright-core');
  let browser;
  for (const channel of [process.env.PW_CHANNEL, 'chrome', 'msedge', undefined]) {
    if (channel === undefined && process.env.PW_CHANNEL === undefined && browser) break;
    try {
      browser = await chromium.launch(channel ? { channel } : {});
      break;
    } catch {
      /* try the next browser */
    }
  }

  try {
    if (!browser) throw new Error('No Chrome, Edge or Playwright Chromium found.');
    await run({ root, base, browser });
  } finally {
    await browser?.close();
    server.close();
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}
