// Glides of the one-page (GSAP). Loaded by motion.ts only on the one-page, and never with
// "reduce motion" (motion.ts itself is not loaded then). The analysis pages never fetch GSAP:
// it cost them Lighthouse points in the first version.
//
// Rule kept from the first version: nothing is hidden by the stylesheet. Start states are set
// here, and only for elements still below the screen. Elements already on screen at load only
// "settle" (a small move, never hidden). A jump (End key, anchor, reload mid-page) shows at once
// everything it skipped.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

interface Item {
  el: HTMLElement;
  play: (instant: boolean) => void;
}

export function initOnePage(lenis?: Lenis) {
  const host = document.querySelector<HTMLElement>('[data-onepage]');
  if (!host) return;
  gsap.registerPlugin(ScrollTrigger);
  if (lenis) lenis.on('scroll', ScrollTrigger.update);
  const sliding = sheetsSideways(host);
  const vh = window.innerHeight;
  // Only elements entirely below the screen get a start state; anything that shows, even a
  // few pixels at the bottom edge, plays at once (a block must never sit there invisible).
  const below = (el: Element) => el.getBoundingClientRect().top >= vh;
  const pending: Item[] = [];
  const add = (el: HTMLElement, play: Item['play']) => pending.push({ el, play });
  const tilt = (el: HTMLElement) => parseFloat(getComputedStyle(el).getPropertyValue('--r')) || 0;

  // Post-its come in from the side and land with their own small tilt.
  host.querySelectorAll<HTMLElement>('[data-postit]').forEach((el, i) => {
    const r = tilt(el);
    const side = i % 2 === 0 ? -1 : 1;
    if (!below(el)) {
      gsap.from(el, { rotation: r - 4 * side, y: -10, duration: 0.9, delay: 0.25 + i * 0.08, ease: 'back.out(2)', clearProps: 'transform' });
      return;
    }
    gsap.set(el, { x: 90 * side, rotation: -6, opacity: 0 });
    add(el, (instant) =>
      gsap.to(el, { x: 0, rotation: r, opacity: 1, duration: instant ? 0 : 0.95, ease: 'back.out(1.5)', clearProps: 'transform,opacity' }),
    );
  });

  // The polaroid comes down and settles under its tape.
  host.querySelectorAll<HTMLElement>('[data-polaroid]').forEach((el) => {
    const r = tilt(el);
    if (!below(el)) {
      gsap.from(el, { y: -26, rotation: r - 5, duration: 1.1, ease: 'elastic.out(1, 0.55)', clearProps: 'transform' });
      return;
    }
    gsap.set(el, { y: -60, rotation: r - 6, opacity: 0 });
    add(el, (instant) =>
      gsap.to(el, { y: 0, rotation: r, opacity: 1, duration: instant ? 0 : 1.1, ease: 'elastic.out(1, 0.6)', clearProps: 'transform,opacity' }),
    );
  });

  // Cards rise (and so do the experience sheets when they are stacked).
  const cards = [...host.querySelectorAll<HTMLElement>('[data-card]')];
  if (!sliding) cards.push(...host.querySelectorAll<HTMLElement>('[data-sheet]'));
  cards.forEach((el) => {
    if (!below(el)) return;
    gsap.set(el, { y: 40, opacity: 0 });
    add(el, (instant) => gsap.to(el, { y: 0, opacity: 1, duration: instant ? 0 : 0.7, ease: 'power3.out', clearProps: 'transform,opacity' }));
  });

  // Handwritten notes are written from left to right.
  host.querySelectorAll<HTMLElement>('[data-write]').forEach((el) => {
    if (!below(el)) return;
    gsap.set(el, { clipPath: 'inset(0 100% 0 0)' });
    add(el, (instant) => gsap.to(el, { clipPath: 'inset(0 0% 0 0)', duration: instant ? 0 : 0.9, ease: 'power2.inOut', clearProps: 'clipPath' }));
  });

  // The highlighter sweeps the key words. Decorative only, so words on screen sweep too.
  host.querySelectorAll<HTMLElement>('[data-hl]').forEach((el, i) => {
    gsap.set(el, { backgroundSize: '0% 100%' });
    const play = (instant: boolean) =>
      gsap.to(el, { backgroundSize: '100% 100%', duration: instant ? 0 : 0.7, delay: instant ? 0 : 0.15, ease: 'power2.out', clearProps: 'backgroundSize' });
    if (below(el)) add(el, play);
    else gsap.delayedCall(0.5 + i * 0.18, () => play(false));
  });

  // Key figures run up to their exact value ("862 076", "862,076", "~50").
  host.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    if (!below(el)) return;
    const final = el.textContent?.trim() ?? '';
    // \s also covers the no-break spaces used as thousands separators in French.
    const m = final.match(/^(\D*)(\d(?:[\d\s.,]*\d)?)(\D*)$/);
    if (!m) return;
    const [, before, digits, after] = m;
    const sep = digits.match(/\D/)?.[0] ?? '';
    const target = Number(digits.replace(/\D/g, ''));
    const format = (n: number) => before + (sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n)) + after;
    el.textContent = format(0);
    const state = { v: 0 };
    add(el, (instant) =>
      gsap.to(state, {
        v: target,
        duration: instant ? 0 : 1.6,
        ease: 'power2.out',
        onUpdate: () => (el.textContent = format(Math.round(state.v))),
        // End on the exact source string, whatever the rounding did.
        onComplete: () => (el.textContent = final),
      }),
    );
  });

  if (pending.length === 0) return;

  // One read pass per frame: everything that entered the screen plays, in a short cascade.
  // Anything the reader jumped past (above the screen) is shown at once, without animation.
  let queued = false;
  const check = () => {
    queued = false;
    const line = window.innerHeight;
    const due = pending.filter((it) => it.el.getBoundingClientRect().top < line);
    if (due.length === 0) return;
    let k = 0;
    for (const it of due) {
      pending.splice(pending.indexOf(it), 1);
      const skipped = it.el.getBoundingClientRect().bottom < 0;
      if (skipped) it.play(true);
      else gsap.delayedCall(k++ * 0.08, () => it.play(false));
    }
    if (pending.length === 0) window.removeEventListener('scroll', schedule);
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(check);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  check();

  // A printed page must be complete, with the real figures.
  window.addEventListener('beforeprint', () => {
    pending.splice(0).forEach((it) => it.play(true));
    gsap.globalTimeline.getChildren(true, true, false).forEach((t) => t.progress(1));
  });
}

/**
 * Chapter 03 on wide screens: the section is pinned and the three sheets slide sideways while
 * the reader keeps scrolling down. Only from 1024 px, and only when a sheet fits in the screen
 * height; otherwise the sheets stay stacked (the layout of phones, of reduced motion and of a
 * page without script).
 */
function sheetsSideways(host: HTMLElement): boolean {
  const box = host.querySelector<HTMLElement>('[data-sheets]');
  const track = box?.querySelector<HTMLElement>('.sheets__track');
  if (!box || !track) return false;
  let active = false;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px)', () => {
    box.classList.add('is-sideways');
    if (track.offsetHeight > window.innerHeight - 40) {
      box.classList.remove('is-sideways');
      return;
    }
    active = true;
    const distance = () => Math.max(0, track.scrollWidth - box.clientWidth);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: box,
        // Centred vertically in the screen while it is pinned.
        start: () => 'top ' + Math.max(0, (window.innerHeight - track.offsetHeight) / 2) + 'px',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'transform' });
      box.classList.remove('is-sideways');
    };
  });
  // Late fonts change the height of the page: the pinned distance must follow.
  // (ScrollTrigger refreshes on its own at "load" and on resize.)
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  return active;
}
