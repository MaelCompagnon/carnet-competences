// The thread: a burgundy string, as on a cork board, from one chapter number (the "pins") to
// the next, on the one-page and down every detailed page. No library: it must also be drawn
// with "reduce motion", where GSAP and Lenis are never loaded, and the detailed pages have no
// GSAP at all (Lighthouse). Without JavaScript, a straight CSS line stands in for it.
//
// On a wide screen the thread winds around the blocks of the page: it runs along one margin,
// crosses the page through the spaces between blocks (curling in the larger ones), and always
// comes back to the left margin to go through a pin. On a phone it stays in the left margin.
//
// With motion allowed, the thread is drawn as the reader scrolls, and each pin bounces then
// fills when the tip of the thread reaches it. The path is computed from the real position of
// the pins, and computed again whenever the page changes size (fonts, images, resize).

const TIP = 0.62; // the tip of the thread sits at 62 % of the screen height
const STEP = 280; // one wobble point every 280 px along a margin
const LANE = 30; // distance between the thread and the blocks it runs along
const MIN_GAP = 44; // the thread only crosses the page through a space at least this high
const LOOP_GAP = 96; // ... and only curls in a space at least this high

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
    const narrow = window.innerWidth < 1024;
    const rows = layoutRows(host, box);
    // Nothing moved (fonts, images or a resize that changed nothing): keep the thread as it is.
    const key = `${w}x${h}|${pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}|${rows.map((r) => `${Math.round(r.top)}-${Math.round(r.bottom)}`).join(' ')}`;
    if (key === lastKey) return;
    lastKey = key;
    if (rows.length === 0) return;

    // The wobble comes from a fixed sequence, so the thread keeps its shape on every visit.
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    const out = narrow ? marginThread(pts, rows, h, rand) : windingThread(pts, rows, h, maxRight(host, box, w), rand);
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
type Row = { top: number; bottom: number; left: number; right: number; pin?: P };

// Blocks the thread goes around. Inside a stop element (a paragraph, a card…) it never looks further.
const SKIP = '.thread, .toc, .sr-only, .skip, script, style, template, dialog, [hidden]';
const LOOSE = '.pin-spacer, [data-sheets].is-sideways';
const STOP =
  'p, h1, h2, h3, h4, h5, h6, ul, ol, dl, table, figure, img, picture, svg, a, button, blockquote, pre, form, details, .card, .postit, .polaroid, .badge, .btn, .pin-spacer, [data-sheets].is-sideways, [data-thread-solid]';

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
 * The page as a stack of rows: the blocks of the layout, merged when they sit side by side.
 * The spaces between two rows are where the thread may cross the page.
 * One read pass, no write. Positions come from the layout (offsetLeft / offsetTop), not from
 * getBoundingClientRect: the entrance animations start with blocks moved aside or below, and
 * the thread must follow where they land, not where they start.
 */
