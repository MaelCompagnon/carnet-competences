// Makes the share images (Open Graph, 1200 × 630) into public/og-fr.png and public/og-en.png,
// from the /og/ pages. Run it again when the name, the kicker or the tagline of the home page change.
import path from 'node:path';
import { withBuiltSite } from './lib/built-site.mjs';

const jobs = [
  ['/og/', 'og-fr.png'],
  ['/en/og/', 'og-en.png'],
];

await withBuiltSite(async ({ root, base, browser }) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [url, name] of jobs) {
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, 'public', name), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`public/${name}`);
  }
});
