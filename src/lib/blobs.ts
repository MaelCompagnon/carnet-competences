// Soft, irregular shapes in the background ("ectoplasms"): very pale pastel blobs with blurred
// edges that slowly change shape, and drift a little aside when the mouse passes. They may lie
// under the text: they are pale enough that every measured contrast stays above AA.
//
// Placed at build time from a seeded sequence, so a page looks the same on every visit, and
// drawn in their first shape by HTML + CSS alone (no script, "reduce motion"). The script
// (src/scripts/blobs.ts) only makes them change shape and move.

const COLORS = ['mustard', 'periwinkle', 'pink', 'lavender', 'sage'];
/** Points around a blob: few enough to stay round and soft. */
export const BLOB_POINTS = 8;

export interface Blob {
  color: string;
  style: string;
  /** Initial outline, in a unit circle. */
  d: string;
  /** Seeds of the morphing, read by the script. */
  phases: string;
  speed: string;
}

/** Same pseudo-random sequence as the thread: the same page on every visit. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

/**
 * Outline of a blob at time t, as a closed smooth path in a unit circle. Shared with the
 * script, so that the first frame it draws is the shape the HTML already shows.
 */
export function blobPath(phases: number[], speed: number, t: number): string {
  const n = phases.length;
  const pts = phases.map((ph, k) => {
    const a = (k / n) * Math.PI * 2;
    const r = 1 + 0.17 * Math.sin(t * speed + ph) + 0.08 * Math.sin(t * speed * 1.9 + phases[(k + 3) % n]);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const f = (v: number) => v.toFixed(3);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    if (i === 0) d += `M${f(p1[0])} ${f(p1[1])}`;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/**
 * `count` blobs spread down a page, one row after the other, alternately in the left and the
 * right half (never lined up). Positions are in % of the page, sizes in px.
 */
export function blobs(seed: number, count: number): Blob[] {
  const rand = seeded(seed);
  let lastColor = '';
  return Array.from({ length: count }, (_, i) => {
    let color = COLORS[Math.floor(rand() * COLORS.length)];
    if (color === lastColor) color = COLORS[(COLORS.indexOf(color) + 2) % COLORS.length];
    lastColor = color;
    const top = ((i + 0.2 + rand() * 0.6) / count) * 100;
    const side = i % 2 === 0 ? rand() * 0.45 : 0.55 + rand() * 0.45;
    const r = Math.round(110 + rand() * 130);
    const phases = Array.from({ length: BLOB_POINTS }, () => Number((rand() * 6.283).toFixed(2)));
    const speed = Number((0.22 + rand() * 0.22).toFixed(3));
    return {
      color,
      style: `top:${top.toFixed(1)}%;left:${(side * 100).toFixed(1)}%;--r:${r}px`,
      d: blobPath(phases, speed, 0),
      phases: phases.join(' '),
      speed: String(speed),
    };
  });
}