function layoutRows(host: HTMLElement, box: DOMRect): Row[] {
  const blocks: Row[] = [];
  const origin = layoutOrigin;
  const base = origin(host);
  const rectOf = (el: Element): Row | null => {
    if (el instanceof HTMLElement) {
      if (el.offsetWidth < 1 || el.offsetHeight < 1) return null;
      const o = origin(el);
      const left = o.x - base.x;
      const top = o.y - base.y;
      return { top, bottom: top + el.offsetHeight, left, right: left + el.offsetWidth };
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { top: r.top - box.top, bottom: r.bottom - box.top, left: r.left - box.left, right: r.right - box.left };
  };
  const union = (rs: Row[]): Row => ({
    top: Math.min(...rs.map((r) => r.top)),
    bottom: Math.max(...rs.map((r) => r.bottom)),
    left: Math.min(...rs.map((r) => r.left)),
    right: Math.max(...rs.map((r) => r.right)),
  });
  const visit = (el: Element, depth: number) => {
    const own = rectOf(el);
    if (!own) return;
    if (depth > 0 && el.matches(STOP)) {
      // The pinned experience sheets span the whole window (and slide sideways): only their
      // height counts, not their width.
      if (el.matches(LOOSE)) blocks.push({ ...own, left: Infinity, right: -Infinity });
      else blocks.push(own);
      return;
    }
    const kids: { el: Element; r: Row }[] = [];
    for (const k of el.children) {
      if (k.matches(SKIP) || getComputedStyle(k).position === 'fixed') continue;
      const r = rectOf(k);
      if (r) kids.push({ el: k, r });
    }
    if (kids.length === 0) {
      if (depth > 0) blocks.push(own);
      return;
    }
    // Blocks side by side (a grid, a photo beside a text) make one block: the thread goes around it.
    const rs = kids.map((k) => k.r).sort((a, b) => a.top - b.top);
    const sideBySide = rs.some((a, i) => rs.slice(i + 1).some((b) => b.top < a.bottom - 4 && a.top < b.bottom - 4));
    // The padding of a container is free space: only its children count.
    if (sideBySide && depth > 0) blocks.push(union(rs));
    else kids.forEach((k) => visit(k.el, depth + 1));
  };
  visit(host, 0);

  blocks.sort((a, b) => a.top - b.top);
  const rows: Row[] = [];
  for (const b of blocks) {
    const last = rows[rows.length - 1];
    if (last && b.top < last.bottom + 6) {
      last.bottom = Math.max(last.bottom, b.bottom);
      last.left = Math.min(last.left, b.left);
      last.right = Math.max(last.right, b.right);
    } else rows.push({ ...b });
  }
  // A row made of loose blocks only takes the width of the text around it.
  const sized = rows.filter((r) => Number.isFinite(r.left));
  const left = sized.length ? Math.min(...sized.map((r) => r.left)) : 0;
  const right = sized.length ? Math.max(...sized.map((r) => r.right)) : box.width;
  for (const r of rows) {
    if (!Number.isFinite(r.left)) r.left = left;
    if (!Number.isFinite(r.right)) r.right = right;
  }
  return rows;
}

/** The thread stays clear of the table of contents fixed on the right of the one-page. */
function maxRight(host: HTMLElement, box: DOMRect, w: number): number {
  const toc = host.querySelector<HTMLElement>('.toc');
  if (toc && getComputedStyle(toc).position === 'fixed') {
    const r = toc.getBoundingClientRect();
    if (r.width > 0) return Math.min(w - 14, r.left - box.left - 18);
  }
  return w - 14;
}

/** Phones: down the left margin, through the pins (on the one-page they sit in that margin). */
function marginThread(pins: P[], rows: Row[], h: number, rand: () => number): P[] {
  const contentLeft = Math.min(...rows.map((r) => r.left));
  // One-page: the pins stand in a column in the margin, and the thread runs through them.
  const column = pins.length > 1 && pins.every((p) => Math.abs(p.x - pins[0].x) < 4);
  const lane = column ? pins[0].x : Math.max(6, contentLeft / 2);
  const end = Math.min(h - 16, Math.max(rows[rows.length - 1].bottom + 30, (pins[pins.length - 1]?.y ?? 0) + 260));
  const stops: P[] = [...pins.slice(1), { x: lane, y: end }];
  const out: P[] = [];
  let at: P = pins[0] ?? { x: lane, y: rows[0].top };
  out.push(at);
  for (const target of stops) {
    if (target.y <= at.y) continue;
    // A pin inside the text column: the thread leaves it for the margin, and comes back to the next one.
    let y = at.y;
    if (Math.abs(at.x - lane) > 4) out.push({ x: lane, y: (y = at.y + 30) });
    const yEnd = Math.abs(target.x - lane) > 4 ? target.y - 30 : target.y;
    const n = Math.max(1, Math.round((yEnd - y) / STEP));
    for (let k = 1; k < n; k++) out.push({ x: lane + rand() * 2.5, y: y + ((yEnd - y) * k) / n });
    if (yEnd !== target.y) out.push({ x: lane, y: yEnd });
    out.push(target);
    at = target;
  }
  return out;
}

/** Wide screens: around the blocks, across the page through the spaces between them. */
function windingThread(pins: P[], rows: Row[], h: number, maxR: number, rand: () => number): P[] {
  const contentLeft = Math.min(...rows.map((r) => r.left));
  const contentRight = Math.max(...rows.map((r) => r.right));
  const laneL = (r: Row) => Math.max(10, Math.min(r.left, contentLeft + 40) - LANE);
  // On the right it hugs the wide blocks, and keeps a calm line beside the narrow ones.
  const laneR = (r: Row) => Math.max(r.right, contentRight - 80) + LANE;
  // Room for the swing of the thread (about 20 px) as well.
  const fitsRight = (r: Row) => !r.pin && laneR(r) + 22 <= maxR;
  for (const r of rows) r.pin = pins.find((p) => p.y >= r.top - 2 && p.y <= r.bottom + 2);
  // A crossing after about three quarters of a screen on the same side.
  const crossRun = Math.max(420, window.innerHeight * 0.75);

  const out: P[] = [];
  const push = (p: P) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) out.push(p);
  };
  let side: 'L' | 'R' = 'L';
  let run = 0;
  let crossings = 0;
  const laneOf = (r: Row) => (side === 'L' ? laneL(r) : laneR(r));
  const outward = () => (side === 'L' ? -1 : 1);

  let first = pins[0] ? rows.findIndex((r) => r.pin === pins[0]) : 0;
  if (first < 0) first = 0;
  for (let i = first; i < rows.length; i++) {
    const r = rows[i];
    if (r.pin && side === 'L') {
      // Hooked on the pin, then back to the margin.
      const pin = r.pin;
      if (out.length) push({ x: laneL(r) - 6, y: pin.y - 34 });
      push(pin);
      push({ x: laneL(r), y: Math.max(pin.y + 34, r.bottom) });
    } else {
      const x = laneOf(r);
      const n = Math.max(1, Math.round((r.bottom - r.top) / STEP));
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        push({ x: x + outward() * Math.sin(f * Math.PI) * 16 + rand() * 5, y: r.top + (r.bottom - r.top) * f });
      }
    }
    run += r.bottom - r.top;
    const next = rows[i + 1];
    if (!next) break;
    const gap = next.top - r.bottom;
    const mustLeft = side === 'R' && !fitsRight(next);
    const wants = run >= crossRun && gap >= MIN_GAP && (side === 'R' || fitsRight(next));
    if (mustLeft || wants) {
      const x0 = laneOf(r);
      side = side === 'L' ? 'R' : 'L';
      const x1 = laneOf(next);
      cross(out, x0, x1, r.bottom, next.top, gap >= LOOP_GAP && crossings % 2 === 0, rand);
      crossings++;
      run = 0;
    } else if (gap > 24) {
      // Along a margin, the thread swings out a little in each space.
      push({ x: (laneOf(r) + laneOf(next)) / 2 + outward() * (10 + rand() * 6), y: (r.bottom + next.top) / 2 });
    }
  }
  const last = rows[rows.length - 1];
  push({ x: laneOf(last) + outward() * 8, y: Math.min(h - 16, last.bottom + 50) });
  return out;
}

