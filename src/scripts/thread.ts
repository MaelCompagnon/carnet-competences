// The thread of the one-page: a burgundy string, as on a cork board, from one chapter number
// (the "pins") to the next. No library: it must also be drawn with "reduce motion", where
// GSAP and Lenis are never loaded. Without JavaScript, a straight CSS line stands in for it.
//
// With motion allowed, the thread is drawn as the reader scrolls, and each pin bounces then
// fills when the tip of the thread reaches it. The path is computed from the real position of
// the pins, and computed again whenever the page changes size (fonts, images, resize).

const TIP = 0.62; // the tip of the thread sits at 62 % of the screen height
const STEP = 280; // one wobble point every 280 px between two pins

export function initThread(host: HTMLElement) {
  const svg = host.querySelector<SVGSVGElement>('svg.thread');
  const path = svg?.querySelector<SVGPathElement>('path');
  const pins = [...host.querySelectorAll<HTMLElement>('[data-pin]')];
  const toc = [...host.querySelectorAll<HTMLAnchorElement>('[data-toc]')];
  if (!svg || !path || pins.length < 2) return;

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

    const pts = pins.map((p) => {
      const r = p.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    pinY = pts.map((p) => p.y);
    const narrow = window.innerWidth < 1024;
    // Nothing moved (fonts, images or a resize that changed nothing): keep the thread as it is.
    const key = `${w}x${h}|${pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}`;
    if (key === lastKey) return;
    lastKey = key;

    // A loose thread: between two pins it swings into the left margin and wobbles a little.
    // The wobble comes from a fixed sequence, so the thread keeps its shape on every visit.
    const out: { x: number; y: number }[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      out.push(a);
      const b = pts[i + 1] ?? { x: a.x, y: Math.min(h - 40, a.y + 260) };
      const swing = narrow ? 0 : Math.min(64, Math.max(0, a.x - 18));
      const n = Math.max(1, Math.round((b.y - a.y) / STEP));
      for (let k = 1; k < n; k++) {
        const f = k / n;
        // Out into the margin and back: a sine arch, plus the wobble.
        const arch = Math.sin(f * Math.PI);
        const x = a.x + (b.x - a.x) * f - swing * arch + rand() * (narrow ? 2.5 : 10) * arch;
        out.push({ x, y: a.y + (b.y - a.y) * f });
      }
      if (!pts[i + 1]) out.push(b); // the loose end, below the last pin
    }

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
  // Fonts and images change the height of the page after the first layout.
  new ResizeObserver(later).observe(host);
  document.fonts?.ready.then(later);
  window.addEventListener('load', later, { once: true });
  // A printed page shows the whole thread, as without JavaScript.
  window.addEventListener('beforeprint', () => {
    path!.style.strokeDashoffset = '0';
    pins.forEach((p) => p.classList.remove('is-wait'));
  });
  build();
}

type P = { x: number; y: number };
type Seg = [P, P, P, P];

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
