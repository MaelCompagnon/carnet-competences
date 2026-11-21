// The short texts of the one-page (annotations, captions, links), read from
// content/<lang>/10-une-page.md. Like every content file, items are found by POSITION:
// one "#" section per chapter, in the order of the page, with the same lines in both languages.
import fs from 'node:fs';
import path from 'node:path';
import { MARKER_RE } from '../../scripts/markers.mjs';
import { at, fieldsOf, loadDoc, splitDot, type Section } from './content';
import type { Lang } from '../i18n/routes';

const FILE = '10-une-page';

export interface Chapter {
  title: string;
  /** Handwritten note next to the chapter number. */
  note: string;
  /** Label of the link to the detailed page (absent on chapter 01). */
  link?: string;
}

function fields(s: Section) {
  return fieldsOf(s.tokens).fields;
}

export function onePage(lang: Lang) {
  const doc = loadDoc(lang, FILE);
  // Eight chapters, then the end of the thread (the contact post-it under chapter 08).
  if (doc.top.length !== 9) throw new Error(`[content] ${doc.file} must have 8 chapters and the end of the thread, found ${doc.top.length} sections`);
  const chapters: Chapter[] = doc.top.slice(0, 8).map((s) => {
    const f = fields(s);
    const note = at(f, 0, s.where).value;
    // Chapter 01 has no link; every other chapter ends with one.
    const last = f[f.length - 1];
    return { title: s.title, note, link: s === doc.top[0] ? undefined : last?.value };
  });
  // End of the thread: "word · rest". The thread writes the word (src/lib/thread-ink.ts),
  // the rest of the sentence comes in handwriting.
  const endRaw = at(fields(at(doc.top, 8, doc.file)), 0, doc.file).value;
  const [endWord, ...endRest] = splitDot(endRaw.replace(MARKER_RE, '').trim());

  const home = fields(at(doc.top, 0, doc.file));
  const about = fields(at(doc.top, 1, doc.file));
  // Chapter 02: annotation, highlighted words, back of the badge (/qui-je-suis), link.
  if (about.length !== 4) throw new Error(`[content] ${doc.file} › chapter 02 must have 4 lines, found ${about.length}`);
  const exp = fields(at(doc.top, 2, doc.file));
  // "révisions · Nemotron · Gemini · humain": the steps of TimeProof, drawn as pills.
  // A pending note in the line is kept apart, so that a draft still shows it.
  const diagramRaw = at(exp, 1, doc.file).value;

  // A pending note written above the first heading is not part of any section:
  // it is shown at the top of the page, so a draft never hides it.
  const raw = fs.readFileSync(path.resolve('content', lang, `${FILE}.md`), 'utf8');
  const head = raw.slice(0, raw.search(/^# /m));
  const pending = [...head.matchAll(MARKER_RE)].map((m) => m[0]);

  return {
    chapters,
    pending,
    portraitCaption: at(home, 1, doc.file).value,
    statsNote: at(home, 2, doc.file).value,
    heroWords: splitDot(at(home, 3, doc.file).value),
    aboutWords: splitDot(at(about, 1, doc.file).value),
    /** Easter egg on the back of the badge (About page). Kept as inline Markdown: a pending note stays visible in drafts. */
    badgeBack: at(about, 2, doc.file).value,
    diagram: splitDot(diagramRaw.replace(MARKER_RE, '').trim()),
    diagramPending: [...diagramRaw.matchAll(MARKER_RE)].map((m) => m[0]),
    /** Where the thread ends: the word it writes, then the rest. A pending note is kept apart, as for the diagram. */
    end: {
      word: endWord.toLowerCase(),
      rest: endRest.join(' '),
      pending: [...endRaw.matchAll(MARKER_RE)].map((m) => m[0]),
    },
  };
}

const PASTELS = ['mustard', 'periwinkle', 'pink', 'lavender'];

/**
 * Wraps the first occurrence of each key phrase in a highlighter band.
 * Works on rendered HTML, outside tags only. A phrase that is not found is an error:
 * the build must not silently drop a highlight after a content edit.
 */
export function highlight(html: string, words: string[], where: string): string {
  let out = html;
  words.forEach((w, i) => {
    const needle = w.replace(/&/g, '&amp;').replace(/'/g, '&#39;');
    const parts = out.split(/(<[^>]+>)/);
    let done = false;
    for (let k = 0; k < parts.length && !done; k++) {
      if (parts[k].startsWith('<')) continue;
      // Case-insensitive on the first letter only, so a phrase can start a sentence.
      const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(needle).replace(/^\\?(\p{L})/u, (_m, c) => `[${c.toLowerCase()}${c.toUpperCase()}]`)})(?![\\p{L}])`, 'u');
      const m = parts[k].match(re);
      if (!m || m.index === undefined) continue;
      const start = m.index + m[1].length;
      parts[k] =
        parts[k].slice(0, start) +
        `<span class="hl hl--${PASTELS[i % PASTELS.length]}" data-hl>${m[2]}</span>` +
        parts[k].slice(start + m[2].length);
      done = true;
    }
    if (!done) throw new Error(`[content] Highlighted words "${w}" not found in the text they belong to (${where})`);
    out = parts.join('');
  });
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
