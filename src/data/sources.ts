import type { RouteId } from '../i18n/routes';

// Columns of the skills matrix. A skill is linked to a source only when one of its
// proofs (the text in content/<lang>/05-competences.md) mentions it: nothing is
// declared by hand here, so the matrix cannot claim more than the text does.
// The patterns cover the French and the English wording.
export const sources: { id: string; page?: RouteId; match: RegExp }[] = [
  {
    id: 'salmar',
    page: 'salmar',
    match: /SalMar|Frøya|Deep Tracker|FleXicut|15 semaines|15 weeks|sur la ligne|on the line|Norvège|Norway/,
  },
  { id: 'junction', page: 'junction', match: /Junction|premier hackathon|first hackathon/i },
  { id: 'ageo', page: 'ageo', match: /AGEO|MIPIH/ },
  { id: 'seamk', match: /SeAMK|Finlande|Finland|Erasmus/ },
  { id: 'esaip', match: /ESAIP|option IA|AI major/ },
  { id: 'ant', page: 'engagements', match: /\bANT\b|seniors|Trélazé/ },
  { id: 'bde', page: 'engagements', match: /\bBDE\b|\bWEI\b|gala/i },
  {
    id: 'projets',
    page: 'projects',
    match: /Histona|fitness-os|Woordle|Bataille navale|projets personnels|personal projects/i,
  },
];
