/**
 * One highlight per menu list that springs to the highlighted item instead of
 * each item painting its own, stretching along its path with speed and
 * inflating while pressed, like a macOS Tahoe selection lens.
 *
 * Lists are found the way liquid glass finds surfaces: index.css runs a 1ms
 * `t3-menu-glide-attach` animation on them while the glide is on. Items keep
 * their own highlight until a list is attached (`data-glide-host`), so a list
 * this never reaches still shows one.
 */

const ATTACH_ANIMATION = "t3-menu-glide-attach";
export const MENU_GLIDE_ITEM_SELECTOR =
  ":is([data-slot=menu-item],[data-slot=menu-checkbox-item],[data-slot=menu-radio-item],[data-slot=menu-sub-trigger],[data-slot=select-item],[data-slot=combobox-item],[data-slot=autocomplete-item],[data-slot=command-item])";
const HIGHLIGHTED_SELECTOR = `${MENU_GLIDE_ITEM_SELECTOR}[data-highlighted]`;
// Re-entering within this window slides from the last item rather than fading in on the new one.
const RESUME_WINDOW_MS = 220;
const STIFFNESS = 820;
const DAMPING = 2 * 0.82 * Math.sqrt(STIFFNESS);

interface Axis {
  value: number;
  velocity: number;
  target: number;
}

interface Glide {
  list: HTMLElement;
  lens: HTMLDivElement;
  observer: MutationObserver;
  axes: { x: Axis; y: Axis; w: Axis; h: Axis };
  press: Axis;
  visible: boolean;
  /** Lists open with their current value highlighted; the lens waits for the user to move. */
  armed: boolean;
  hiddenAt: number;
  hideFrame: number;
  frame: number;
  lastTime: number;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onIntent: (event: Event) => void;
}

let stretch = 0.5;
let installed = false;
const glides = new Map<HTMLElement, Glide>();
const reducedMotion =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

const axis = (): Axis => ({ value: 0, velocity: 0, target: 0 });

function step(glide: Glide, time: number) {
  const dt = Math.min(1 / 30, (time - glide.lastTime) / 1000 || 1 / 60);
  glide.lastTime = time;
  let moving = false;
  for (const a of [glide.axes.x, glide.axes.y, glide.axes.w, glide.axes.h, glide.press]) {
    a.velocity += (-STIFFNESS * (a.value - a.target) - DAMPING * a.velocity) * dt;
    a.value += a.velocity * dt;
    if (Math.abs(a.value - a.target) > 0.05 || Math.abs(a.velocity) > 0.5) moving = true;
    else {
      a.value = a.target;
      a.velocity = 0;
    }
  }
  paint(glide);
  glide.frame = moving ? requestAnimationFrame((next) => step(glide, next)) : 0;
}

