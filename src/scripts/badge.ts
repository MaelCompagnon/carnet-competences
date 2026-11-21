// The badge of the About page: a card hanging from a cord, pinned to the board.
// Grab it, pull, let go: the cord pulls it back like a spring and it swings under gravity.
// A click, Enter or Space turns it over (a short sentence on the back).
//
// Easter egg: keep the cord stretched to its limit and it frays (the warning), then breaks.
// The card falls off the screen, a note says "Oops…" next to the pin, and a button hangs the
// badge back up: a new cord comes down, catches the card and reels it up. It can break again.
//
// No library: a point on an elastic cord, integrated at a fixed step, and a card that turns
// to line up with the cord. The loop only runs while something moves.
// Without JavaScript both faces are shown, one under the other: the stylesheet alone hides nothing.
// With "reduce motion": no physics (so the cord never breaks), the badge stays still, and it
// still turns over (instantly).

type Vec = { x: number; y: number };
type State = 'hanging' | 'fraying' | 'falling' | 'gone' | 'rehanging';

const GRAVITY = 2400; // px/s²
const STIFFNESS = 140; // pull of the stretched cord, 1/s²
const DAMPING = 1.7; // 1/s
const TURN = 95; // how hard the card lines up with the cord, 1/s²
const TURN_DAMPING = 8; // 1/s
const MAX_STRETCH = 1.7; // the cord never gets longer than this many times its resting length
const STEP = 1 / 120;

// The cord that breaks.
const TAUT = 0.97; // "taut": at least 97 % of the longest the cord can get
const TAUT_DELAY = 1; // s held taut before the cord starts to fray
const FRAY_TIME = 2; // s of fraying (the warning) before it breaks
const FRAY_FADE = 0.6; // s for the fraying to fade away once the cord is let go
const FRAY_SPREAD = 7; // px: how far the strands draw apart, at most
const SNAP_STIFFNESS = 520; // the upper end flies back to the pin like an elastic, 1/s²
const SNAP_DAMPING = 11; // 1/s (low: it overshoots above the pin, then settles)
const STUB = 22; // px of cord left hanging under the pin
const FLING = 260; // px/s: the card is flung away from the pin when the cord gives way
const FALL_SPIN = 0.005; // rad/s of spin per px/s of sideways speed
const AIR = 0.35; // 1/s: drag on the falling card
const FALL_MAX = 4; // s: a card still on screen by then is taken away all the same
const DROP_TIME = 0.6; // s for the new cord to come down to the foot of the screen
const REEL_TIME = 1.0; // s to reel the card back up
const REEL_SWING = 150; // px/s: the push it gets at the top, to swing back to rest

