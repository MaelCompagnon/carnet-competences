// Reads content/<lang>/*.md at build time and exposes it as sections, tables and lists.
// The same templates serve French and English, so items are found by POSITION,
// never by their label: both language files must keep the same structure.
import fs from 'node:fs';
import path from 'node:path';
import { Marked, type Token, type Tokens } from 'marked';
import { MARKER_RE } from '../../scripts/markers.mjs';
import type { Lang } from '../i18n/routes';

export interface Section {
  depth: number;
  title: string;
  id: string;
  tokens: Token[];
  children: Section[];
  /** "file › heading", used in error messages. */
  where: string;
}

export interface Doc {
  lang: Lang;
  file: string;
  data: Record<string, string>;
  /** Top-level sections (the "#" headings). */
  top: Section[];
}

export interface Field {
  label: string;
  value: string;
  /** Set when the value is the list that follows the label line. */
  items?: string[];
}

const CONTENT_DIR = path.resolve(process.cwd(), 'content');
const FIELD_RE = /^\*\*(.+?)\s*:\*\*\s*(.*)$/;
const LEVEL_CLASS: Record<string, string> = { '🟢': 'ok', '🟠': 'mid', '🔴': 'gap' };

// French typography: the space before : ; ! ? and inside « » must not break, or the sign
// ends up alone at the start of a line. Done here, at reading time, so the content files
// stay easy to type. Thousands (862 076) and hours (48 h) are kept together as well.
const NBSP = String.fromCharCode(0xa0);
const THIN_NBSP = String.fromCharCode(0x202f);

function frenchSpaces(src: string): string {
  return src
    .replace(/ ([;!?»])/g, THIN_NBSP + '$1')
    .replace(/ :(?=\s|\*|$)/gm, NBSP + ':')
    .replace(/« /g, '«' + NBSP)
    .replace(/(\d) (?=\d{3}(?!\d))/g, '$1' + THIN_NBSP)
    .replace(/(\d) (?=[hj]\b)/g, '$1' + NBSP);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function slug(s: string): string {
  return plain(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Markdown to plain text, for attributes and meta tags. Markers are dropped. */
export function plain(md: string): string {
  return md
    .replace(MARKER_RE, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|\*|`/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

export function splitDot(s: string): string[] {
  return s
    .split(/\s+·\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const md = new Marked({ gfm: true, breaks: true });
md.use({
  renderer: {
    // Each cell carries its column name so narrow screens can stack rows into labelled blocks.
    table(token: Tokens.Table) {
      const labels = token.header.map((c) => plain(c.text));
      const head = token.header.map((c) => `<th scope="col">${this.parser.parseInline(c.tokens)}</th>`).join('');
      const rows = token.rows
        .map(
          (row) =>
            '<tr>' +
            row
              .map((c, i) => `<td data-label="${esc(labels[i] ?? '')}">${this.parser.parseInline(c.tokens)}</td>`)
              .join('') +
            '</tr>',
        )
        .join('');
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
    link(token: Tokens.Link) {
      const external = /^https?:/.test(token.href);
      return `<a href="${esc(token.href)}"${external ? ' rel="noopener"' : ''}>${this.parser.parseInline(token.tokens)}</a>`;
    },
    heading(token: Tokens.Heading) {
      return `<h${token.depth} id="${slug(token.text)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
    },
  },
});

// None of the site fonts has "→": in running text it is drawn, like the other arrows
// (src/components/Arrow.astro). Styled inline, so it also renders in the CV print pages.
const ARROW =
  '<svg class="arrow" role="img" aria-label="→" viewBox="0 0 32 16" width="1.4em" height="0.7em" ' +
  'style="fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transform:rotate(180deg);vertical-align:-0.05em">' +
  '<path d="M30 9.2c-6.5-1.6-15.4-1.9-26.6-.6"/><path d="M9.6 2.6 3.2 8.7l6.9 4.9"/></svg>';

/** "→" in text (never inside a tag) becomes the drawn arrow. */
function arrows(html: string): string {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(/→/g, ARROW)))
    .join('');
}

/** Highlights pending markers and turns the level emoji into a pill (colour AND text). */
function decorate(html: string): string {
  return arrows(html)
    .replace(MARKER_RE, (m) => `<mark class="marker">${m}</mark>`)
    .replace(
      /(<td[^>]*>)\s*(🟢|🟠|🔴)\s*([^<]+?)\s*(<\/td>)/gu,
      (_m, open, emoji, text, close) => `${open}<span class="pill pill--${LEVEL_CLASS[emoji]}">${text}</span>${close}`,
    );
}

export function inline(src: string): string {
  return decorate(md.parseInline(src) as string);
}

