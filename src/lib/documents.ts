// The documents shown in the site, ready to render: title, file size, page images.
// The list is src/data/documents.ts; the page images come from src/data/previews.json,
// written by "npm run cv:pdf" (CVs) and "npm run docs:previews" (the others).
import fs from 'node:fs';
import path from 'node:path';
import { documents, type DocEntry } from '../data/documents';
import previews from '../data/previews.json';
import { plain } from './content';
import { profile } from '../data/profile';
import type { Lang } from '../i18n/routes';
import { ui } from '../i18n/ui';

export interface DocPage {
  page: number;
  width: number;
  height: number;
  src: string;
  thumb: string;
}

export interface DocView extends DocEntry {
  title: string;
  /** Who the document belongs to, for the viewer's image descriptions. */
  owner: string;
  size: string;
  pages: number;
  images: DocPage[];
}

function sizeOf(file: string, lang: Lang): string {
  const bytes = fs.statSync(path.resolve('public', file.replace(/^\//, ''))).size;
  const kb = bytes / 1024;
  const n = kb < 1024 ? Math.max(1, Math.round(kb)) : Math.round((kb / 1024) * 10) / 10;
  const unit = kb < 1024 ? (lang === 'fr' ? 'Ko' : 'KB') : lang === 'fr' ? 'Mo' : 'MB';
  return `${lang === 'fr' ? String(n).replace('.', ',') : n}${String.fromCharCode(0xa0)}${unit}`;
}

/** "[Title (PDF)](/documents/x.pdf)" anywhere in content/<lang>/, by file path. */
function linkTitles(lang: Lang): Map<string, string> {
  const dir = path.resolve('content', lang);
  const map = new Map<string, string>();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/\[([^\]]+)\]\((\/documents\/[^)\s]+\.pdf)\)/g)) {
      if (!map.has(m[2])) map.set(m[2], plain(m[1]).replace(/\s*\(PDF\)\s*$/, ''));
    }
  }
  return map;
}

export function docsOf(lang: Lang, group?: DocEntry['group']): DocView[] {
  const t = ui[lang];
  const titles = linkTitles(lang);
  const all = previews as Record<string, { pages: number; images: DocPage[] }>;
  return documents
    .filter((d) => !group || d.group === group)
    .map((d) => {
      const prev = all[d.file];
      // The CV previews are made by "npm run cv:pdf", which builds the site first: that build
      // must not need them. The production build checks them (scripts/markers.mjs).
      if ((!prev || prev.images.length === 0) && d.group === 'cv') {
        return { ...d, title: `${d.kind === 'ats' ? t.cvAts : t.cvDesigned} · ${t.langName[d.lang!]}`, owner: profile.name, size: sizeOf(d.file, lang), pages: 0, images: [] };
      }
      if (!prev || prev.images.length === 0) {
        throw new Error(`[documents] No preview for ${d.file}. Run "npm run ${d.group === 'cv' ? 'cv:pdf' : 'docs:previews'}".`);
      }
      let title: string;
      if (d.group === 'cv') {
        title = `${d.kind === 'ats' ? t.cvAts : t.cvDesigned} · ${t.langName[d.lang!]}`;
      } else {
        const found = titles.get(d.file);
        if (!found) throw new Error(`[documents] ${d.file} is not linked anywhere in content/${lang}/: its title comes from that link`);
        title = found;
      }
      return { ...d, title, owner: profile.name, size: sizeOf(d.file, lang), pages: prev.pages, images: prev.images };
    });
}
