// One source (content/<lang>/09-cv.md) for the three CV renderings: web page, designed PDF, ATS PDF.
import type { Tokens } from 'marked';
import { at, inline, loadPage, plain, splitDot } from './content';
import type { Lang } from '../i18n/routes';

export interface CvItem {
  kind: 'text' | 'email' | 'phone' | 'link';
  html: string;
  text: string;
  href?: string;
}

function item(raw: string): CvItem {
  const text = plain(raw);
  // The phone number is not in the repository: the PDF script fills this slot from .env.
  if (raw.includes('{{telephone}}')) return { kind: 'phone', html: '', text: '' };
  if (/^[^\s@]+@[^\s@]+$/.test(text)) return { kind: 'email', html: text, text, href: `mailto:${text}` };
  // A bare domain ("portfolio-mael-compagnon.netlify.app") is a link too.
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text)) return { kind: 'link', html: text, text, href: `https://${text}` };
  return { kind: 'text', html: inline(raw), text };
}

export function cvData(lang: Lang) {
  const { doc, h1, sections } = loadPage(lang, '09-cv');
  // Header block, one item per line: name, title, goal, contact details, links.
  const head = h1.tokens.find((t) => t.type === 'paragraph') as Tokens.Paragraph | undefined;
  if (!head) throw new Error(`[content] The CV header block is missing in ${doc.file}`);
  const lines = head.text.split('\n').map((l) => l.trim());
  const line = (i: number) => at(lines, i, `${doc.file} › header`);
  return {
    doc,
    pageTitle: h1.title,
    name: plain(line(0)),
    title: line(1),
    goal: line(2),
    contacts: splitDot(line(3)).map(item),
    links: splitDot(line(4)).map(item),
    sections,
  };
}
