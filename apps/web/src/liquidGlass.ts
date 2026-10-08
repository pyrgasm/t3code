/**
 * Liquid glass refraction for floating surfaces (`.dropdown-glass`, `.dialog-glass`).
 *
 * Technique from https://kube.io/blog/liquid-glass-css-svg/: a displacement map
 * sized to the element bends the backdrop through `backdrop-filter: url(#filter)`
 * along a Snell's-law bezel. Only Chromium renders an SVG `url()` backdrop filter;
 * elsewhere the CSS fallback in index.css keeps the tint, frost and rim light.
 *
 * Surfaces are found without a DOM observer: index.css gives every glass surface
 * a 1ms `t3-liquid-glass-attach` animation while liquid glass is on, so its
 * `animationstart` is the mount signal. No JavaScript runs per frame; a map is
 * rebuilt only when a surface changes size.
 */

const ATTACH_ANIMATION = "t3-liquid-glass-attach";
const SVG_NS = "http://www.w3.org/2000/svg";
const PROFILE_SAMPLES = 128;
const MAP_CACHE_LIMIT = 24;

export interface LiquidGlassConfig {
  /** 0–100. Scales the displacement only, so changing it never rebuilds a map. */
  refraction: number;
  /** Corner curve of the map; must match the CSS `corner-shape` or rims misalign. */
  squircle: boolean;
  /** Blur in CSS px, applied before the bend so refracted edges stay crisp. */
  frost: number;
}

interface Surface {
  element: HTMLElement;
  filter: SVGFilterElement;
  blur: SVGFEGaussianBlurElement;
  bends: SVGFEDisplacementMapElement[];
  image: SVGFEImageElement;
  observer: ResizeObserver;
  mapKey: string | null;
  frame: number;
  bezel: number;
}

let config: LiquidGlassConfig = { refraction: 70, squircle: true, frost: 6 };
let installed = false;
let host: SVGSVGElement | null = null;
let nextFilterId = 0;
const surfaces = new Map<HTMLElement, Surface>();

/** Chromium is the only engine that renders `backdrop-filter: url()`; others parse it and draw nothing. */
const supportsRefraction = (() => {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } })
    .userAgentData?.brands;
  return brands?.some((entry) => entry.brand === "Chromium") ?? false;
})();

// Surface height of a squircle bezel: flat inside, falling steeply at the rim.
const bezelHeight = (x: number) => (1 - (1 - x) ** 4) ** 0.25;

/** Normalized displacement along the bezel, 0 at the outer rim to 1 at the inner edge. */
const bezelProfile = (() => {
  const eta = 1 / 1.5; // air into glass
  const profile = new Float32Array(PROFILE_SAMPLES);
  let max = 0;
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const x = i / PROFILE_SAMPLES;
    const y = bezelHeight(x);
    const slope = (bezelHeight(Math.min(1, x + 1e-4)) - y) / 1e-4;
    const length = Math.hypot(slope, 1);
    const nx = -slope / length;
    const ny = -1 / length;
    const k = 1 - eta * eta * (1 - ny * ny);
    if (k < 0) continue;
    const s = eta * ny + Math.sqrt(k);
    const value = Math.abs(-s * nx * ((y + 0.15) / (eta - s * ny)));
    profile[i] = value;
    max = Math.max(max, value);
  }
  for (let i = 0; i < PROFILE_SAMPLES; i++) profile[i] = (profile[i] ?? 0) / (max || 1);
  return profile;
})();

const mapCache = new Map<string, { url: Promise<string>; users: number }>();

