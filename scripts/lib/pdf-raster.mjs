// Renders PDF pages to WebP images with pdf.js, inside a Playwright page (pdfjs-dist is a
// development dependency). Used for the previews shown in the site: a phone without a PDF
// reader must still see the documents (PROMPT §5).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const PDFJS = path.resolve('node_modules', 'pdfjs-dist');

/**
 * @param {import('playwright-core').Browser} browser
 * @param {{ bytes: Buffer, maxPages?: number, widths?: number[] }} job
 * @returns {Promise<{ pages: number, images: { page: number, width: number, height: number, webp: Record<number, Buffer> }[] }>}
 */
export async function rasterize(browser, { bytes, maxPages = Infinity, widths = [1200, 480] }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>raster</title>');
    if (url === '/doc.pdf') return res.writeHead(200, { 'content-type': 'application/pdf' }).end(bytes);
    const file = path.join(PDFJS, url);
    if (!file.startsWith(PDFJS) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': file.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const out = await page.evaluate(
      async ({ maxPages, widths }) => {
        const pdfjs = await import('/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '/build/pdf.worker.mjs';
        const doc = await pdfjs.getDocument({ url: '/doc.pdf', standardFontDataUrl: '/standard_fonts/', cMapUrl: '/cmaps/', cMapPacked: true }).promise;
        const images = [];
        let masked = 0;
        for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
          const p = await doc.getPage(i);
          const base = p.getViewport({ scale: 1 });
          const webp = {};
          let size = { width: 0, height: 0 };
          for (const w of widths) {
            const vp = p.getViewport({ scale: w / base.width });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(vp.width);
            canvas.height = Math.round(vp.height);
            const ctx = canvas.getContext('2d');
            // White paper behind transparent PDFs.
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await p.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
            // A phone number never shows in a preview (SPEC §5): only the downloaded PDF has it.
            // Any text run holding a phone number (+33 7 .. or 07 ..) is painted over with the colour beside it.
            const text = await p.getTextContent();
            for (const item of text.items) {
              if (!/(?:\+\d{2,3}\s?\d|\b0\d)(?:[\s.]?\d{2}){4}\b/.test(item.str)) continue;
              const [, , c, d, e, f] = pdfjs.Util.transform(vp.transform, item.transform);
              const hgt = Math.hypot(c, d);
              const x = e - 2;
              const y = f - hgt * 1.05;
              const wid = item.width * vp.scale + 4;
              const px = ctx.getImageData(Math.max(0, Math.round(x - 4)), Math.round(f - hgt / 2), 1, 1).data;
              ctx.fillStyle = `rgb(${px[0]} ${px[1]} ${px[2]})`;
              ctx.fillRect(x, y, wid, hgt * 1.35);
              masked++;
            }
            webp[w] = canvas.toDataURL('image/webp', 0.86).split(',')[1];
            if (w === widths[0]) size = { width: canvas.width, height: canvas.height };
          }
          images.push({ page: i, ...size, webp });
        }
        return { pages: doc.numPages, images, masked };
      },
      { maxPages, widths },
    );
    for (const img of out.images) for (const w of Object.keys(img.webp)) img.webp[w] = Buffer.from(img.webp[w], 'base64');
    return out;
  } finally {
    await page.close();
    server.close();
  }
}

/** Writes the images of one document into public/previews/ and returns its manifest entry. */
export function savePreviews(root, slug, result, widths = [1200, 480]) {
  const dir = path.join(root, 'public', 'previews');
  fs.mkdirSync(dir, { recursive: true });
  // Old images of this document (it may have had more pages) are removed first.
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${slug}-p`)) fs.rmSync(path.join(dir, f));
  return {
    pages: result.pages,
    images: result.images.map((img) => {
      const names = {};
      for (const w of widths) {
        const name = `${slug}-p${img.page}-${w}.webp`;
        fs.writeFileSync(path.join(dir, name), img.webp[w]);
        names[w] = `/previews/${name}`;
      }
      return { page: img.page, width: img.width, height: img.height, src: names[widths[0]], thumb: names[widths[1]] };
    }),
  };
}

export const MANIFEST = 'src/data/previews.json';

/** Merges entries into the preview manifest (keyed by the PDF path under public/). */
export function updateManifest(root, entries) {
  const file = path.join(root, MANIFEST);
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const next = { ...current, ...entries };
  const sorted = Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]]));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}
