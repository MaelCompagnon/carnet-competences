import { defineConfig } from 'astro/config';
import path from 'node:path';
import { cvPdfsUpToDate, findMarkers, formatMarkers } from './scripts/markers.mjs';

// SPEC §3: the production build must fail while a marker remains in the content.
function markerGuard() {
  return {
    name: 'marker-guard',
    hooks: {
      'astro:build:start': () => {
        const markers = findMarkers();
        const draft = process.env.ALLOW_MARKERS === '1';
        if (markers.length === 0) {
          // The CV PDFs are printed ahead of the build: stale ones would publish an old CV,
          // possibly with markers that have since been resolved in the content.
          if (!draft && !cvPdfsUpToDate()) {
            throw new Error('Production build blocked: the CV PDFs in public/cv/ are older than content/*/09-cv.md. Run "npm run cv:pdf", then build again.');
          }
          return;
        }
        if (draft) {
          console.warn(`[marker-guard] Draft build: ${markers.length} marker(s) left in content/. Do not deploy.`);
          return;
        }
        throw new Error(
          `Production build blocked: ${markers.length} marker(s) left in content/.\n${formatMarkers(markers)}\n` +
            'Resolve them, or run "npm run build:draft" to build a draft.',
        );
      },
    },
  };
}

// The pages read content/*.md with fs, outside Vite's module graph:
// without this, editing a content file would not refresh the browser in dev.
function contentReload() {
  const dir = path.resolve('content');
  return {
    name: 'content-reload',
    configureServer(server) {
      server.watcher.add(dir);
      server.watcher.on('change', (file) => {
        if (path.resolve(file).startsWith(dir)) (server.hot ?? server.ws).send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  // Netlify exposes the public address as URL during its builds.
  site: process.env.SITE_URL || process.env.URL || 'http://localhost:4321',
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [markerGuard()],
  vite: { plugins: [contentReload()] },
});
