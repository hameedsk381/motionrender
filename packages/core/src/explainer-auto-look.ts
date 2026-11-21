// A look made from the content. When a script leaves `look` on "auto", the subject picks the family of design (a news subject reads as newsprint, a
// security subject as terminal), and what the script says seeds a variation of it: the hue turns, the accent is re-balanced for contrast, the type
// pairing, texture, motion, transition, header, progress bar and caption style are chosen from the sets that suit that family. Two videos on the
// same subject are alike; two on different subjects are not, and no video is one of thirteen fixed boards. Deterministic: same script, same look.
import { explainerLookDefs, explainerLooks, type Explainer, type ExplainerDesign, type ExplainerLook, type ExplainerLookDef } from '@ove/schema';

const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Words that mark a subject, per family. A word counts when a word in the script starts with it. */
const MOOD: Record<ExplainerLook, string[]> = {
  navy: ['money', 'bank', 'financ', 'invest', 'econom', 'market', 'tax', 'payment', 'loan', 'interest', 'insur', 'budget', 'profit', 'revenue', 'cloud', 'server', 'api', 'network', 'cache', 'database', 'latency', 'load balanc', 'queue', 'scal'],
  ink: ['launch', 'product', 'brand', 'cinema', 'film', 'release', 'startup', 'advert', 'campaign', 'premium', 'luxury', 'car', 'watch'],
  paper: ['learn', 'school', 'teach', 'educat', 'famil', 'communit', 'cook', 'recipe', 'human', 'people', 'habit', 'parent', 'child'],
  forest: ['nature', 'climate', 'sustain', 'green', 'tree', 'forest', 'carbon', 'environment', 'solar', 'wind', 'recycl', 'wildlife', 'farm', 'soil'],
  sunset: ['music', 'art', 'cultur', 'lifestyle', 'fashion', 'travel', 'food', 'festival', 'dance', 'story', 'theatre', 'poet'],
  ocean: ['health', 'water', 'sea', 'ocean', 'medic', 'hospital', 'sleep', 'doctor', 'vaccin', 'immune', 'body', 'heart', 'calm'],
  terminal: ['security', 'hack', 'code', 'developer', 'linux', 'command', 'terminal', 'cyber', 'encrypt', 'password', 'compil', 'kernel', 'shell', 'malware', 'protocol'],
  blueprint: ['architect', 'engineer', 'build', 'bridge', 'math', 'physic', 'circuit', 'design', 'structure', 'algorithm', 'geometr', 'machine', 'engine'],
  candy: ['kid', 'game', 'fun', 'snack', 'friend', 'young', 'social', 'playful', 'toy', 'party', 'sweet'],
  sage: ['book', 'read', 'writ', 'craft', 'garden', 'slow', 'poem', 'mindful', 'tea', 'journal', 'meditat'],
  newsprint: ['news', 'histor', 'politic', 'law', 'government', 'election', 'war', 'court', 'congress', 'bill', 'senate', 'vote', 'rights', 'constitution', 'treaty'],
  neon: ['gaming', 'nightlife', 'future', 'esport', 'synth', 'cyberpunk', 'ai ', 'artificial', 'robot', 'metaverse', 'streaming'],
  slate: ['business', 'office', 'productiv', 'saas', 'workflow', 'team', 'meeting', 'manage', 'crm', 'analytics', 'dashboard'],
};

/** Every string the script says or shows, lower-cased: the subject as the viewer will meet it. */
function corpus(spec: Explainer): string {
  const parts: string[] = [spec.topic, spec.series];
  const walk = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, inner]) => { if (key !== 'kind' && key !== 'variant') walk(inner); });
  };
  spec.scenes.forEach(walk);
  return ` ${parts.join(' ').toLowerCase()} `;
}

/** The family of design the subject points to: the one whose words appear most; a tie, or no match at all, is settled by the seed. */
export function moodOf(spec: Explainer): { look: ExplainerLook; score: number } {
  const text = corpus(spec), seed = hash(spec.topic);
  const scored = explainerLooks.map(look => ({ look, score: MOOD[look].reduce((n, word) => n + (text.split(` ${word}`).length - 1), 0) }));
  const top = Math.max(...scored.map(item => item.score));
  const pool = top > 0 ? scored.filter(item => item.score === top) : scored;
  return { look: pool[seed % pool.length]!.look, score: top };
}

