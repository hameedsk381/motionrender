// Colour the way a designer builds it. A video's colour is not three hex codes: it is a tinted neutral ramp for the ground and surfaces, one brand ramp, a single
// accent, text that is never pure white on pure black, glows and shadows that carry the brand hue, and gradients that pass through lightness and hue instead of
// fading through grey. This works in OKLCH (perceptually even steps) and maps every colour into the sRGB gamut, so the steps look like steps.
//
//   const p = palette({ brand: '#2f6bff', accent: '#ffb703', mode: 'dark' });   // or palette('obsidian-ember')
//   p.bg, p.surface, p.surfaceRaised, p.border, p.text, p.textMuted, p.accent, p.onAccent, p.ramps.brand[500], p.gradients.backdrop, glow(p.accent)

export type Oklch = { l: number; c: number; h: number };
export type Stop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export type Ramp = Record<Stop, string>;
const STOPS: Stop[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a colour: ${hex}`);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
const byte = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${byte(r)}${byte(g)}${byte(b)}`;

/** A hex colour as lightness (0-1), chroma (0-0.4) and hue (degrees) in OKLCH. */
export function toOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b, m_ = l - 0.1055613458 * a - 0.0638541728 * b, s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
}
const inGamut = (rgb: number[]) => rgb.every(v => v >= -0.0005 && v <= 1.0005);

/** OKLCH to a hex colour. A colour outside sRGB keeps its lightness and hue and loses only as much chroma as it must. */
export function fromOklch(l: number, c: number, h: number): string {
  l = clamp01(l); c = Math.max(0, c);
  let rgb = oklchToLinear(l, c, h);
  if (!inGamut(rgb)) { let lo = 0, hi = c; for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLinear(l, mid, h))) lo = mid; else hi = mid; } rgb = oklchToLinear(l, lo, h); }
  return rgbToHex(...(rgb.map(fromLinear) as [number, number, number]));
}

