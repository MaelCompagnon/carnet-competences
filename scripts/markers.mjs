import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Any bracket starting with "À " is a pending note for the author (SPEC §3 and §9):
// [À COMPLÉTER], [À VÉRIFIER], [À VALIDER PAR MAËL]. Kept in French in every language.
export const MARKER_RE = /\[À [^\]]*\]/g;

export function findMarkers(root = process.cwd()) {
  const dir = path.join(root, 'content');
  const found = [];
  for (const lang of fs.readdirSync(dir).sort()) {
    const langDir = path.join(dir, lang);
    if (!fs.statSync(langDir).isDirectory()) continue;
    for (const file of fs.readdirSync(langDir).filter((f) => f.endsWith('.md')).sort()) {
      const lines = fs.readFileSync(path.join(langDir, file), 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const m of line.matchAll(MARKER_RE)) {
          found.push({ file: `content/${lang}/${file}`, line: i + 1, text: m[0] });
        }
      });
    }
  }
  return found;
}

export function formatMarkers(markers) {
  return markers.map((m) => `  ${m.file}:${m.line}  ${m.text}`).join('\n');
}

// The CV PDFs in public/cv/ are printed from content/<lang>/09-cv.md by "npm run cv:pdf".
// This fingerprint lets the production build refuse PDFs (and their previews) older than their source.
export const CV_LOCK = 'scripts/cv-pdf.lock.json';

export function cvFingerprint(root = process.cwd()) {
  const hash = crypto.createHash('sha256');
  for (const lang of ['fr', 'en']) {
    // Line endings are normalised: Git may rewrite them on checkout.
    hash.update(fs.readFileSync(path.join(root, 'content', lang, '09-cv.md'), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex');
}

export function cvPdfsUpToDate(root = process.cwd()) {
  const lock = path.join(root, CV_LOCK);
  if (!fs.existsSync(lock)) return false;
  const data = JSON.parse(fs.readFileSync(lock, 'utf8'));
  if (data.source !== cvFingerprint(root)) return false;
  // The previews of the CVs are printed by the same command: missing ones mean an older run.
  if (!Array.isArray(data.previews) || data.previews.length === 0) return false;
  return data.previews.every((p) => fs.existsSync(path.join(root, 'public', p)));
}
