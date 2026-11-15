// =============================================================================
// effects.js — motion: tab highlighter, circular theme reveal, cursor glow,
// button ripples. All of it calms down for reduced motion.
// =============================================================================
const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// -----------------------------------------------------------------------------
// 1. Tab highlighter: glides softly to the clicked tab and keeps its shape.
//    Position and width follow a critically damped spring (no bounce).
// -----------------------------------------------------------------------------
(function () {
  const hl = document.getElementById("tab-highlight");
  const bar = document.getElementById("tabbar");
  if (!hl || !bar) return;
  let x = 0, w = 0, vx = 0, vw = 0, tx = 0, tw = 0, raf = null, last = 0, ready = false;
  const K = 140, C = 2 * Math.sqrt(K);          // stiffness, critical damping

  function targetFor(btn) {
    const b = btn.getBoundingClientRect(), n = bar.getBoundingClientRect();
    return [b.left - n.left + bar.scrollLeft, b.width];
  }
  function draw() { hl.style.left = `${x}px`; hl.style.width = `${Math.max(0, w)}px`; }
  function step(now) {
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    vx += (K * (tx - x) - C * vx) * dt; x += vx * dt;
    vw += (K * (tw - w) - C * vw) * dt; w += vw * dt;
    draw();
    if (Math.abs(tx - x) < 0.2 && Math.abs(tw - w) < 0.2 && Math.abs(vx) < 2 && Math.abs(vw) < 2) {
      x = tx; w = tw; vx = vw = 0; draw(); raf = null; return;
    }
    raf = requestAnimationFrame(step);
  }
  window.moveTabHighlight = function (btn, animate) {
    [tx, tw] = targetFor(btn);
    if (!ready || !animate || REDUCED_MOTION) { x = tx; w = tw; vx = vw = 0; ready = true; draw(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  };
  const resync = () => { const a = bar.querySelector(".tab.active"); if (a) window.moveTabHighlight(a, false); };
  window.addEventListener("resize", resync);
  bar.addEventListener("scroll", resync, { passive: true });
  document.fonts && document.fonts.ready.then(resync);
})();

// -----------------------------------------------------------------------------
// 2. Theme reveal: the new theme grows as a circle from the button.
//    It starts slowly and finishes fast (exponential ease-in).
// -----------------------------------------------------------------------------
const EASE_IN_EXPO = "cubic-bezier(0.7, 0, 0.84, 0)";
const THEME_MS = 900;

function toggleTheme(ev) {
  const next = state.theme === "dark" ? "light" : "dark";
  // grow from whichever theme button was pressed (top bar, or the phone side bar)
  const src = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget : document.getElementById("btn-theme");
  const icon = src.querySelector && src.querySelector(".icon-btn");
  const btn = (icon || src).getBoundingClientRect();
  const cx = btn.left + btn.width / 2, cy = btn.top + btn.height / 2;
  const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));

  if (REDUCED_MOTION) { setTheme(next); return; }

  if (document.startViewTransition) {
    const vt = document.startViewTransition(() => setTheme(next));
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${r}px at ${cx}px ${cy}px)`] },
        { duration: THEME_MS, easing: EASE_IN_EXPO, pseudoElement: "::view-transition-new(root)" });
    }).catch(() => {});
    return;
  }
  // Fallback: a circle of the new background colour grows, then the theme switches
  const wipe = document.createElement("div");
  wipe.id = "theme-wipe";
  wipe.style.background = next === "dark" ? "#02040A" : "#F3F5F9";
  Object.assign(wipe.style, { left: `${cx - r}px`, top: `${cy - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
  document.body.appendChild(wipe);
  wipe.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], { duration: THEME_MS, easing: EASE_IN_EXPO, fill: "forwards" })
    .finished.then(() => {
      setTheme(next);
      wipe.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.then(() => wipe.remove());
    });
}

// -----------------------------------------------------------------------------
// 3. Glow that follows the mouse with a little lag, behind the content
// -----------------------------------------------------------------------------
(function () {
  const g = document.getElementById("cursor-glow");
  if (!g || REDUCED_MOTION || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches)) return;
  let x = window.innerWidth / 2, y = window.innerHeight / 3, tx = x, ty = y, raf = null;
  function step(now) {
    const px = x, py = y;
    x += (tx - x) * 0.09; y += (ty - y) * 0.09;
    const vx = x - px, vy = y - py, sp = Math.min(1, Math.hypot(vx, vy) / 30);
    const ang = Math.atan2(vy, vx) * 180 / Math.PI, breathe = 1 + 0.04 * Math.sin(now / 900);
    g.style.transform = `translate(${x}px, ${y}px) rotate(${ang}deg) scale(${(breathe + sp * 0.35).toFixed(3)}, ${(breathe - sp * 0.15).toFixed(3)})`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(step) : null;
  }
  window.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; g.classList.add("on"); if (!raf) raf = requestAnimationFrame(step); }, { passive: true });
  document.addEventListener("pointerleave", () => g.classList.remove("on"));
})();

// -----------------------------------------------------------------------------
// 4. Button feedback: press scale + ripple from the click point
// -----------------------------------------------------------------------------
const FX_SELECTOR = "button, .pill, .go-link, select, .opt";
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(FX_SELECTOR);
  if (!el || el.closest(".leaflet-control") || el.tagName === "SELECT") return;
  el.classList.add("fx");
  if (REDUCED_MOTION) return;
  const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
  const rip = document.createElement("span");
  rip.className = "ripple";
  Object.assign(rip.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
  el.appendChild(rip);
  setTimeout(() => rip.remove(), 700);
  el.classList.remove("press-flash"); void el.offsetWidth; el.classList.add("press-flash");
});
// make every button "fx" from the start so the press transition is smooth
window.addEventListener("DOMContentLoaded", () => {
  const mark = () => document.querySelectorAll(FX_SELECTOR).forEach((b) => { if (b.tagName !== "SELECT") b.classList.add("fx"); });
  mark();
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
});
