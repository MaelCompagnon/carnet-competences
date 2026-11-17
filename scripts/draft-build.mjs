// Builds the site even if markers remain, to check that everything compiles.
// The output still shows the markers highlighted: never deploy it.
process.env.ALLOW_MARKERS = '1';
const { build } = await import('astro');
await build({});