function renderDisplacementMap(
  cssWidth: number,
  cssHeight: number,
  cssRadius: number,
  cssBezel: number,
  squircle: boolean,
  density: number,
): Promise<string> {
  // Rendered at device density: a 1x map bends in visible pixel steps on HiDPI screens.
  const width = Math.round(cssWidth * density);
  const height = Math.round(cssHeight * density);
  const radius = cssRadius * density;
  const bezel = cssBezel * density;
  // R/G: displacement (128 = none). B: rim weight, where the sharp backdrop shows through.
  const pixels = new Uint32Array(width * height).fill(0xff008080);
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);
  for (let y = 0; y < height; y++) {
    const py = y + 0.5 - halfH;
    const ay = Math.abs(py);
    const qy = ay - (halfH - r);
    // Rows clear of the bezel only touch their two edge strips.
    const interior = halfH - ay >= bezel;
    for (let x = 0; x < width; x++) {
      if (interior && x >= bezel && x < width - bezel) {
        x = width - bezel - 1;
        continue;
      }
      const px = x + 0.5 - halfW;
      const ax = Math.abs(px);
      const qx = ax - (halfW - r);
      let depth: number;
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const length = squircle ? Math.sqrt(Math.sqrt(qx ** 4 + qy ** 4)) : Math.hypot(qx, qy);
        if (length === 0) continue;
        depth = r - length;
        const gx = squircle ? qx ** 3 : qx;
        const gy = squircle ? qy ** 3 : qy;
        const g = Math.hypot(gx, gy);
        nx = (gx / g) * Math.sign(px);
        ny = (gy / g) * Math.sign(py);
      } else if (halfW - ax < halfH - ay) {
        depth = halfW - ax;
        nx = Math.sign(px);
        ny = 0;
      } else {
        depth = halfH - ay;
        nx = 0;
        ny = Math.sign(py);
      }
      if (depth < 0 || depth >= bezel) continue;
      const strength =
        bezelProfile[Math.min(PROFILE_SAMPLES - 1, ((depth / bezel) * PROFILE_SAMPLES) | 0)] ?? 0;
      // Sample toward the centre near the rim: the bezel magnifies what sits inside it.
      const red = Math.round(128 - nx * strength * 127);
      const green = Math.round(128 - ny * strength * 127);
      const rim = Math.round(Math.min(1, strength * 1.4) * 255);
      pixels[y * width + x] = 0xff000000 | (rim << 16) | (green << 8) | red;
    }
  }
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("2d context unavailable"));
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" }).then((blob) => URL.createObjectURL(blob));
}

function acquireMap(key: string, build: () => Promise<string>): Promise<string> {
  let entry = mapCache.get(key);
  if (!entry) {
    entry = { url: build(), users: 0 };
    mapCache.set(key, entry);
  }
  entry.users++;
  // Re-insert so iteration order tracks recency for eviction.
  mapCache.delete(key);
  mapCache.set(key, entry);
  return entry.url;
}

function releaseMap(key: string | null) {
  if (!key) return;
  const entry = mapCache.get(key);
  if (!entry) return;
  entry.users = Math.max(0, entry.users - 1);
  if (mapCache.size <= MAP_CACHE_LIMIT) return;
  for (const [candidateKey, candidate] of mapCache) {
    if (mapCache.size <= MAP_CACHE_LIMIT) break;
    if (candidate.users > 0) continue;
    mapCache.delete(candidateKey);
    void candidate.url.then(URL.revokeObjectURL, () => {});
  }
}

function ensureHost(): SVGSVGElement {
  if (host?.isConnected) return host;
  host = document.createElementNS(SVG_NS, "svg");
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  // display:none would drop the filters; a zero box keeps them resolvable.
  host.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(host);
  return host;
}

const displacementScale = (bezel: number) => (config.refraction / 100) * bezel * 2.2;

function refresh(surface: Surface) {
  surface.frame = 0;
  const { element } = surface;
  if (!element.isConnected) {
    detach(element);
    return;
  }
  const width = Math.ceil(element.offsetWidth);
  const height = Math.ceil(element.offsetHeight);
  if (width < 4 || height < 4) return;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  const bezel = Math.max(5, Math.min(20, Math.round(Math.min(width, height) * 0.14)));
  surface.bezel = bezel;
  // Stretch the current map at once so a growing popover never shows a seam.
  surface.image.setAttribute("width", String(width));
  surface.image.setAttribute("height", String(height));
  for (const bend of surface.bends) bend.setAttribute("scale", displacementScale(bezel).toFixed(2));
  const density = Math.min(2, window.devicePixelRatio || 1);
  const key = `${width}x${height}@${density}:${Math.round(radius)}:${bezel}:${config.squircle ? "s" : "r"}`;
  if (key === surface.mapKey) return;
  const previous = surface.mapKey;
  surface.mapKey = key;
  acquireMap(key, () =>
    renderDisplacementMap(width, height, Math.round(radius), bezel, config.squircle, density),
  ).then(
    (url) => {
      if (surface.mapKey !== key) return;
      surface.image.setAttribute("href", url);
      element.style.setProperty("--liquid-glass-filter", `url(#${surface.filter.id})`);
    },
    () => {},
  );
  releaseMap(previous);
}