export function initBadge() {
  const root = document.querySelector<HTMLElement>('[data-badge]');
  const card = root?.querySelector<HTMLElement>('[data-badge-card]');
  const pin = root?.querySelector<HTMLElement>('.badge__pin');
  if (!root || !card || !pin) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const back = root.querySelector<HTMLElement>('.badge__face--back');
  const path = root.querySelector<SVGPathElement>('[data-badge-path]');
  const oops = root.querySelector<HTMLElement>('[data-badge-oops]');
  const rehangButton = root.querySelector<HTMLButtonElement>('[data-badge-rehang]');
  const live = root.querySelector<HTMLElement>('[data-badge-live]');

  // A button only now that it does something.
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-label', card.dataset.label ?? '');
  card.setAttribute('aria-pressed', 'false');
  if (back?.id) card.setAttribute('aria-describedby', back.id);
  root.classList.add('is-live');

  let state: State = 'hanging';
  const onCord = () => state === 'hanging' || state === 'fraying';

  let flipped = false;
  let suppressClick = false;
  const setFlipped = (on: boolean) => {
    flipped = on;
    root.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
  };
  const flip = () => {
    if (!onCord()) return;
    setFlipped(!flipped);
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
  let cardHeight = 300;
  const pos: Vec = { x: 0, y: 100 };
  const vel: Vec = { x: 0, y: 0 };
  let angle = 0;
  let spin = 0;

  // The breaking cord: time held taut, time spent fraying, and how frayed it looks (0 to 1).
  let taut = 0;
  let frayed = 0;
  let fray = 0;
  // After the break: the upper end (springs back to the pin) and the lower piece (trails the card).
  const upper: Vec = { x: 0, y: 0 };
  const upperVel: Vec = { x: 0, y: 0 };
  const tail: Vec = { x: 0, y: 0 };
  const tailVel: Vec = { x: 0, y: 0 };
  let tailLength = 0;
  let fallTime = 0;
  // Hanging it back up: the foot of the screen (relative to the pin), and the time in each phase.
  let foot = 0;
  let reelTime = 0;

  const measure = () => {
    // offsetLeft / offsetTop: layout positions, unaffected by the transform the script sets.
    anchor = { x: pin.offsetLeft + pin.offsetWidth / 2, y: pin.offsetTop + pin.offsetHeight / 2 };
    const top = { x: card.offsetLeft + card.offsetWidth / 2, y: card.offsetTop };
    length = Math.max(40, top.y - anchor.y);
    // At rest, gravity stretches the cord by GRAVITY / STIFFNESS: the card hangs exactly where the layout put it.
    natural = length - GRAVITY / STIFFNESS;
    shift = { x: top.x - anchor.x, y: top.y - anchor.y };
    cardHeight = card.offsetHeight;
  };

  const step = (dt: number) => {
    if (state === 'falling') {
      fall(dt);
      snapBack(dt);
      trail(dt);
      return;
    }
    if (state === 'gone') {
      snapBack(dt);
      return;
    }
    if (state === 'rehanging') {
      rehang(dt);
      return;
    }
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
    tension(dt);
  };

  // Counted here, in the fixed-step loop: pointermove does not fire while the hand holds still.
  const tension = (dt: number) => {
    const tight = dragging && Math.hypot(pos.x, pos.y) >= length * MAX_STRETCH * TAUT;
    if (tight) {
      taut += dt;
      if (taut >= TAUT_DELAY) {
        state = 'fraying';
        frayed += dt;
        if (frayed >= FRAY_TIME) {
          snap();
          return;
        }
      }
    } else {
      // Let go, or eased off before the end: everything starts again from zero.
      taut = 0;
      frayed = 0;
      if (state === 'fraying') state = 'hanging';
    }
    // The strands draw further apart as the break comes; they fade away gently when let go.
    const target = state === 'fraying' ? 0.35 + 0.65 * Math.min(1, frayed / FRAY_TIME) : 0;
    fray = target >= fray ? Math.min(target, fray + dt * 4) : Math.max(target, fray - dt / FRAY_FADE);
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

  // The cord gives way in its middle. The card escapes the hand, keeps its speed and falls.
  const snap = () => {
    state = 'falling';
    const d = Math.hypot(pos.x, pos.y) || 1;
    upper.x = pos.x / 2;
    upper.y = pos.y / 2;
    upperVel.x = upperVel.y = 0;
    tail.x = upper.x;
    tail.y = upper.y;
    tailVel.x = tailVel.y = 0;
    tailLength = d / 2;
    fallTime = 0;
    fray = taut = frayed = 0;
    endDrag();
    // Held still: no throw from the hand, only the fling of the cord giving way.
    if (performance.now() - lastMove > 90) vel.x = vel.y = 0;
    vel.x += (pos.x / d) * FLING;
    vel.y += (pos.y / d) * FLING;
    spin += vel.x * FALL_SPIN + (vel.x >= 0 ? 1.2 : -1.2);
    root.classList.add('is-broken');
    card.inert = true;
    announce(live?.dataset.broken);
  };

  const fall = (dt: number) => {
    fallTime += dt;
    vel.y += GRAVITY * dt;
    const keep = Math.exp(-AIR * dt);
    vel.x *= keep;
    vel.y *= keep;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    spin *= Math.exp(-0.3 * dt);
    angle += spin * dt;
  };

  // The upper end flies back to the pin like an elastic, overshoots, and hangs as a stub.
  const snapBack = (dt: number) => {
    upperVel.x += (-SNAP_STIFFNESS * upper.x - SNAP_DAMPING * upperVel.x) * dt;
    upperVel.y += (-SNAP_STIFFNESS * (upper.y - STUB) - SNAP_DAMPING * upperVel.y) * dt;
    upper.x += upperVel.x * dt;
    upper.y += upperVel.y * dt;
  };
  const stubStill = () => Math.hypot(upper.x, upper.y - STUB) < 0.3 && Math.hypot(upperVel.x, upperVel.y) < 3;

  // The lower piece trails behind the falling card: it falls a little slower, held by the clip.
  const trail = (dt: number) => {
    tailVel.y += GRAVITY * 0.6 * dt;
    const keep = Math.exp(-3 * dt);
    tailVel.x *= keep;
    tailVel.y *= keep;
    tail.x += tailVel.x * dt;
    tail.y += tailVel.y * dt;
    const dx = tail.x - pos.x;
    const dy = tail.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > tailLength) {
      tail.x = pos.x + (dx / d) * tailLength;
      tail.y = pos.y + (dy / d) * tailLength;
      tailVel.x = vel.x;
      tailVel.y = vel.y;
    }
  };

  // Entirely below the screen (whatever its turn), or falling for too long.
  const fallen = () => {
    const top = root.getBoundingClientRect().top + anchor.y + pos.y;
    return top - cardHeight > window.innerHeight || fallTime > FALL_MAX;
  };

  // Off the screen: hidden and out of reach. It goes back to its place (still hidden), so that
  // it never makes the page longer. The note and the button take its place under the pin.
  const toGone = () => {
    state = 'gone';
    card.style.visibility = 'hidden';
    pos.x = 0;
    pos.y = length;
    vel.x = vel.y = spin = angle = 0;
    if (oops) oops.hidden = false;
    rehangButton?.focus({ preventScroll: true });
  };

  // A new cord comes down from the pin to the foot of the screen, catches the card there
  // and reels it up; near the top the physics takes over and the badge swings back to rest.
  const startRehang = () => {
    if (state !== 'gone') return;
    state = 'rehanging';
    reelTime = 0;
    if (oops) oops.hidden = true;
    // Back on its front, as it was hung the first time.
    if (flipped) setFlipped(false);
    const r = root.getBoundingClientRect();
    foot = Math.max(length + 40, window.innerHeight - (r.top + anchor.y) + 12);
    pos.x = 0;
    pos.y = foot;
    vel.x = vel.y = spin = angle = 0;
    wake();
  };

  const rehang = (dt: number) => {
    reelTime += dt;
    if (reelTime < DROP_TIME) return;
    // Caught: the card is shown again (it is still just below the screen).
    if (card.style.visibility) card.style.visibility = '';
    const f = Math.min(1, (reelTime - DROP_TIME) / REEL_TIME);
    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    pos.y = foot + (length - foot) * e;
    // It sways a little on the way up.
    pos.x = 10 * Math.sin(reelTime * 7) * (1 - f);
    angle = -Math.atan2(pos.x, pos.y);
    if (f < 1) return;
    state = 'hanging';
    pos.x = 0;
    pos.y = length;
    vel.x = REEL_SWING;
    vel.y = 0;
    root.classList.remove('is-broken');
    card.inert = false;
    card.focus({ preventScroll: true });
    announce(live?.dataset.rehung);
  };
  rehangButton?.addEventListener('click', startRehang);

  // Polite announcement; emptied first, so the same message is read again next time.
  const announce = (text?: string) => {
    if (!live || !text) return;
    live.textContent = '';
    setTimeout(() => (live.textContent = text), 60);
  };

  // Drawing.
  const f1 = (n: number) => n.toFixed(1);
  const quad = (a: Vec, c: Vec, b: Vec) => `M${f1(a.x)} ${f1(a.y)} Q${f1(c.x)} ${f1(c.y)} ${f1(b.x)} ${f1(b.y)}`;
  const at = (a: Vec, c: Vec, b: Vec, u: number): Vec => ({
    x: (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * c.x + u * u * b.x,
    y: (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * c.y + u * u * b.y,
  });
  const jitter = (amount: number) => (Math.random() - 0.5) * amount;

  // The frayed strands and fibres: drawn by the script only, inside the cord's SVG.
  const NS = 'http://www.w3.org/2000/svg';
  const frayGroup = document.createElementNS(NS, 'g');
  frayGroup.setAttribute('class', 'badge__fray');
  const strands = [0, 1, 2].map(() => frayGroup.appendChild(document.createElementNS(NS, 'path')));
  path?.ownerSVGElement?.appendChild(frayGroup);

  const drawFray = (a: Vec, c: Vec, b: Vec) => {
    if (fray <= 0.001) {
      frayGroup.style.display = 'none';
      return;
    }
    frayGroup.style.display = '';
    frayGroup.style.opacity = String(Math.min(1, fray * 1.5));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / l, y: dx / l };
    const t = { x: dx / l, y: dy / l };
    // Two strands draw apart from the core, widest in the middle, where it will give way.
    [-1, 1].forEach((side, i) => {
      const s = side * (fray * FRAY_SPREAD + jitter(fray * 1.5));
      strands[i].setAttribute('d', quad(a, { x: c.x + n.x * 2 * s, y: c.y + n.y * 2 * s }, b));
    });
    // Three fibres stick out around the middle.
    let d = '';
    [
      [0.43, 1, 9],
      [0.5, -1, 11],
      [0.56, 1, 7],
    ].forEach(([u, side, len]) => {
      const p = at(a, c, b, u);
      const o = side * (fray * FRAY_SPREAD * 0.6);
      const reach = side * len * fray;
      d += ` M${f1(p.x + n.x * o)} ${f1(p.y + n.y * o)} L${f1(p.x + n.x * (o + reach) + t.x * len * 0.5)} ${f1(p.y + n.y * (o + reach) + t.y * len * 0.5)}`;
    });
    strands[2].setAttribute('d', d.trim());
  };

  const render = () => {
    card.style.transform = `translate(${(pos.x - shift.x).toFixed(2)}px, ${(pos.y - shift.y).toFixed(2)}px) rotate(${angle.toFixed(4)}rad)`;
    if (!path) return;
    const a = anchor;
    if (onCord()) {
      const b = { x: a.x + pos.x, y: a.y + pos.y };
      const d = Math.hypot(pos.x, pos.y);
      // A slack cord sags under its own weight.
      const sag = d < natural ? Math.sqrt(natural * natural - d * d) * 0.55 : 0;
      // A fraying cord trembles a little.
      const c = { x: (a.x + b.x) / 2 + jitter(fray * 2.4), y: (a.y + b.y) / 2 + sag + jitter(fray * 2.4) };
      path.setAttribute('d', quad(a, c, b));
      path.style.strokeWidth = fray > 0.001 ? String(3 - 1.4 * fray) : '';
      drawFray(a, c, b);
      return;
    }
    frayGroup.style.display = 'none';
    path.style.strokeWidth = '';
    if (state === 'rehanging') {
      // The new cord: coming down to the foot of the screen, then reeling the card up.
      const reach = reelTime < DROP_TIME ? STUB + (foot - STUB) * (reelTime / DROP_TIME) ** 2 : 0;
      const b = reelTime < DROP_TIME ? { x: a.x + 3 * Math.sin(reelTime * 25), y: a.y + reach } : { x: a.x + pos.x, y: a.y + pos.y };
      path.setAttribute('d', quad(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b));
      return;
    }
    // Broken: the stub under the pin, whipping behind its own speed…
    const u = { x: a.x + upper.x, y: a.y + upper.y };
    let d = quad(a, { x: (a.x + u.x) / 2 - upperVel.x * 0.012, y: (a.y + u.y) / 2 - upperVel.y * 0.012 }, u);
    // …and, while the card falls, the piece still on its clip.
    if (state === 'falling') {
      const p = { x: a.x + pos.x, y: a.y + pos.y };
      const q = { x: a.x + tail.x, y: a.y + tail.y };
      d += ` ${quad(p, { x: (p.x + q.x) / 2 - tailVel.x * 0.01, y: (p.y + q.y) / 2 - tailVel.y * 0.01 }, q)}`;
    }
    path.setAttribute('d', d);
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
    if (state === 'falling' && fallen()) toGone();
    // Only a hanging badge at rest, or a stub that has stopped moving, lets the loop stop.
    const done = state === 'hanging' ? !dragging && fray === 0 && settled() : state === 'gone' && stubStill();
    if (done) {
      if (state === 'hanging') {
        pos.x = 0;
        pos.y = length;
        vel.x = vel.y = spin = angle = 0;
      }
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
    if (e.button !== 0 || dragging || state !== 'hanging') return;
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

  // The hand lets go (or the cord broke and the card escaped it).
  const endDrag = () => {
    dragging = false;
    if (card.hasPointerCapture(pointer)) card.releasePointerCapture(pointer);
    root.classList.remove('is-dragging');
  };

  const release = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointer) return;
    endDrag();
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
  // A long press of a finger must not open the image menu while the card is held.
  card.addEventListener('contextmenu', (e) => {
    if (dragging) e.preventDefault();
  });

  measure();
  pos.x = 0;
  pos.y = length;
  render();
  new ResizeObserver(() => {
    measure();
    // Put back at rest only a badge that hangs still: never a falling, gone or returning card.
    if (!raf && state === 'hanging') {
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
      if (dragging || state !== 'hanging') return;
      vel.x += 150;
      wake();
    },
    { threshold: 0.6 },
  );
  io.observe(card);
}