function paint(glide: Glide) {
  const { x, y, w, h } = glide.axes;
  const vertical = Math.abs(y.velocity) >= Math.abs(x.velocity);
  const speed = Math.abs(vertical ? y.velocity : x.velocity);
  // Stretch along the path, swell a little across it; tanh caps it on long jumps.
  const along = Math.tanh(speed / 2400) * 0.24 * stretch;
  const press = glide.press.value;
  const scaleAlong = 1 + along + press * 0.06;
  const scaleAcross = 1 + along * 0.22 + press * 0.025;
  const sx = vertical ? scaleAcross : scaleAlong;
  const sy = vertical ? scaleAlong : scaleAcross;
  const style = glide.lens.style;
  style.width = `${w.value}px`;
  style.height = `${h.value}px`;
  style.transform = `translate3d(${x.value}px, ${y.value}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
}

function kick(glide: Glide) {
  if (reducedMotion?.matches) {
    for (const a of [glide.axes.x, glide.axes.y, glide.axes.w, glide.axes.h, glide.press]) {
      a.value = a.target;
      a.velocity = 0;
    }
    paint(glide);
    return;
  }
  if (!glide.frame) {
    glide.lastTime = performance.now();
    glide.frame = requestAnimationFrame((time) => step(glide, time));
  }
}

function track(glide: Glide) {
  const { list, lens, axes } = glide;
  const item = glide.armed ? list.querySelector<HTMLElement>(HIGHLIGHTED_SELECTOR) : null;
  if (!item) {
    // Hover moves can clear one item a task before highlighting the next; wait a frame.
    if (glide.visible && !glide.hideFrame) {
      glide.hideFrame = requestAnimationFrame(() => {
        glide.hideFrame = 0;
        if (list.querySelector(HIGHLIGHTED_SELECTOR)) return;
        glide.visible = false;
        glide.hiddenAt = performance.now();
        lens.style.opacity = "0";
      });
    }
    return;
  }
  const listRect = list.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  axes.x.target = itemRect.left - listRect.left - list.clientLeft + list.scrollLeft;
  axes.y.target = itemRect.top - listRect.top - list.clientTop + list.scrollTop;
  axes.w.target = itemRect.width;
  axes.h.target = itemRect.height;
  if (!glide.visible) {
    glide.visible = true;
    lens.style.borderRadius = getComputedStyle(item).borderTopLeftRadius;
    if (performance.now() - glide.hiddenAt > RESUME_WINDOW_MS) {
      for (const a of Object.values(axes)) {
        a.value = a.target;
        a.velocity = 0;
      }
      paint(glide);
    }
    lens.style.opacity = "1";
  }
  kick(glide);
}

function attach(list: HTMLElement) {
  if (glides.has(list)) return;
  const lens = document.createElement("div");
  lens.dataset.slot = "menu-glide";
  lens.setAttribute("aria-hidden", "true");
  if (getComputedStyle(list).position === "static") list.style.position = "relative";
  list.style.isolation = "isolate";
  list.prepend(lens);
  list.dataset.glideHost = "";

  const glide: Glide = {
    list,
    lens,
    axes: { x: axis(), y: axis(), w: axis(), h: axis() },
    press: axis(),
    visible: false,
    armed: false,
    hiddenAt: Number.NEGATIVE_INFINITY,
    hideFrame: 0,
    frame: 0,
    lastTime: 0,
    observer: new MutationObserver(() => track(glide)),
    onPointerDown: () => {
      glide.press.target = 1;
      kick(glide);
    },
    onPointerUp: () => {
      glide.press.target = 0;
      kick(glide);
    },
    onIntent: (event) => {
      // Pointer moves only count once they reach this list's items.
      if (event.type === "pointermove" && !list.contains(event.target as Node)) return;
      glide.armed = true;
      document.removeEventListener("pointermove", glide.onIntent, true);
      document.removeEventListener("keydown", glide.onIntent, true);
      track(glide);
    },
  };
  glides.set(list, glide);
  // childList catches filtered lists moving the highlighted item without re-highlighting it.
  glide.observer.observe(list, {
    attributes: true,
    attributeFilter: ["data-highlighted"],
    childList: true,
    subtree: true,
  });
  list.addEventListener("pointerdown", glide.onPointerDown);
  list.addEventListener("pointerup", glide.onPointerUp);
  list.addEventListener("pointerleave", glide.onPointerUp);
  document.addEventListener("pointermove", glide.onIntent, true);
  document.addEventListener("keydown", glide.onIntent, true);
  track(glide);
  for (const other of glides.keys()) if (!other.isConnected) detach(other);
}

function detach(list: HTMLElement) {
  const glide = glides.get(list);
  if (!glide) return;
  glides.delete(list);
  glide.observer.disconnect();
  if (glide.frame) cancelAnimationFrame(glide.frame);
  if (glide.hideFrame) cancelAnimationFrame(glide.hideFrame);
  list.removeEventListener("pointerdown", glide.onPointerDown);
  list.removeEventListener("pointerup", glide.onPointerUp);
  list.removeEventListener("pointerleave", glide.onPointerUp);
  document.removeEventListener("pointermove", glide.onIntent, true);
  document.removeEventListener("keydown", glide.onIntent, true);
  glide.lens.remove();
  delete list.dataset.glideHost;
}

function onAnimationStart(event: AnimationEvent) {
  if (event.animationName !== ATTACH_ANIMATION || event.pseudoElement) return;
  if (event.target instanceof HTMLElement) attach(event.target);
}

/** `stretchAmount` is 0–100; `enabled: false` hands highlighting back to the items. */
export function configureMenuGlide(enabled: boolean, stretchAmount: number) {
  stretch = stretchAmount / 100;
  if (enabled && !installed) {
    document.addEventListener("animationstart", onAnimationStart, true);
    installed = true;
  } else if (!enabled && installed) {
    document.removeEventListener("animationstart", onAnimationStart, true);
    installed = false;
    for (const list of glides.keys()) detach(list);
  }
}