/** From one margin to the other through the space between two rows, with a curl in the large ones. */
function cross(out: P[], x0: number, x1: number, top: number, bottom: number, curl: boolean, rand: () => number) {
  const gap = bottom - top;
  const dir = Math.sign(x1 - x0) || 1;
  // Rounded turns: the thread leaves the margin and reaches the other one at a slant.
  const turn = Math.min(48, Math.abs(x1 - x0) * 0.08);
  const ya = top + gap * 0.38;
  const yb = bottom - gap * 0.38;
  out.push({ x: x0 + dir * turn, y: ya });
  if (curl) {
    const r = Math.min(24, gap / 2 - 16);
    const cx = x0 + (x1 - x0) * (0.4 + rand() * 0.15);
    const cy = (ya + yb) / 2 + r * 0.4;
    out.push({ x: cx - dir * r * 2.4, y: cy });
    // Once around a circle that sits on the line: up the far side, over the top, down the near side.
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI / 2 - (dir * ((k + 0.5) * Math.PI * 2)) / 7;
      out.push({ x: cx + dir * r * 0.3 + r * Math.cos(a), y: cy - r + r * Math.sin(a) });
    }
    out.push({ x: cx + dir * r * 2.6, y: cy + 2 });
  } else {
    out.push({ x: (x0 + x1) / 2 + rand() * 30, y: (ya + yb) / 2 + Math.min(8, gap * 0.12) });
  }
  out.push({ x: x1 - dir * turn, y: yb });
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
