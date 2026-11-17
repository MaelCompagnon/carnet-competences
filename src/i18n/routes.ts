export type Lang = 'fr' | 'en';
export const langs: Lang[] = ['fr', 'en'];

// One entry per page. English pages use the same paths under /en/ (SPEC §2),
// which is what lets the language switch keep the current page.
export const routes = [
  { id: 'home', path: '/', file: '00-accueil' },
  { id: 'about', path: '/qui-je-suis/', file: '01-qui-je-suis' },
  { id: 'experiences', path: '/experiences/', file: '' },
  { id: 'salmar', path: '/experiences/salmar/', file: '02-experience-salmar' },
  { id: 'junction', path: '/experiences/junction-2026/', file: '03-experience-junction' },
  { id: 'ageo', path: '/experiences/ageo-mipih/', file: '04-experience-ageo-mipih' },
  { id: 'skills', path: '/competences/', file: '05-competences' },
  { id: 'target', path: '/metier-vise/', file: '06-metier-vise' },
  { id: 'engagements', path: '/engagements/', file: '07-engagements' },
  { id: 'projects', path: '/projets/', file: '08-projets' },
  { id: 'cv', path: '/cv/', file: '09-cv' },
  { id: 'cv-print', path: '/cv/print/', file: '09-cv' },
  { id: 'cv-ats', path: '/cv/ats/', file: '09-cv' },
] as const;

export type RouteId = (typeof routes)[number]['id'];

export const experienceIds = ['salmar', 'junction', 'ageo'] as const satisfies readonly RouteId[];

export function route(id: RouteId) {
  return routes.find((r) => r.id === id)!;
}

export function href(lang: Lang, id: RouteId): string {
  const p = route(id).path;
  return lang === 'fr' ? p : `/en${p}`;
}

/** Content files point to pages with their French path ("/qui-je-suis"). */
export function idFromPath(p: string): RouteId {
  const norm = (x: string) => x.replace(/\/+$/, '') || '/';
  const r = routes.find((x) => norm(x.path) === norm(p.trim()));
  if (!r) throw new Error(`[routes] Unknown page path in content: "${p}"`);
  return r.id;
}

/** The main chapter a page belongs to, for the navigation highlight. */
export function chapterOf(id: RouteId): RouteId {
  if ((experienceIds as readonly string[]).includes(id)) return 'experiences';
  if (id === 'cv-print' || id === 'cv-ats') return 'cv';
  return id;
}
