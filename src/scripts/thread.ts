// The thread: a burgundy string, as on a cork board, from one chapter number (the "pins") to
// the next, on the one-page and down every detailed page. No library: it must also be drawn
// with "reduce motion", where GSAP and Lenis are never loaded, and the detailed pages have no
// GSAP at all (Lighthouse). Without JavaScript, a straight CSS line stands in for it.
//
// The line is the first thread of the one-page: between two pins it swings into the left
// margin (64 px at most) and wobbles a little, always the same way. Now and then, where the
// margin is wide enough, the string makes a small round loop. On a detailed page it hooks
// onto the left side of its pin, so that it never runs across the title below. On a phone it
// runs down the margin, through the pins of the one-page.
//
// With motion allowed, the thread is drawn as the reader scrolls, and each pin bounces then
// fills when the tip of the thread reaches it. The path is computed from the layout position
// of the pins, and computed again whenever the page changes size (fonts, images, resize).
//
// The one-page ends under chapter 08 ([data-thread-end], not a [data-pin]: the pins are tied
// by their index to the chapter index). When the whole thread is drawn, it ties a knot and
// writes a word, then the rest of the sentence appears in handwriting (CSS, once per visit).
// The start state (.is-armed) is set here only, never with "reduce motion": without the
// script, the knot and the words are simply drawn.

const TIP = 0.62; // the tip of the thread sits at 62 % of the screen height
const STEP = 280; // one wobble point every 280 px between two pins
const SWING = 64; // how far the thread swings into the margin, at most
const LOOP_X = 12; // a loop of string: half its width…
const LOOP_Y = 17; // …its turn along the thread (larger: the loop comes out round, not flat)…
const LOOP_C = 4.2; // …and how far the string runs down while it turns