/* ---- colour helpers ---- */
type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = ([r, g, b]: Rgb) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map(v => v / 255) as Rgb, max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
const turn = (hex: string, degrees: number, dl = 0) => { const [h, s, l] = toHsl(hex); return fromHsl((h + degrees + 360) % 360, s, Math.max(0, Math.min(1, l + dl))); };
const luminance = (hex: string) => { const [r, g, b] = toRgb(hex).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as Rgb; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrastRatio = (a: string, b: string) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
/** Moves `color` lighter or darker, away from the background, until it reads at `min` contrast. */
function readable(color: string, background: string, min: number): string {
  let out = color;
  const lighter = luminance(background) < 0.4;
  for (let i = 0; i < 14 && contrastRatio(out, background) < min; i++) out = turn(out, 0, lighter ? 0.04 : -0.04);
  return out;
}

/* ---- the design: type, texture, motion and frame, chosen from the sets that suit the family ---- */
const SANS = ['Archivo', 'Inter', 'Space Grotesk', 'Manrope', 'DM Sans', 'Syne'] as const;
const SERIF = ['Fraunces', 'Playfair Display'] as const;
const pick = <T>(items: readonly T[], seed: number, salt: number): T => items[hash(`${seed}:${salt}`) % items.length]!;

export function autoLook(spec: Explainer): { name: ExplainerLook; def: ExplainerLookDef } {
  const { look } = moodOf(spec), base = explainerLookDefs[look], seed = hash(`${spec.topic}|${spec.scenes.length}`);
  const dark = luminance(base.colors.bg) < 0.4;
  const shift = (hash(`${seed}:hue`) % 61) - 30;                                        // the family's hue turns up to 30 degrees either way
  const bg = turn(base.colors.bg, shift), surface = turn(base.colors.surface, shift), muted = turn(base.colors.muted, shift * 0.6);
  const accent = readable(turn(base.colors.accent, shift + 8), bg, 4.5), accent2 = readable(turn(base.colors.accent2, shift - 38 + (hash(`${seed}:a2`) % 30)), bg, 4.5);
  const colors = { ...base.colors, bg, surface, muted: readable(muted, bg, 3.4), accent, accent2, textureColor: turn(base.colors.textureColor, shift) };

  const serif = (SERIF as readonly string[]).includes(base.design.fontDisplay), mono = base.design.fontDisplay === 'JetBrains Mono';
  const fontDisplay = mono ? 'JetBrains Mono' : serif ? pick(SERIF, seed, 1) : pick(SANS, seed, 1);
  const fontBody = mono ? 'JetBrains Mono' : serif ? pick(['Source Sans 3', 'DM Sans', 'Inter'] as const, seed, 2) : pick(['Inter', 'DM Sans', 'Manrope'] as const, seed, 2);
  const words = corpus(spec).split(/\s+/).length / Math.max(1, spec.scenes.length);
  const design: ExplainerDesign = {
    ...base.design, fontDisplay, fontBody,
    texture: base.design.texture === 'scanlines' ? 'scanlines' : pick(dark ? ['none', 'grid', 'dots', base.design.texture] as const : ['none', 'paper', 'dots', base.design.texture] as const, seed, 3),
    motion: pick(['rise', 'drop', 'blur', 'fade'] as const, seed, 4), transition: pick(['fade', 'zoom', 'wipe', 'push'] as const, seed, 5),
    header: pick(['strip', 'rule', 'stamp', 'minimal'] as const, seed, 6), progress: pick(['segments', 'line', 'dots', 'count'] as const, seed, 7), captions: pick(['center', 'left', 'box'] as const, seed, 8),
    layout: words > 24 ? 'editorial' : words < 14 ? 'card' : base.design.layout,
  };
  return { name: look, def: { note: `made from the subject (${look} family)`, colors, design } };
}
