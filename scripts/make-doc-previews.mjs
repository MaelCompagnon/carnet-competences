// Renders the page images of the documents shown in the site (except the CVs, which
// "npm run cv:pdf" renders itself, from the PDFs without the phone number).
// Run it again when a document in public/documents/ changes or is added to src/data/documents.ts.
import fs from 'node:fs';
import path from 'node:path';
import { rasterize, savePreviews, updateManifest } from './lib/pdf-raster.mjs';

const root = process.cwd();
// src/data/documents.ts is TypeScript: read its entries with a light parse instead of a compiler.
const src = fs.readFileSync(path.join(root, 'src/data/documents.ts'), 'utf8');
const entries = [...src.matchAll(/\{ id: '([^']+)', file: '([^']+)', group: '(\w+)', preview: '(\w+)'/g)]
  .map(([, id, file, group, preview]) => ({ id, file, group, preview }))
  .filter((d) => d.group !== 'cv');
if (entries.length === 0) throw new Error('No document found in src/data/documents.ts');

const { chromium } = await import('playwright-core');
let browser;
for (const channel of [process.env.PW_CHANNEL, 'chrome', 'msedge', undefined]) {
  try {
    browser = await chromium.launch(channel ? { channel } : {});
    break;
  } catch {
    /* next browser */
  }
}
if (!browser) throw new Error('No Chrome, Edge or Playwright Chromium found.');

try {
  const manifest = {};
  for (const d of entries) {
    const bytes = fs.readFileSync(path.join(root, 'public', d.file));
    const result = await rasterize(browser, { bytes, maxPages: d.preview === 'first' ? 1 : Infinity });
    manifest[d.file] = savePreviews(root, d.id, result);
    console.log(`${d.file}: ${result.images.length} of ${result.pages} page(s)`);
  }
  updateManifest(root, manifest);
} finally {
  await browser.close();
}
