// The thread: a burgundy string, as on a cork board, from one chapter number (the "pins") to
// the next, on the one-page and down every detailed page. No library: it must also be drawn
// with "reduce motion", where GSAP and Lenis are never loaded, and the detailed pages have no
// GSAP at all (Lighthouse). Without JavaScript, a straight CSS line stands in for it.
//
// The line stays soft: between two pins it glides out into the left margin with a long, smooth
// curve, runs down with a slow, ample wave, and glides back to the next pin. No random wobble,
// no hook: one smooth function, sampled densely. On a phone it runs straight down the margin.
//
// With motion allowed, the thread is drawn as the reader scrolls, and each pin bounces then
// fills when the tip of the thread reaches it. The path is computed from the real position of
// the pins, and computed again whenever the page changes size (fonts, images, resize).

const TIP = 0.62; // the tip of the thread sits at 62 % of the screen height
const STEP = 60; // one point every 60 px: the curve is a smooth function, sampled finely
const GLIDE = 360; // height over which the thread leaves a pin for the margin, and comes back
const WAVE = 1500; // period of the slow wave along the margin, in px

export function initThread(host: HTMLElement) {
  const svg = host.querySelector<SVGSVGElement>('svg.thread');
  const path = svg?.querySelector<SVGPathElement>('path');
  const pins = [...host.querySelectorAll<HTMLElement>('[data-pin]')];
  const toc = [...host.querySelectorAll<HTMLAnchorElement>('[data-toc]')];
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
    // Nothing moved (fonts, images or a resize that changed nothing): keep the thread as it is.
    const key = `${w}x${h}|${pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}`;
    if (key === lastKey) return;
    lastKey = key;

    const narrow = window.innerWidth < 1024;
    // The one-page ends a little below its last pin; a detailed page, at the foot of its content.
    const end = pts.length > 1 ? Math.min(h - 40, pts[pts.length - 1].y + 260) : h - 48;
    // The thread hooks onto the left side of each pin, so that it never runs across a title.
    // On a phone, the pins of the one-page stand in the margin: there it goes through them.
    const column = pts.length > 1 && pts.every((p) => Math.abs(p.x - pts[0].x) < 4);
    const hooks = narrow && column ? pts : pts.map((p, i) => ({ x: p.x - pins[i].offsetWidth / 2, y: p.y }));
    const out = softThread(hooks, end, narrow && column);
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

/** Eases from 0 to 1 and back with no corner (a smootherstep at each end). */
function ease(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * Pin to pin, then to the loose end. Between two pins the thread glides out to a lane in the
 * margin, follows it with a slow wave, and glides back: every turn is a long, soft curve.
 */
function softThread(pins: P[], end: number, straight: boolean): P[] {
  const first = pins[0];
  // How far into the margin it goes: up to 60 px, never closer than 8 px to the edge.
  const depth = straight ? 0 : Math.min(60, Math.max(0, first.x - 8));
  const wave = Math.min(16, depth * 0.28);

  const stops: P[] = [...pins, { x: first.x, y: end }];
  const out: P[] = [first];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const span = b.y - a.y;
    if (span <= 0) continue;
    const loose = i === stops.length - 2;
    const glide = Math.min(GLIDE, span / 2);
    // It leaves a pin a little faster than it reaches the next one: the title beside the pin stays clear.
    const leave = Math.min(GLIDE / 2, span / 2);
    const n = Math.max(4, Math.ceil(span / STEP));
    for (let k = 1; k <= n; k++) {
      const y = a.y + (span * k) / n;
      const d = y - a.y;
      // Out from the pin, and back to the next one (the loose end stays out in the margin).
      const out1 = ease(d / leave);
      const back = loose ? 1 : ease((span - d) / glide);
      const away = out1 * back;
      const x = a.x + (b.x - a.x) * ease(d / span) - depth * away + wave * away * Math.sin((y / WAVE) * Math.PI * 2);
      out.push({ x, y });
    }
  }
  return out;
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
      const t = k / 16;
      const u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x;
      const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y;
      acc += Math.hypot(x - prev.x, y - prev.y);
      lens.push(acc);
      // Kept increasing, so the search by height stays valid where the curve wobbles back up.
      ys.push(Math.max(y, ys[ys.length - 1]));
      prev = { x, y };
    }
  }
  return { lens, ys };
}
