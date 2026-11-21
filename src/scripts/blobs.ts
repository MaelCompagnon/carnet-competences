// The background blobs (src/lib/blobs.ts) slowly change shape, drift a little, and step aside
// when the mouse comes close, then spring back. No library: the outline is recomputed for the
// blobs on screen only, and the offset uses the standalone translate property. Loaded by
// Base.astro, never with "reduce motion". The loop stops when no blob shows or the tab is hidden.
import { blobPath } from '../lib/blobs';

const REACH = 60; // px beyond the edge of a blob where the mouse still pushes it…
const PUSH = 22; // …by this much at most
const SPRING = 70; // 1/s²
const DAMPING = 9; // 1/s
const DRIFT = 6; // px of slow drift

interface Item {
  el: SVGSVGElement;
  path: SVGPathElement;
  phases: number[];
  speed: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
}

export function initBlobs() {
  const items: Item[] = [];
  document.querySelectorAll<SVGSVGElement>('[data-blob]').forEach((el) => {
    const path = el.querySelector('path');
    if (!path) return;
    items.push({
      el,
      path,
      phases: (el.dataset.phases ?? '').split(' ').map(Number),
      speed: Number(el.dataset.speed) || 0.3,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
    });
  });
  if (items.length === 0) return;

  let px = -1e4;
  let py = -1e4;
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
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    const list = [...shown];
    // Read every box first, then write: no layout thrashing.
    const boxes = list.map((it) => it.el.getBoundingClientRect());
    list.forEach((it, i) => {
      const r = boxes[i];
      // The blob itself fills about 1 / 1.4 of its box.
      const radius = r.width / 2.8;
      const cx = r.left + r.width / 2 - it.tx;
      const cy = r.top + r.height / 2 - it.ty;
      let gx = 0;
      let gy = 0;
      const dx = cx + it.ox - px;
      const dy = cy + it.oy - py;
      const d = Math.hypot(dx, dy);
      const reach = radius + REACH;
      if (d < reach && d > 1) {
        const k = PUSH * (1 - d / reach);
        gx = (dx / d) * k;
        gy = (dy / d) * k;
      }
      it.vx += (SPRING * (gx - it.ox) - DAMPING * it.vx) * dt;
      it.vy += (SPRING * (gy - it.oy) - DAMPING * it.vy) * dt;
      it.ox += it.vx * dt;
      it.oy += it.vy * dt;
      it.tx = DRIFT * Math.sin(t * 0.2 + it.phases[0]) + it.ox;
      it.ty = DRIFT * Math.cos(t * 0.17 + it.phases[1]) + it.oy;
      it.el.style.translate = `${it.tx.toFixed(1)}px ${it.ty.toFixed(1)}px`;
      it.path.setAttribute('d', blobPath(it.phases, it.speed, t));
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
