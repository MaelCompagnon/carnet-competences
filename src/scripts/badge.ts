// The badge of the About page: a card hanging from a cord, pinned to the board.
// Grab it, pull, let go: the cord pulls it back like a spring and it swings under gravity.
// A click, Enter or Space turns it over (a short sentence on the back).
//
// No library: a point on an elastic cord, integrated at a fixed step, and a card that turns
// to line up with the cord. The loop only runs while the badge moves.
// Without JavaScript both faces are shown, one under the other: the stylesheet alone hides nothing.
// With "reduce motion": no physics, the badge stays still, and it still turns over (instantly).

type Vec = { x: number; y: number };

const GRAVITY = 2400; // px/s²
const STIFFNESS = 140; // pull of the stretched cord, 1/s²
const DAMPING = 1.7; // 1/s
const TURN = 95; // how hard the card lines up with the cord, 1/s²
const TURN_DAMPING = 8; // 1/s
const MAX_STRETCH = 1.7; // the cord never gets longer than this many times its resting length
const STEP = 1 / 120;

export function initBadge() {
  const root = document.querySelector<HTMLElement>('[data-badge]');
  const card = root?.querySelector<HTMLElement>('[data-badge-card]');
  const pin = root?.querySelector<HTMLElement>('.badge__pin');
  if (!root || !card || !pin) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const back = root.querySelector<HTMLElement>('.badge__face--back');
  const hint = root.querySelector<HTMLElement>('[data-badge-hint]');
  const path = root.querySelector<SVGPathElement>('[data-badge-path]');

  // A button only now that it does something.
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-label', card.dataset.label ?? '');
  card.setAttribute('aria-pressed', 'false');
  if (back?.id) card.setAttribute('aria-describedby', back.id);
  root.classList.add('is-live');
  if (hint) {
    if (still && hint.dataset.still) hint.textContent = hint.dataset.still;
    hint.hidden = false;
  }

  let flipped = false;
  let suppressClick = false;
  const flip = () => {
    flipped = !flipped;
    root.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    if (!still) {
      // A little jolt, as when you turn a badge over in your hand.
      vel.y -= 260;
      spin += flipped ? 1.6 : -1.6;
      wake();
    }
  };
  card.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    flip();
  });
  card.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) flip();
  });

  if (still) return;
  root.classList.add('has-physics');

  // Geometry, in px, relative to the pin. "rest" is where the top of the card hangs in the layout.
  let anchor: Vec = { x: 0, y: 0 };
  let shift: Vec = { x: 0, y: 0 };
  let length = 100;
  let natural = 80;
  const pos: Vec = { x: 0, y: 100 };
  const vel: Vec = { x: 0, y: 0 };
  let angle = 0;
  let spin = 0;

  const measure = () => {
    // offsetLeft / offsetTop: layout positions, unaffected by the transform the script sets.
    anchor = { x: pin.offsetLeft + pin.offsetWidth / 2, y: pin.offsetTop + pin.offsetHeight / 2 };
    const top = { x: card.offsetLeft + card.offsetWidth / 2, y: card.offsetTop };
    length = Math.max(40, top.y - anchor.y);
    // At rest, gravity stretches the cord by GRAVITY / STIFFNESS: the card hangs exactly where the layout put it.
    natural = length - GRAVITY / STIFFNESS;
    shift = { x: top.x - anchor.x, y: top.y - anchor.y };
  };

  const step = (dt: number) => {
    if (!dragging) {
      const d = Math.hypot(pos.x, pos.y);
      let ax = 0;
      let ay = GRAVITY;
      if (d > natural) {
        const pull = (-STIFFNESS * (d - natural)) / d;
        ax += pull * pos.x;
        ay += pull * pos.y;
      }
      vel.x += ax * dt;
      vel.y += ay * dt;
      const keep = Math.exp(-DAMPING * dt);
      vel.x *= keep;
      vel.y *= keep;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      limit(true);
    }
    // The card turns to hang along a taut cord; on a slack cord it just keeps turning, slowly damped.
    const d = Math.hypot(pos.x, pos.y);
    let torque = -TURN_DAMPING * spin;
    if (d >= natural * 0.98) {
      const target = -Math.atan2(pos.x, pos.y);
      let diff = angle - target;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      torque -= TURN * diff;
    }
    spin += torque * dt;
    angle += spin * dt;
    // A full turn over the pin is still the same position.
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  };

  // The cord does not stretch for ever: past the limit, the outward speed is lost.
  const limit = (bounce: boolean) => {
    const d = Math.hypot(pos.x, pos.y);
    const max = length * MAX_STRETCH;
    if (d <= max) return;
    const ux = pos.x / d;
    const uy = pos.y / d;
    pos.x = ux * max;
    pos.y = uy * max;
    if (!bounce) return;
    const out = vel.x * ux + vel.y * uy;
    if (out > 0) {
      vel.x -= out * ux;
      vel.y -= out * uy;
    }
  };

  const render = () => {
    card.style.transform = `translate(${(pos.x - shift.x).toFixed(2)}px, ${(pos.y - shift.y).toFixed(2)}px) rotate(${angle.toFixed(4)}rad)`;
    if (!path) return;
    const bx = anchor.x + pos.x;
    const by = anchor.y + pos.y;
    const d = Math.hypot(pos.x, pos.y);
    // A slack cord sags under its own weight.
    const sag = d < natural ? Math.sqrt(natural * natural - d * d) * 0.55 : 0;
    const mx = (anchor.x + bx) / 2;
    const my = (anchor.y + by) / 2 + sag;
    path.setAttribute('d', `M${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`);
  };

  const settled = () =>
    Math.hypot(vel.x, vel.y) < 4 && Math.hypot(pos.x, pos.y - length) < 0.5 && Math.abs(spin) < 0.02 && Math.abs(angle) < 0.003;

  let raf = 0;
  let last = 0;
  let acc = 0;
  const tick = (now: number) => {
    acc += Math.min(0.05, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    if (!dragging && settled()) {
      pos.x = 0;
      pos.y = length;
      vel.x = vel.y = spin = angle = 0;
      render();
      raf = 0;
      return;
    }
    render();
    raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(tick);
  };

  // Dragging, with the mouse, a pen or a finger.
  let dragging = false;
  let pointer = -1;
  let grab: Vec = { x: 0, y: 0 };
  let start: Vec = { x: 0, y: 0 };
  let moved = 0;
  let lastMove = 0;
  const pinOnScreen = (): Vec => {
    const r = root.getBoundingClientRect();
    return { x: r.left + anchor.x, y: r.top + anchor.y };
  };

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || dragging) return;
    dragging = true;
    pointer = e.pointerId;
    suppressClick = false;
    card.setPointerCapture(pointer);
    const a = pinOnScreen();
    grab = { x: e.clientX - (a.x + pos.x), y: e.clientY - (a.y + pos.y) };
    start = { x: e.clientX, y: e.clientY };
    moved = 0;
    vel.x = vel.y = 0;
    lastMove = performance.now();
    root.classList.add('is-dragging');
    wake();
  });

  card.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointer) return;
    moved = Math.max(moved, Math.hypot(e.clientX - start.x, e.clientY - start.y));
    const a = pinOnScreen();
    const prev = { x: pos.x, y: pos.y };
    pos.x = e.clientX - a.x - grab.x;
    pos.y = e.clientY - a.y - grab.y;
    limit(false);
    const now = performance.now();
    const dt = Math.max(0.008, (now - lastMove) / 1000);
    lastMove = now;
    // Smoothed throwing speed.
    vel.x = vel.x * 0.4 + ((pos.x - prev.x) / dt) * 0.6;
    vel.y = vel.y * 0.4 + ((pos.y - prev.y) / dt) * 0.6;
    // While held, the card leans with the movement.
    spin += ((pos.x - prev.x) / Math.max(40, length)) * -2;
  });

  const release = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointer) return;
    dragging = false;
    if (card.hasPointerCapture(pointer)) card.releasePointerCapture(pointer);
    root.classList.remove('is-dragging');
    // A real drag is not a click: the click that follows must not turn the card over.
    if (e.type === 'pointerup' && moved > 6) suppressClick = true;
    // Held still before letting go: no throw.
    if (performance.now() - lastMove > 90) vel.x = vel.y = 0;
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > 3000) {
      vel.x *= 3000 / speed;
      vel.y *= 3000 / speed;
    }
    wake();
  };
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
  card.addEventListener('dragstart', (e) => e.preventDefault());

  measure();
  pos.x = 0;
  pos.y = length;
  render();
  new ResizeObserver(() => {
    measure();
    if (!raf) {
      pos.x = 0;
      pos.y = length;
      angle = spin = 0;
    }
    render();
  }).observe(root);

  // Once, when the badge first comes into view: a gentle swing, to show that it moves.
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      if (dragging) return;
      vel.x += 150;
      wake();
    },
    { threshold: 0.6 },
  );
  io.observe(card);
}
