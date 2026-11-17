import type { Lang } from '../i18n/routes';

// Every document shown in the site. Adding a certificate or an internship report later is one
// line here (then "npm run docs:previews" for its page images). Titles are not written here:
// the CVs take theirs from src/i18n/ui.ts, the other documents from the text of the link to
// their file in content/<lang>/ (the certificates list, the "Preuves" line of an experience).
//
// Never list reference/ActivESAIP_2.pdf: it is a team document (other people's photo and e-mail).

export interface DocEntry {
  id: string;
  /** Path under public/. */
  file: string;
  group: 'cv' | 'engagement' | 'report';
  /** "first": only the first page is previewed (the LEP shows other people; decision of 17 Nov 2026). */
  preview: 'all' | 'first';
  /** CVs exist in one file per language. */
  lang?: Lang;
  kind?: 'designed' | 'ats';
}

export const documents: DocEntry[] = [
  // Maël's own designed CV (not printed by the site; see scripts/make-cv-pdf.mjs).
  { id: 'cv-fr', file: '/cv/CV-Mael-Compagnon-FR.pdf', group: 'cv', preview: 'all', lang: 'fr', kind: 'designed' },
  { id: 'cv-en', file: '/cv/CV-Mael-Compagnon-EN.pdf', group: 'cv', preview: 'all', lang: 'en', kind: 'designed' },
  { id: 'cv-ats-fr', file: '/cv/CV-Mael-Compagnon-FR-ATS.pdf', group: 'cv', preview: 'all', lang: 'fr', kind: 'ats' },
  { id: 'cv-ats-en', file: '/cv/CV-Mael-Compagnon-EN-ATS.pdf', group: 'cv', preview: 'all', lang: 'en', kind: 'ats' },
  { id: 'attestation-ant', file: '/documents/attestation-ant-2025-2026.pdf', group: 'engagement', preview: 'all' },
  { id: 'lep', file: '/documents/LEP-Mael-Compagnon.pdf', group: 'engagement', preview: 'first' },
  { id: 'rapport-salmar', file: '/documents/rapport-stage-salmar-2026.pdf', group: 'report', preview: 'all' },
  // Public version (decision of 17 Nov 2026): without the company's security audit, the staff photos and
  // names pages, the daily log and the appendices (old CV, letters). The full report stays private.
  { id: 'rapport-1re-annee', file: '/documents/rapport-stage-1re-annee-2024.pdf', group: 'report', preview: 'all' },
];
