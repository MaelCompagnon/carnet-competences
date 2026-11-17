// Prints the four CV PDFs (designed and ATS, French and English) into public/cv/, and the page
// images shown in the site (public/previews/).
// The phone number comes from .env (CV_PHONE) and is injected in the browser just before the
// final print: it never reaches the HTML pages, the repository sources, nor the previews, which
// are rendered from a first print made before the injection.
import fs from 'node:fs';
import path from 'node:path';
import { withBuiltSite } from './lib/built-site.mjs';
import { rasterize, savePreviews, updateManifest } from './lib/pdf-raster.mjs';
import { CV_LOCK, cvFingerprint, findMarkers } from './markers.mjs';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const phone = (process.env.CV_PHONE ?? '').trim();
if (!phone) {
  console.error('CV_PHONE is empty. Copy .env.example to .env and set the phone number for the PDFs.');
  process.exit(1);
}

const markers = findMarkers();
if (markers.length > 0) console.warn(`Draft PDFs: ${markers.length} marker(s) are still in content/ and will show in the CV.`);

const jobs = [
  ['/cv/print/', 'CV-Mael-Compagnon-FR.pdf', 'cv-fr'],
  ['/cv/ats/', 'CV-Mael-Compagnon-FR-ATS.pdf', 'cv-ats-fr'],
  ['/en/cv/print/', 'CV-Mael-Compagnon-EN.pdf', 'cv-en'],
  ['/en/cv/ats/', 'CV-Mael-Compagnon-EN-ATS.pdf', 'cv-ats-en'],
];
const pdfOptions = { format: 'A4', printBackground: true, preferCSSPageSize: true };
// The designed CVs are Maël's own files, made in Canva (French, then its English translation;
// decisions of 17 Nov 2026), kept as is in public/cv/: they are not printed here, only previewed,
// with the phone number masked (scripts/lib/pdf-raster.mjs).
const PROVIDED = new Set(['CV-Mael-Compagnon-FR.pdf', 'CV-Mael-Compagnon-EN.pdf']);

await withBuiltSite(async ({ root, base, browser }) => {
  const pdfDir = path.join(root, 'public', 'cv');
  fs.mkdirSync(pdfDir, { recursive: true });
  const page = await browser.newPage();
  const manifest = {};
  const previews = [];
  for (const [url, name, slug] of jobs) {
    if (PROVIDED.has(name)) {
      const own = await rasterize(browser, { bytes: fs.readFileSync(path.join(pdfDir, name)) });
      if (own.masked === 0) console.warn(`public/cv/${name}: no phone number found to mask in the preview: check it.`);
      const entry = savePreviews(root, slug, own);
      manifest[`/cv/${name}`] = entry;
      previews.push(...entry.images.flatMap((i) => [i.src, i.thumb]));
      console.log(`public/cv/${name} (provided file, ${entry.images.length} page(s) previewed, ${own.masked} run(s) masked)`);
      continue;
    }
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    // 1. Without the phone: the images shown in the site.
    const draft = await page.pdf(pdfOptions);
    const entry = savePreviews(root, slug, await rasterize(browser, { bytes: draft }));
    manifest[`/cv/${name}`] = entry;
    previews.push(...entry.images.flatMap((i) => [i.src, i.thumb]));

    // 2. With the phone: the PDF people download.
    const filled = await page.evaluate((value) => {
      const slots = document.querySelectorAll('[data-cv-phone]');
      slots.forEach((el) => {
        el.textContent = value;
        el.hidden = false;
      });
      return slots.length;
    }, phone);
    if (filled === 0) throw new Error(`No phone slot found on ${url}`);
    await page.pdf({ path: path.join(pdfDir, name), ...pdfOptions });
    console.log(`public/cv/${name} (${entry.images.length} page(s) previewed)`);
  }
  updateManifest(root, manifest);
  // Records which version of the CV text the PDFs and their previews were printed from
  // (checked by the production build).
  fs.writeFileSync(
    path.join(root, CV_LOCK),
    JSON.stringify({ source: cvFingerprint(root), markers: markers.length, previews: previews.sort() }, null, 2) + '\n',
  );
});
