// Data of the skills page, shared by /competences and chapter 04 of the one-page.
import type { MatrixSkill } from '../components/Matrix.astro';
import { at, listOf, loadPage, plain, splitDot, tableOf } from './content';
import { sources } from '../data/sources';
import type { Lang } from '../i18n/routes';

export function skillsData(lang: Lang) {
  const page = loadPage(lang, '05-competences');
  const { doc, sections } = page;
  // Sections, in order: levels, technical, behavioural, transferable skills, one-sentence summary.
  const levels = at(sections, 0, doc.file);
  const groups = [1, 2, 3].map((i) => at(sections, i, doc.file));
  const summary = at(sections, 4, doc.file);

  // "**Maîtrisé** : …" → level names (strongest first) and their definition.
  const levelList = listOf(levels).map((raw) => {
    const m = raw.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/s);
    return { name: plain(m?.[1] ?? raw), text: m?.[2] ?? '' };
  });
  const levelNames = levelList.map((l) => l.name);

  const matrix = groups.map((g) => {
    const { head, rows } = tableOf(g);
    const hasLevel = head.length === 3;
    const skills: MatrixSkill[] = rows.map((r) => {
      const proofs = splitDot(r[hasLevel ? 2 : 1]);
      const srcs = new Set<string>();
      for (const p of proofs) {
        const hits = sources.filter((s) => s.match.test(p));
        // A proof that names no known source would silently vanish from the matrix: stop the build instead.
        if (hits.length === 0) {
          throw new Error(`[matrix] No source matches the proof "${p}" in ${g.where}. Add a pattern in src/data/sources.ts.`);
        }
        hits.forEach((s) => srcs.add(s.id));
      }
      return { name: plain(r[0]), level: hasLevel ? plain(r[1]) : '', proofs: proofs.map(plain), srcs: [...srcs] };
    });
    return { title: plain(g.title), skills };
  });

  /** Turns the level words of rendered tables into pills, coloured by rank. */
  const pills = (html: string) =>
    html.replace(/(<td data-label="[^"]*">)([^<]+)(<\/td>)/g, (m, open, text, close) => {
      const rank = levelNames.indexOf(text.trim());
      return rank < 0 ? m : `${open}<span class="pill pill--l${rank + 1}">${text.trim()}</span>${close}`;
    });

  return { ...page, levels, levelList, groups, summary, matrix, pills };
}