function fieldLines(text: string): Field[] | null {
  const fields: Field[] = [];
  for (const line of text.split('\n')) {
    const m = line.trim().match(FIELD_RE);
    if (!m) return null;
    fields.push({ label: m[1], value: m[2] });
  }
  return fields;
}

/**
 * Extracts the "**Label :** value" lines. A label with no value takes the list that follows it.
 * `rest` holds every token that is not a field block.
 */
export function fieldsOf(tokens: Token[], min = 1): { fields: Field[]; rest: Token[] } {
  const fields: Field[] = [];
  const rest: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const found = t.type === 'paragraph' ? fieldLines((t as Tokens.Paragraph).text) : null;
    if (!found || found.length < min) {
      rest.push(t);
      continue;
    }
    const last = found[found.length - 1];
    const next = tokens[i + 1];
    if (!last.value && next?.type === 'list') {
      last.items = (next as Tokens.List).items.map((it) => it.text);
      i++;
    }
    fields.push(...found);
  }
  return { fields, rest };
}

export function fieldHtml(f: Field): string {
  if (f.items) return `<ul>${f.items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`;
  return inline(f.value);
}

/** Generic rendering. Blocks of two or more label lines become a definition list. */
export function render(tokens: Token[]): string {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const found = t.type === 'paragraph' ? fieldLines((t as Tokens.Paragraph).text) : null;
    if (!found || found.length < 2) {
      out.push(t);
      continue;
    }
    const last = found[found.length - 1];
    const next = tokens[i + 1];
    if (!last.value && next?.type === 'list') {
      last.items = (next as Tokens.List).items.map((it) => it.text);
      i++;
    }
    const rows = found.map((f) => `<div><dt>${inline(f.label)}</dt><dd>${fieldHtml(f)}</dd></div>`).join('');
    out.push({ type: 'html', raw: '', text: `<dl class="facts">${rows}</dl>`, block: true, pre: false } as Tokens.HTML);
  }
  return decorate(md.parser(out));
}

function buildTree(tokens: Token[], file: string): Section[] {
  const root: Section = { depth: 0, title: '', id: '', tokens: [], children: [], where: file };
  const stack: Section[] = [root];
  for (const t of tokens) {
    if (t.type === 'space') continue;
    if (t.type === 'heading') {
      const h = t as Tokens.Heading;
      const s: Section = { depth: h.depth, title: h.text, id: slug(h.text), tokens: [], children: [], where: `${file} › ${h.text}` };
      while (stack[stack.length - 1].depth >= h.depth) stack.pop();
      stack[stack.length - 1].children.push(s);
      stack.push(s);
    } else {
      stack[stack.length - 1].tokens.push(t);
    }
  }
  return root.children;
}

function parseFrontmatter(src: string): { data: Record<string, string>; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return { data, body: src.slice(m[0].length) };
}

export function loadDoc(lang: Lang, file: string): Doc {
  const rel = `content/${lang}/${file}.md`;
  const full = path.join(CONTENT_DIR, lang, `${file}.md`);
  if (!fs.existsSync(full)) throw new Error(`[content] Missing file: ${rel}`);
  const { data, body } = parseFrontmatter(fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n'));
  const top = buildTree(md.lexer(lang === 'fr' ? frenchSpaces(body) : body), rel);
  if (top.length === 0) throw new Error(`[content] No heading found in ${rel}`);
  return { lang, file: rel, data, top };
}

/** Pages with one "#" title: the title section and its "##" sections. */
export function loadPage(lang: Lang, file: string) {
  const doc = loadDoc(lang, file);
  const h1 = doc.top[0];
  return { doc, h1, title: h1.title, sections: h1.children };
}

export function at<T>(arr: readonly T[], i: number, where: string): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`[content] Item #${i + 1} is missing in ${where}`);
  return v;
}

export function tableOf(s: Section, n = 0): { head: string[]; rows: string[][] } {
  const t = s.tokens.filter((x) => x.type === 'table')[n] as Tokens.Table | undefined;
  if (!t) throw new Error(`[content] Table #${n + 1} is missing in ${s.where}`);
  return { head: t.header.map((c) => c.text), rows: t.rows.map((r) => r.map((c) => c.text)) };
}

export function listOf(s: Section, n = 0): string[] {
  const t = s.tokens.filter((x) => x.type === 'list')[n] as Tokens.List | undefined;
  if (!t) throw new Error(`[content] List #${n + 1} is missing in ${s.where}`);
  return t.items.map((it) => it.text);
}

/** Tokens of a section without its tables (when a component draws the table itself). */
export function withoutTables(s: Section): Token[] {
  return s.tokens.filter((x) => x.type !== 'table');
}