export function initThread(host: HTMLElement) {
  const svg = host.querySelector<SVGSVGElement>('svg.thread');
  const path = svg?.querySelector<SVGPathElement>('path');
  const pins = [...host.querySelectorAll<HTMLElement>('[data-pin]')];
  const toc = [...host.querySelectorAll<HTMLAnchorElement>('[data-toc]')];
  const endEl = host.querySelector<HTMLElement>('[data-thread-end]');
  const endPin = endEl?.querySelector<HTMLElement>('[data-thread-end-pin]');
  if (!svg || !path) return;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let total = 0;
  // The path flattened into a polyline: cumulative length and height of each point.
  // Computed here in plain arithmetic: sampling the SVG path through the DOM
  // (getPointAtLength) blocked the main thread for half a second on a phone.
  let lens: number[] = [];
  let ys: number[] = [];
  let lastKey = '';
  let pinY: number[] = [];
  let pinLen: number[] = [];
  let hostTop = 0;
  let queued = false;
  let ready = false;
  let plugged = false;
  let armChecked = false;

  // Latched: once the thread is plugged in, it stays so for the rest of the visit.
  const plug = () => {
    if (!endEl || plugged) return;
    plugged = true;
    // The knot and the words are only drawn if they were waiting, undrawn.
    endEl.classList.toggle('is-landing', endEl.classList.contains('is-armed'));
    endEl.classList.remove('is-armed');
    endEl.classList.add('is-plugged');
  };
  // Decided once, at the first measure. Armed if the knot and the words are still entirely
  // below the screen, or if the thread is already whole (a reload at the foot of the page): it
  // then plugs in the same frame, so they are drawn at once. If they already show, with the
  // thread not there yet, they are never hidden: they simply stay drawn.
  const arm = (whole: boolean) => {
    if (!endEl || armChecked) return;
    armChecked = true;
    if (still || plugged) return;
    const note = endEl.querySelector<HTMLElement>('.thread-end__art') ?? endEl;
    if (whole || note.getBoundingClientRect().top >= window.innerHeight) endEl.classList.add('is-armed');
  };

  function build() {
    const box = host.getBoundingClientRect();
    hostTop = box.top + window.scrollY;
    // The SVG covers the host through CSS (inset: 0) and its viewBox has the same size in
    // pixels. offsetHeight, not scrollHeight: the SVG itself must never make the host taller.
    const w = host.clientWidth;
    const h = host.offsetHeight;
    svg!.setAttribute('viewBox', `0 0 ${w} ${h}`);

    // Layout positions, not the screen ones: an entrance animation may still be moving a pin.
    const at0 = layoutOrigin(host);
    const pts = pins.map((p) => {
      const o = layoutOrigin(p);
      return { x: o.x - at0.x + p.offsetWidth / 2, y: o.y - at0.y + p.offsetHeight / 2 };
    });
    pinY = pts.map((p) => p.y);
    if (pts.length === 0) return;
    // Where the thread ties its knot, at the end of the one-page (none on a detailed page).
    let tie: P | undefined;
    if (endPin) {
      const o = layoutOrigin(endPin);
      tie = { x: o.x - at0.x + endPin.offsetWidth / 2, y: o.y - at0.y + endPin.offsetHeight / 2 };
    }
    // Nothing moved (fonts, images or a resize that changed nothing): keep the thread as it is.
    const key = `${w}x${h}|${[...pts, ...(tie ? [tie] : [])].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}`;
    if (key === lastKey) return;
    lastKey = key;

    const narrow = window.innerWidth < 1024;
    // The one-page ends on its knot (or a little below pin 08 if there is none); a detailed
    // page, at the foot of its content.
    const end = tie ? tie.y : pts.length > 1 ? Math.min(h - 40, pts[pts.length - 1].y + 260) : h - 48;
    const out = withLoops(looseThread(pts, pins, end, narrow, tie), tie ? [...pts, tie] : pts, end);
    if (out.length < 2) return;
    // Never outside the page (the margin is narrow on a laptop or a phone).
    for (const p of out) p.x = Math.min(w - 6, Math.max(6, p.x));

    const segs = curves(out);
    path!.setAttribute('d', toPath(segs));
    ({ lens, ys } = flatten(segs));
    // One DOM measure only, to match the dash length to the length the browser draws.
    total = path!.getTotalLength();
    const scale = total / (lens[lens.length - 1] || 1);
    lens = lens.map((l) => l * scale);
    pinLen = pinY.map(lengthAt);
    path!.style.strokeDasharray = `${total} ${total}`;
    host.classList.add('has-thread');
    ready = true;
    update();
  }

  /** Length of path drawn when its tip reaches height y (the path goes down, wobbles aside). */
  function lengthAt(y: number): number {
    let lo = 0;
    let hi = ys.length - 1;
    if (y >= ys[hi]) return total;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ys[mid] < y) lo = mid + 1;
      else hi = mid;
    }
    return Math.min(total, lens[lo]);
  }

  function update() {
    queued = false;
    if (!ready) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    // At the very bottom of the page the whole thread is shown, whatever its loose end.
    const tip = window.scrollY >= max - 2 ? Infinity : window.scrollY + window.innerHeight * TIP - hostTop;
    const drawn = still ? total : tip === Infinity ? total : lengthAt(tip);
    path!.style.strokeDashoffset = String(total - drawn);
    // The whole thread is drawn: it ties its knot (same tolerance as the pins).
    if (endEl) {
      arm(drawn >= total - 1);
      if (!plugged && drawn >= total - 1) plug();
    }

    let current = -1;
    pins.forEach((pin, i) => {
      const reached = still || pinLen[i] <= drawn + 1;
      if (reached) current = i;
      const waiting = pin.classList.contains('is-wait');
      if (reached && waiting) {
        pin.classList.remove('is-wait');
        pin.classList.add('is-hit');
        pin.addEventListener('animationend', () => pin.classList.remove('is-hit'), { once: true });
      } else if (!reached && !waiting) {
        pin.classList.add('is-wait');
      }
    });
    toc.forEach((a, i) => {
      a.classList.toggle('is-lit', i <= current);
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  let rebuild = 0;
  const later = () => {
    cancelAnimationFrame(rebuild);
    rebuild = requestAnimationFrame(build);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', later);
  // Fonts and images change the height of the page after the first layout. The first measure
  // waits until the browser is idle: it reads the layout of the whole page.
  const observe = () => {
    new ResizeObserver(later).observe(host);
    document.fonts?.ready.then(later);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(observe, { timeout: 1000 });
  else setTimeout(observe, 200);
  window.addEventListener('load', later, { once: true });
  // A printed page shows the whole thread, as without JavaScript.
  window.addEventListener('beforeprint', () => {
    path!.style.strokeDashoffset = '0';
    pins.forEach((p) => p.classList.remove('is-wait'));
    plug();
  });
}

type P = { x: number; y: number };
type Seg = [P, P, P, P];

/** Position of an element in the page layout, transforms left out. */
function layoutOrigin(el: HTMLElement): P {
  let x = 0;
  let y = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  return { x, y };
}

/**
 * Pin to pin, then to the knot (or the loose end). Between two pins the thread swings into the left margin
 * with a sine arch and wobbles a little; the wobble comes from a fixed sequence, so the thread
 * keeps its shape on every visit. A single pin (a detailed page): the thread leaves it by its
 * left side and runs down the margin to the foot of the page.
 */
function looseThread(pts: P[], pins: HTMLElement[], end: number, narrow: boolean, tie?: P): P[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  const wob = narrow ? 2.5 : 10;
  if (pts.length === 1) {
    const c = pts[0];
    // Hooked on the left side of the pin (the pin hides the start), out into the margin.
    const hook = { x: c.x - pins[0].offsetWidth / 2 - 2, y: c.y + 8 };
    const swing = Math.min(SWING, Math.max(0, hook.x - (narrow ? 8 : 18)));
    const out: P[] = [c, hook];
    const n = Math.max(1, Math.round((end - c.y) / STEP));
    for (let k = 0; k < n; k++) {
      const y = c.y + STEP / 2 + ((end - c.y - STEP / 2) * k) / n;
      out.push({ x: hook.x - swing + rand() * wob, y });
    }
    out.push({ x: hook.x - swing, y: end });
    return out;
  }
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    out.push(a);
    // After the last chapter pin: the knot, or the loose end below it.
    const b = pts[i + 1] ?? tie ?? { x: a.x, y: end };
    const swing = narrow ? 0 : Math.min(SWING, Math.max(0, a.x - 18));
    const n = Math.max(1, Math.round((b.y - a.y) / STEP));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      // Out into the margin and back: a sine arch, plus the wobble.
      const arch = Math.sin(f * Math.PI);
      out.push({ x: a.x + (b.x - a.x) * f - swing * arch + rand() * wob * arch, y: a.y + (b.y - a.y) * f });
    }
    if (!pts[i + 1]) out.push(b); // the knot, or the loose end
  }
  return out;
}

/**
 * A few round loops, where the string runs alone in a wide margin: in every other long stretch
 * between two pins of the one-page (three at most), once down a long detailed page. The thread
 * is sampled densely, then each loop replaces a short piece of it. A loop is a prolate cycloid
 * along the thread: it leaves and joins the thread with the same tangent, so it never breaks.
 */
function withLoops(sparse: P[], pins: P[], end: number): P[] {
  // Dense samples of the smooth thread, about every 35 px.
  const dense: P[] = [sparse[0]];
  for (const [a, b, c, d] of curves(sparse)) {
    for (let k = 1; k <= 8; k++) dense.push(bezier(a, b, c, d, k / 8));
  }

  const spots: number[] = [];
  if (pins.length > 1) {
    let long = 0;
    for (let i = 0; i < pins.length - 1 && spots.length < 3; i++) {
      const span = pins[i + 1].y - pins[i].y;
      if (span < 1100) continue;
      // The middle of the stretch, where the arch is widest.
      if (long++ % 2 === 0) spots.push(pins[i].y + span * 0.5);
    }
  } else if (end - pins[0].y > 1800) {
    spots.push(pins[0].y + (end - pins[0].y) * 0.42);
  }

  const run = 2 * Math.PI * LOOP_C; // height the thread runs down while it loops
  let out = dense;
  for (const y0 of spots) {
    const i = out.findIndex((p) => p.y >= y0);
    if (i < 1) continue;
    const xAt = (y: number) => {
      const j = Math.max(1, out.findIndex((p) => p.y >= y));
      const p = out[j - 1];
      const q = out[j] ?? p;
      return q.y === p.y ? p.x : p.x + ((q.x - p.x) * (y - p.y)) / (q.y - p.y);
    };
    // Only where the whole loop fits in the margin, never against the edge of the screen.
    if (xAt(y0) - 2 * LOOP_X < 14) continue;
    const loop: P[] = [];
    for (let k = 0; k <= 28; k++) {
      const t = -Math.PI + (2 * Math.PI * k) / 28;
      const u = y0 + LOOP_C * (t + Math.PI) - LOOP_Y * Math.sin(t);
      loop.push({ x: xAt(u) - LOOP_X * (1 + Math.cos(t)), y: u });
    }
    const after = out.findIndex((p) => p.y > y0 + run);
    if (after < 0) continue;
    out = [...out.slice(0, i), ...loop, ...out.slice(after)];
  }
  return out;
}

function bezier(a: P, b: P, c: P, d: P, t: number): P {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** Catmull-Rom through the points, as cubic Bézier curves: a smooth, string-like line. */
function curves(p: P[]): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    segs.push([
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ]);
  }
  return segs;
}

function toPath(segs: Seg[]): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(segs[0][0].x)},${f(segs[0][0].y)}`;
  for (const [, c1, c2, e] of segs) d += ` C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(e.x)},${f(e.y)}`;
  return d;
}

/** Cumulative length and height along the curves, 16 points per curve. */
function flatten(segs: Seg[]): { lens: number[]; ys: number[] } {
  const lens = [0];
  const ys = [segs[0][0].y];
  let prev = segs[0][0];
  let acc = 0;
  for (const [a, b, c, d] of segs) {
    for (let k = 1; k <= 16; k++) {
      const { x, y } = bezier(a, b, c, d, k / 16);
      acc += Math.hypot(x - prev.x, y - prev.y);
      lens.push(acc);
      // Kept increasing, so the search by height stays valid where the curve wobbles back up.
      ys.push(Math.max(y, ys[ys.length - 1]));
      prev = { x, y };
    }
  }
  return { lens, ys };
}
