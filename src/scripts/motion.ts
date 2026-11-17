// Smooth scrolling and scroll reveals (SPEC §5), on every page. Loaded only when the visitor
// has not asked for reduced motion. Rule: nothing is ever hidden by the stylesheet alone.
// Start states are set here, and only for elements still below the screen, so a page without
// this script is complete.
//
// Kept light on purpose: the analysis pages must stay above 90 on Lighthouse mobile, so GSAP
// is not loaded here. Only the one-page fetches it (onepage-fx.ts).
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function initMotion() {
  const lenis = new Lenis({ autoRaf: true });

  // "Back to top" glides; focus goes back to the top too, as the plain link would do.
  document.querySelectorAll<HTMLAnchorElement>('a[href="#top"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(0);
      document.querySelector<HTMLElement>('.skip')?.focus({ preventScroll: true });
    }),
  );

  // The document viewer (DocGallery.astro) is a modal: the page behind it must not scroll.
  document.addEventListener('viewer:toggle', (e) => ((e as CustomEvent<boolean>).detail ? lenis.stop() : lenis.start()));

  reveals();
  timelines();

  // GSAP is fetched by the one-page only (its own module, so no other page downloads it).
  if (document.querySelector('[data-onepage]')) {
    import('./onepage-fx').then((m) => m.initOnePage(lenis)).catch(() => {});
  }
}

function reveals() {
  const all = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  // One read pass, then one write pass: no layout thrashing.
  const limit = window.innerHeight;
  const waiting = all.filter((el) => el.getBoundingClientRect().top > limit);
  if (waiting.length === 0) return;
  // Opacity only, never visibility: a link inside must stay reachable with Tab,
  // and focusing it scrolls it into view, which reveals it.
  waiting.forEach((el) => el.classList.add('reveal-wait'));

  const show = (el: HTMLElement, delay: number) => {
    observer.unobserve(el);
    waiting.splice(waiting.indexOf(el), 1);
    el.style.transitionDelay = `${delay}ms`;
    el.classList.add('reveal-in');
    el.classList.remove('reveal-wait');
    el.addEventListener(
      'transitionend',
      () => {
        el.classList.remove('reveal-in');
        el.style.transitionDelay = '';
      },
      { once: true },
    );
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      if (entering.length === 0) return;
      // A jump (End key, anchor, reload) can skip elements without ever crossing them:
      // everything that now sits above the newcomers is shown at once, without delay.
      const first = Math.min(...entering.map((el) => waiting.indexOf(el)).filter((i) => i >= 0));
      waiting.slice(0, first).forEach((el) => show(el, 0));
      entering.forEach((el, i) => waiting.includes(el) && show(el, i * 70));
    },
    { rootMargin: '0px' },
  );
  waiting.forEach((el) => observer.observe(el));
}

// The timeline of "Qui je suis": the accent line is drawn, and the dots light up, as the
// reader goes down the path. A few measurements per frame are enough: no library needed.
function timelines() {
  const lists = [...document.querySelectorAll<HTMLElement>('.timeline')];
  if (lists.length === 0) return;
  lists.forEach((list) => list.classList.add('is-animated'));
  let queued = false;

  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    for (const list of lists) {
      const box = list.getBoundingClientRect();
      // From "top of the list at 70 % of the screen" to "bottom of the list at 60 %".
      const progress = Math.min(1, Math.max(0, (vh * 0.7 - box.top) / (box.height + vh * 0.1)));
      const tops = [...list.children].map((li) => li.getBoundingClientRect().top);
      list.style.setProperty('--tl', progress.toFixed(4));
      [...list.children].forEach((li, i) => li.classList.toggle('is-reached', tops[i] < vh * 0.68));
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}
