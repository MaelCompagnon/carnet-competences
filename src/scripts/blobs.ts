// The background blobs (src/lib/blobs.ts) slowly change shape and drift a little. With a mouse,
// the edge it touches gives way, then wobbles back like jelly: each point of the outline is a
// small spring, tied to its neighbours. No library; only the blobs on screen are computed.
// Loaded by Base.astro, never with "reduce motion". The loop stops when no blob shows or the
// tab is hidden.
import { blobRadius, outline } from '../lib/blobs';

const DRIFT = 6; // px of slow drift
const PRESS = 900; // px/s²: how hard the mouse pushes the edge in…
const NEAR = 6; // …on a narrow arc around it (larger: narrower)…
const BAND = 0.5; // …when it is within this fraction of the radius from the edge
const SPRING = 140; // 1/s²: the edge comes back…
const DAMPING = 6; // 1/s: …overshoots and wobbles…
const NEIGHBOURS = 60; // 1/s²: …and the dent spreads along the edge

interface Item {
  el: SVGSVGElement;
  path: SVGPathElement;
  phases: number[];
  speed: number;
  /** Dent of each point of the edge, in px, and its speed. */
  off: number[];
  vel: number[];
  tx: number;
  ty: number;
}

export function initBlobs() {
  const items: Item[] = [];
  document.querySelectorAll<SVGSVGElement>('[data-blob]').forEach((el) => {
    const path = el.querySelector('path');
    const phases = (el.dataset.phases ?? '').split(' ').map(Number);
    if (!path || phases.length < 3) return;
    items.push({
      el,
      path,
      phases,
      speed: Number(el.dataset.speed) || 1,
      off: phases.map(() => 0),
      vel: phases.map(() => 0),
      tx: 0,
      ty: 0,
    });
  });
  if (items.length === 0) return;

  // The mouse, and how fast it goes (a quick pass dents deeper).
  let px = -1e4;
  let py = -1e4;
  let lastX = px;
  let lastY = py;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        px = e.clientX;
        py = e.clientY;
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => (px = py = -1e4));
  }

  const shown = new Set<Item>();
  let raf = 0;
  let last = 0;
  const t0 = performance.now();

  const frame = (now: number) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    const speed = px < -1e3 || lastX < -1e3 ? 0 : Math.hypot(px - lastX, py - lastY) / Math.max(dt, 0.001);
    lastX = px;
    lastY = py;
    const list = [...shown];
    // Read every box first, then write: no layout thrashing.
    const boxes = list.map((it) => it.el.getBoundingClientRect());
    list.forEach((it, i) => {
      const box = boxes[i];
      // The unit circle of the blob fills 1 / 1.4 of its box.
      const R = box.width / 2.8;
      const cx = box.left + box.width / 2 - it.tx;
      const cy = box.top + box.height / 2 - it.ty;
      const n = it.phases.length;
      const dm = Math.hypot(px - cx, py - cy);
      const ma = Math.atan2(py - cy, px - cx);
      const radii: number[] = [];
      for (let k = 0; k < n; k++) {
        const base = blobRadius(it.phases, it.speed, k, t);
        let force = 0;
        if (dm < R * 1.4) {
          const a = (k / n) * Math.PI * 2;
          const da = Math.atan2(Math.sin(a - ma), Math.cos(a - ma));
          const reach = Math.max(0, 1 - Math.abs(dm - R * base) / (R * BAND));
          force = -Math.exp(-da * da * NEAR) * reach * PRESS * (1 + speed / 2500);
        }
        const pull = (it.off[(k + 1) % n] + it.off[(k + n - 1) % n]) / 2 - it.off[k];
        it.vel[k] += (force - SPRING * it.off[k] - DAMPING * it.vel[k] + NEIGHBOURS * pull) * dt;
        radii.push(base);
      }
      for (let k = 0; k < n; k++) {
        it.off[k] += it.vel[k] * dt;
        // Never dented deeper than half the blob.
        radii[k] = Math.max(0.5, radii[k] + it.off[k] / R);
      }
      it.tx = DRIFT * Math.sin(t * 0.2 + it.phases[0]);
      it.ty = DRIFT * Math.cos(t * 0.17 + it.phases[1]);
      it.el.style.translate = `${it.tx.toFixed(1)}px ${it.ty.toFixed(1)}px`;
      it.path.setAttribute('d', outline(radii));
    });
    raf = shown.size > 0 && !document.hidden ? requestAnimationFrame(frame) : 0;
  };

  const start = () => {
    if (raf || shown.size === 0 || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const byEl = new Map<Element, Item>(items.map((it) => [it.el, it]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const it = byEl.get(en.target);
        if (!it) continue;
        if (en.isIntersecting) shown.add(it);
        else shown.delete(it);
      }
      start();
    },
    { rootMargin: '80px' },
  );
  items.forEach((it) => io.observe(it.el));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else start();
  });
}
