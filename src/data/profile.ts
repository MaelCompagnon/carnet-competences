// Public contact details (never the phone number: it only goes into the CV PDFs, from .env).
export const profile = {
  name: 'Maël Compagnon',
  email: 'mael.compagnon@outlook.fr',
  linkedin: 'https://www.linkedin.com/in/maelcompagnon',
  github: 'https://github.com/MaelCompagnon',
};

export const cvFiles = {
  fr: { designed: '/cv/CV-Mael-Compagnon-FR.pdf', ats: '/cv/CV-Mael-Compagnon-FR-ATS.pdf' },
  en: { designed: '/cv/CV-Mael-Compagnon-EN.pdf', ats: '/cv/CV-Mael-Compagnon-EN-ATS.pdf' },
};

// SPEC §2: the site must welcome the next steps of the portfolio without a redesign.
// Only the steps marked as available are shown; the others are a reserved slot.
export const steps = [
  { id: 'ing4-s7', available: true },
  { id: 'ing4-s8', available: false },
  { id: 'ing5', available: false },
];