function attach(element: HTMLElement) {
  if (surfaces.has(element) || !supportsRefraction) return;
  const svg = ensureHost();
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = `t3-liquid-glass-${nextFilterId++}`;
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const primitive = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string>,
  ): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    filter.appendChild(node);
    return node;
  };
  // The interior is frosted; the rim bends the sharp backdrop so the lens reads
  // even over text. The map's blue channel masks the sharp rim over the frost.
  const image = primitive("feImage", {
    x: "0",
    y: "0",
    preserveAspectRatio: "none",
    result: "map",
  });
  const blur = primitive("feGaussianBlur", {
    in: "SourceGraphic",
    edgeMode: "duplicate",
    stdDeviation: String(config.frost),
    result: "frosted",
  });
  const bend = (input: string, result: string) =>
    primitive("feDisplacementMap", {
      in: input,
      in2: "map",
      xChannelSelector: "R",
      yChannelSelector: "G",
      result,
    });
  const bends = [bend("frosted", "frostedBent"), bend("SourceGraphic", "sharpBent")];
  primitive("feColorMatrix", {
    in: "map",
    type: "matrix",
    values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0",
    result: "rimMask",
  });
  primitive("feComposite", { in: "sharpBent", in2: "rimMask", operator: "in", result: "rim" });
  primitive("feComposite", { in: "rim", in2: "frostedBent", operator: "over" });
  svg.appendChild(filter);

  const surface: Surface = {
    element,
    filter,
    blur,
    bends,
    image,
    mapKey: null,
    frame: 0,
    bezel: 0,
    observer: new ResizeObserver(() => {
      if (!surface.frame) surface.frame = requestAnimationFrame(() => refresh(surface));
    }),
  };
  surfaces.set(element, surface);
  surface.observer.observe(element);
  refresh(surface);
  // Closed popups leave without an event; sweep them whenever a new one opens.
  for (const other of surfaces.keys()) if (!other.isConnected) detach(other);
}

function detach(element: HTMLElement) {
  const surface = surfaces.get(element);
  if (!surface) return;
  surfaces.delete(element);
  surface.observer.disconnect();
  if (surface.frame) cancelAnimationFrame(surface.frame);
  surface.filter.remove();
  element.style.removeProperty("--liquid-glass-filter");
  releaseMap(surface.mapKey);
}

function onAnimationStart(event: AnimationEvent) {
  if (event.animationName !== ATTACH_ANIMATION || event.pseudoElement) return;
  if (event.target instanceof HTMLElement) attach(event.target);
}

/** Applies settings; `enabled: false` releases every surface and stops listening. */
export function configureLiquidGlass(enabled: boolean, next: LiquidGlassConfig) {
  const remap = next.squircle !== config.squircle;
  config = next;
  if (!enabled) {
    if (installed) document.removeEventListener("animationstart", onAnimationStart, true);
    installed = false;
    for (const element of surfaces.keys()) detach(element);
    return;
  }
  if (!installed) {
    document.addEventListener("animationstart", onAnimationStart, true);
    installed = true;
  }
  for (const surface of surfaces.values()) {
    surface.blur.setAttribute("stdDeviation", String(config.frost));
    for (const bend of surface.bends) {
      bend.setAttribute("scale", displacementScale(surface.bezel).toFixed(2));
    }
    if (remap) refresh(surface);
  }
}

/** Attaches refraction to an element outside the glass classes, e.g. the settings preview. */
export function attachLiquidGlass(element: HTMLElement): () => void {
  attach(element);
  return () => detach(element);
}