/** WCAG contrast ratio of two hex colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => { const [r, g, bl] = hexToRgb(hex).map(toLinear) as [number, number, number]; return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** A colour with an alpha, as rgba(). */
export function withAlpha(hex: string, alpha: number): string { const [r, g, b] = hexToRgb(hex); return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`; }

/** Two colours mixed in OKLCH (through lightness and hue, not through grey). */
export function mix(a: string, b: string, t: number): string {
  const x = toOklch(a), y = toOklch(b);
  let dh = y.h - x.h; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const hue = x.c < 0.01 ? y.h : y.c < 0.01 ? x.h : (x.h + dh * t + 360) % 360;
  return fromOklch(x.l + (y.l - x.l) * t, x.c + (y.c - x.c) * t, hue);
}

// Lightness targets for the eleven steps, and how much of the hue's chroma each keeps: light and dark ends are quiet, the middle carries the colour.
const LIGHTNESS: Record<Stop, number> = { 50: 0.975, 100: 0.945, 200: 0.89, 300: 0.82, 400: 0.73, 500: 0.64, 600: 0.55, 700: 0.46, 800: 0.37, 900: 0.29, 950: 0.21 };
const CHROMA_KEEP: Record<Stop, number> = { 50: 0.1, 100: 0.2, 200: 0.42, 300: 0.65, 400: 0.88, 500: 1, 600: 0.97, 700: 0.84, 800: 0.66, 900: 0.5, 950: 0.38 };

/** Eleven even steps (50 lightest to 950 darkest) of one hue. `chroma` is the strength of the middle step (0.04 muted, 0.15 rich, 0.22 vivid). */
export function ramp(hue: number, chroma = 0.15): Ramp {
  const out = {} as Ramp;
  for (const stop of STOPS) out[stop] = fromOklch(LIGHTNESS[stop], chroma * CHROMA_KEEP[stop], hue);
  return out;
}

/** A linear-gradient that passes through the colours between two ends (extra stops in OKLCH), so the middle is a real colour and not a grey smear. */
export function gradient(from: string, to: string, options: { angle?: number; stops?: number } = {}): string {
  const n = Math.max(2, options.stops ?? 5);
  return `linear-gradient(${options.angle ?? 160}deg, ${Array.from({ length: n }, (_, i) => `${mix(from, to, i / (n - 1))} ${Math.round((i / (n - 1)) * 100)}%`).join(', ')})`;
}

/** A glow that carries the colour: a tight bright layer, a wide soft one. `size` scales both (default 1). */
export function glow(color: string, size = 1): string { return `0 0 ${Math.round(14 * size)}px ${withAlpha(color, 0.55)}, 0 0 ${Math.round(48 * size)}px ${withAlpha(color, 0.3)}, 0 0 ${Math.round(120 * size)}px ${withAlpha(color, 0.16)}`; }

/** An elevation shadow tinted with the ground's own hue instead of black: 1 (resting) to 4 (floating). */
export function shadow(ground: string, level: 1 | 2 | 3 | 4 = 2): string {
  const { h } = toOklch(ground), tint = (l: number, a: number) => withAlpha(fromOklch(l, 0.05, h), a);
  const y = [4, 10, 22, 40][level - 1]!, blur = [10, 24, 48, 90][level - 1]!;
  return `0 ${Math.round(y / 2)}px ${Math.round(blur / 2)}px ${tint(0.1, 0.18 + level * 0.03)}, 0 ${y}px ${blur}px ${tint(0.07, 0.22 + level * 0.04)}`;
}

export type PaletteOptions = {
  /** The brand colour: a hex, or the hue it sets. */ brand: string;
  /** The one accent. Without it, one is chosen from `harmony`. */ accent?: string;
  /** How the accent is found when none is given: the opposite hue, a neighbour, or a split. */ harmony?: 'complement' | 'analogous' | 'split';
  /** A dark ground (default) or a light one. */ mode?: 'dark' | 'light';
};

export type Palette = {
  mode: 'dark' | 'light';
  /** The ground: a tinted neutral, never pure black or white. */ bg: string;
  /** A card or panel on the ground. */ surface: string;
  /** A panel above that (a modal, a floating card). */ surfaceRaised: string;
  border: string; borderStrong: string;
  /** Body and heading text: a tinted off-white (or ink). */ text: string; textMuted: string; textFaint: string;
  /** The single accent, its soft fill, its strong (hover, pressed) step, and text that sits on it. */ accent: string; accentSoft: string; accentStrong: string; onAccent: string;
  /** The brand colour at its working step. */ brand: string;
  /** A third colour for secondary data, a neighbour of the brand. */ secondary: string;
  ramps: { brand: Ramp; accent: Ramp; neutral: Ramp };
  gradients: {
    /** A ground with depth: two soft glows and a vignette, as one CSS background. */ backdrop: string;
    /** For a button, a bar or a headline accent. */ accent: string; brand: string;
  };
};

/** Presets, each a complete decision: mood, ground, one brand, one accent. Use `palette('name')`. */
export const PALETTES: Record<string, PaletteOptions & { note: string }> = {
  'midnight-signal': { brand: '#2f5bff', accent: '#ffb020', mode: 'dark', note: 'deep blue ground, amber signal: finance, infrastructure, data' },
  'obsidian-ember': { brand: '#e8501f', accent: '#ffb199', mode: 'dark', note: 'warm near-black, vermilion: product launches, sport, cinema' },
  'graphite-lime': { brand: '#9be21a', accent: '#d8ff6a', mode: 'dark', note: 'cool graphite, acid lime: developer tools, hardware, AI' },
  'aubergine-peach': { brand: '#8a3ffc', accent: '#ff9d7a', mode: 'dark', note: 'plum ground, peach glow: culture, music, lifestyle' },
  'forest-brass': { brand: '#1f8a5f', accent: '#e0b150', mode: 'dark', note: 'deep green, brass: nature, wellbeing, sustainability' },
  'noir-gold': { brand: '#c9a24b', accent: '#f0d58a', mode: 'dark', note: 'ink black, soft gold: luxury, awards, premium' },
  'arctic-violet': { brand: '#5b6cff', accent: '#9ef0ff', mode: 'dark', note: 'blue-violet ground, ice cyan: science, space, the future' },
  'alabaster-ink': { brand: '#0f6b73', accent: '#e4572e', mode: 'light', note: 'warm paper, deep teal, one vermilion: editorial, explainers, reports' },
  'terracotta-cream': { brand: '#b8512f', accent: '#2f6f6b', mode: 'light', note: 'cream, clay, sea green: food, travel, craft, people' },
  'cobalt-ivory': { brand: '#1f48e6', accent: '#ff5a36', mode: 'light', note: 'ivory ground, cobalt, signal orange: tech, fintech, bold and clean' },
  'rosewood-sage': { brand: '#a8324a', accent: '#6f9a74', mode: 'light', note: 'soft blush paper, rosewood, sage: beauty, health, human stories' },
  'sand-indigo': { brand: '#3b3fa8', accent: '#f2b134', mode: 'light', note: 'sand ground, indigo, marigold: education, children, community' },
};

/** A full palette from a brand colour (and an accent), or from a preset name. */
export function palette(input: string | PaletteOptions): Palette {
  const options: PaletteOptions = typeof input === 'string' ? (PALETTES[input] ?? (() => { throw new Error(`No palette called "${input}". Presets: ${Object.keys(PALETTES).join(', ')}`); })()) : input;
  const mode = options.mode ?? 'dark', brand = toOklch(options.brand);
  const accentHue = options.accent ? toOklch(options.accent) : { l: 0.8, c: Math.max(0.12, brand.c), h: (brand.h + ({ complement: 180, analogous: 40, split: 150 }[options.harmony ?? 'complement'])) % 360 };
  const chroma = Math.min(0.2, Math.max(0.08, brand.c));
  const brandRamp = ramp(brand.h, chroma), accentRamp = ramp(accentHue.h, Math.min(0.2, Math.max(0.1, accentHue.c)));
  // Neutrals lean toward the brand hue: grey with a little colour in it is what makes surfaces look designed rather than default.
  const neutralRamp = ramp(brand.h, 0.022);
  const dark = mode === 'dark', n = (l: number, c = 0.02) => fromOklch(l, c, brand.h);
  const bg = dark ? n(0.165, 0.02) : n(0.972, 0.012), surface = dark ? n(0.205, 0.022) : n(0.995, 0.006), surfaceRaised = dark ? n(0.25, 0.024) : n(1, 0);
  const text = dark ? n(0.96, 0.01) : n(0.22, 0.03), textMuted = dark ? n(0.76, 0.02) : n(0.42, 0.03), textFaint = dark ? n(0.6, 0.025) : n(0.58, 0.025);
  const border = withAlpha(dark ? n(0.8, 0.03) : n(0.3, 0.03), dark ? 0.12 : 0.12), borderStrong = withAlpha(dark ? n(0.85, 0.03) : n(0.25, 0.03), dark ? 0.24 : 0.22);
  const accentBase = options.accent ?? accentRamp[400];
  // The accent sits at a step that reads on the ground; its text colour is whichever ink clears 4.5:1.
  const accent = dark ? (toOklch(accentBase).l < 0.62 ? accentRamp[400] : accentBase) : (toOklch(accentBase).l > 0.62 ? accentRamp[600] : accentBase);
  const darkInk = n(0.18, 0.03), lightInk = n(0.985, 0.008);
  // A mid-tone accent can leave neither ink at 4.5:1: nudge its lightness toward whichever end is nearer until one does.
  let accentFit = accent;
  for (let i = 0; i < 24 && Math.max(contrast(accentFit, darkInk), contrast(accentFit, lightInk)) < 4.5; i++) { const o = toOklch(accentFit); accentFit = fromOklch(o.l + (o.l >= 0.62 ? 0.02 : -0.02), o.c, o.h); }
  const onAccent = contrast(accentFit, darkInk) >= contrast(accentFit, lightInk) ? darkInk : lightInk;
  const brandWorking = dark ? (toOklch(options.brand).l < 0.5 ? brandRamp[400] : options.brand) : (toOklch(options.brand).l > 0.6 ? brandRamp[600] : options.brand);
  const secondary = fromOklch(dark ? 0.74 : 0.55, chroma * 0.8, (brand.h + 32) % 360);
  const glowA = withAlpha(brandRamp[dark ? 600 : 300], dark ? 0.34 : 0.28), glowB = withAlpha(accentRamp[dark ? 500 : 300], dark ? 0.16 : 0.18);
  const backdrop = `radial-gradient(ellipse 70% 60% at 18% 12%, ${glowA}, transparent 70%), radial-gradient(ellipse 60% 55% at 88% 92%, ${glowB}, transparent 72%), radial-gradient(ellipse 120% 100% at 50% 50%, transparent 55%, ${withAlpha(n(dark ? 0.1 : 0.9, 0.02), dark ? 0.55 : 0.35)} 100%), ${bg}`;
  return { mode, bg, surface, surfaceRaised, border, borderStrong, text, textMuted, textFaint, accent: accentFit, accentSoft: withAlpha(accentFit, dark ? 0.16 : 0.14), accentStrong: dark ? mix(accentFit, '#ffffff', 0.18) : mix(accentFit, '#000000', 0.18), onAccent, brand: brandWorking, secondary, ramps: { brand: brandRamp, accent: accentRamp, neutral: neutralRamp }, gradients: { backdrop, accent: gradient(accentRamp[300], accentFit, { angle: 120 }), brand: gradient(brandRamp[dark ? 400 : 500], brandRamp[dark ? 700 : 800], { angle: 140 }) } };
}
