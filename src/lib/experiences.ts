// The three experiences, as short "sheets" for chapter 03 of the one-page and for the index.
// Each experience file ends with the same two sections, whatever comes before them:
// "Ce que j'en retire" (a table) then "Le lien avec le métier que je vise". They are read
// from the end, so the files can keep a different number of sections in the middle.
import type { Tokens } from 'marked';
import { at, fieldsOf, loadPage, plain, tableOf, type Field } from './content';
import { experienceIds, route, type Lang, type RouteId } from '../i18n/routes';

export interface ExperienceSheet {
  id: RouteId;
  title: string;
  fields: Field[];
  /** "Comment je l'ai développée": skill → how. */
  takeaways: { skill: string; how: string }[];
  takeawaysTitle: string;
  linkTitle: string;
  /** First paragraph of "Le lien avec le métier que je vise" (the evidence line is left to the page). */
  link: string;
}

export function experienceSheets(lang: Lang): ExperienceSheet[] {
  return experienceIds.map((id) => {
    const { doc, h1, title, sections } = loadPage(lang, route(id).file);
    const n = sections.length;
    const takeaways = at(sections, n - 2, doc.file);
    const target = at(sections, n - 1, doc.file);
    const para = target.tokens.find((t) => t.type === 'paragraph') as Tokens.Paragraph | undefined;
    if (!para) throw new Error(`[content] No paragraph in ${target.where}`);
    return {
      id,
      title,
      fields: fieldsOf(h1.tokens).fields,
      takeaways: tableOf(takeaways).rows.map(([skill, how]) => ({ skill: plain(skill), how })),
      takeawaysTitle: takeaways.title,
      linkTitle: target.title,
      link: para.text,
    };
  });
}
