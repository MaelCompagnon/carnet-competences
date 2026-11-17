// Data shared by every page (navigation, footer, hero), read from content/<lang>/00-accueil.md.
import { at, fieldsOf, listOf, loadDoc, splitDot, tableOf } from './content';
import { idFromPath, type Lang, type RouteId } from '../i18n/routes';

const CHAPTER_IDS: RouteId[] = ['about', 'experiences', 'skills', 'target', 'engagements', 'projects', 'cv'];

const stripParen = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '');
const unquote = (s: string) => s.replace(/[«»"“”]/g, '').trim();

export function siteData(lang: Lang) {
  const doc = loadDoc(lang, '00-accueil');
  const hero = at(doc.top, 0, doc.file);
  const stats = at(doc.top, 1, doc.file);
  const chap = at(doc.top, 2, doc.file);
  const foot = at(doc.top, 3, doc.file);

  // Hero lines, in order: kicker, name, tagline, sub-tagline, buttons, availability badge.
  const f = fieldsOf(hero.tokens).fields;
  const field = (i: number) => at(f, i, hero.where);

  const cta = (field(4).items ?? []).map((raw) => {
    const [label, target] = raw.split('→');
    if (!target) throw new Error(`[content] Button without "→ /path" in ${hero.where}: "${raw}"`);
    return { label: unquote(label), id: idFromPath(target.replace(/\([^)]*\)/, '')) };
  });

  const chapters = listOf(chap).map((raw, i) => {
    const m = raw.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]*)$/);
    if (!m) throw new Error(`[content] Chapter line must be "**Title** — text" in ${chap.where}: "${raw}"`);
    return { id: at(CHAPTER_IDS, i, chap.where), title: m[1], desc: m[2] };
  });

  const footer = listOf(foot);
  const quote = at(footer, 3, foot.where).match(/[«"“]\s*(.+?)\s*[»"”]/);

  return {
    seoTitle: doc.data.titre_seo,
    seoDesc: doc.data.description_seo,
    kicker: field(0).value,
    // "Étape 1 (ING4 – S7)": the last part of the kicker names the current step of the portfolio.
    stage: splitDot(field(0).value).at(-1) ?? '',
    name: field(1).value,
    tagline: field(2).value,
    sub: field(3).value,
    cta,
    badge: field(5).value,
    statsTitle: stripParen(stats.title),
    stats: tableOf(stats).rows.map(([value, label]) => ({ value, label })),
    chaptersTitle: stripParen(chap.title),
    chapters,
    footer: {
      updatedLabel: at(footer, 0, foot.where).split('[')[0].replace(/\s*:\s*$/, '').trim(),
      credit: at(footer, 1, foot.where),
      quote: quote ? quote[1] : '',
    },
  };
}

export type SiteData = ReturnType<typeof siteData>;
