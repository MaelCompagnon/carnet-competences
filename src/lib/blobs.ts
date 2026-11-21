// Soft, irregular shapes in the background ("ectoplasms"): crisp blobs a shade lighter than the
// paper, tone on tone, that slowly change shape. Where the mouse touches an edge, the edge gives
// way and wobbles back like jelly. They may lie under the text: a lighter background only raises
// the contrast of the dark text on it.
//
// Placed at build time from a seeded sequence, so a page looks the same on every visit, and
// drawn in their first shape by HTML + CSS alone (no script, "reduce motion"). The script
// (src/scripts/blobs.ts) only makes them change shape and react.

/** Three shades, all a little lighter than the paper (global.css, .blob--a to c). */
const SHADES = ['a', 'b', 'c'];
/** Points around a blob: enough for the edge to dent locally, few enough to stay smooth. */
export const BLOB_POINTS = 18;

export interface Blob {
  shade: string;
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

/** Radius of point k at time t, around 1: the slow change of shape. */
export function blobRadius(phases: number[], speed: number, k: number, t: number): number {
  const n = phases.length;
  return 1 + 0.1 * Math.sin(t * 0.35 * speed + phases[k]) + 0.05 * Math.sin(t * 0.6 * speed + phases[(k + 5) % n]);
}

/**
 * Closed smooth outline in a unit circle, through the radii given for each point (Catmull-Rom
 * as cubic curves). Shared with the script, so its first frame is the shape the HTML shows.
 */
export function outline(radii: number[]): string {
  const n = radii.length;
  const pts = radii.map((r, k) => {
    const a = (k / n) * Math.PI * 2;
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
  return Array.from({ length: count }, (_, i) => {
    const shade = SHADES[i % SHADES.length];
    const top = ((i + 0.2 + rand() * 0.6) / count) * 100;
    const side = i % 2 === 0 ? rand() * 0.45 : 0.55 + rand() * 0.45;
    const r = Math.round(110 + rand() * 130);
    const phases = Array.from({ length: BLOB_POINTS }, () => Number((rand() * 6.283).toFixed(2)));
    const speed = Number((0.8 + rand() * 0.5).toFixed(3));
    return {
      shade,
      style: `top:${top.toFixed(1)}%;left:${(side * 100).toFixed(1)}%;--r:${r}px`,
      d: outline(phases.map((_, k) => blobRadius(phases, speed, k, 0))),
      phases: phases.join(' '),
      speed: String(speed),
    };
  });
}
