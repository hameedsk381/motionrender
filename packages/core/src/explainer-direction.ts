// Art direction for an explainer script: where the author left a scene's drawing to "auto", the content decides which of the drawings that fit it
// is used, and when several fit, the choice is varied by a seed from the topic, so two videos on different subjects do not share one skeleton.
// Deterministic: the same script always compiles to the same video. A scene's own `variant` is never changed.
import type { Explainer, ExplainerScene } from '@ove/schema';

const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const longest = (items: string[]) => Math.max(0, ...items.map(item => item.length));

/** The drawings that suit this scene's content (the ones the view would not clip or crowd), best first. Empty when the kind has one drawing or the view should choose. */
export function suitableVariants(scene: ExplainerScene): string[] {
  const s = scene as any;
  switch (scene.kind) {
    case 'title': return s.lines.length >= 3 || longest(s.lines) > 22 ? ['poster'] : ['poster', 'centred'];
    case 'compare': {
      const sides = [s.left, s.right], points = sides.flatMap((x: any) => x.points as string[]), total = points.length;
      if (longest(points) > 34 || total >= 7) return ['stacked'];
      return sides.every((x: any) => x.title.length <= 14 && x.points.length <= 2) ? ['split', 'versus'] : ['split'];
    }
    case 'steps': {
      const n = s.items.length, detail = s.items.some((i: any) => i.detail);
      return [n >= 3 ? 'list' : '', detail && n <= 4 ? 'ladder' : '', n <= 3 ? 'cards' : '', n >= 2 && n <= 4 ? 'bento' : ''].filter(Boolean);
    }
    case 'stat': {
      const value = String(s.value);
      return /%/.test(value) ? ['ring', 'hero', 'stacked'].filter(v => v !== 'hero' || value.length <= 4) : value.length <= 4 ? ['hero', 'stacked'] : ['stacked'];
    }
    case 'quote': return String(s.text).length > 120 ? ['pull'] : ['card', 'pull'];
    case 'closing': return s.points?.length ? ['takeaway', 'poster'] : ['poster'];
    case 'chart': return s.type === 'line' ? ['line'] : s.items.length >= 6 || longest(s.items.map((i: any) => i.label)) > 9 ? ['rows'] : ['columns', 'rows'];
    case 'timeline': return s.events.length <= 4 && s.events.every((e: any) => e.title.length <= 28 && !e.detail) ? ['zigzag', 'spine'] : ['spine'];
    case 'media': return s.title && s.caption ? ['frame', 'split'] : ['frame'];
    default: return [];
  }
}

/** Fills each scene's missing `variant` with one of the drawings that suit it, varied by the topic, and never the same as the neighbouring scene of the same kind. */
export function directScenes(spec: Explainer): ExplainerScene[] {
  const lastOfKind = new Map<string, string>();
  return spec.scenes.map((scene, i) => {
    const s = scene as ExplainerScene & { variant?: string };
    const options = suitableVariants(scene);
    let pick = s.variant;
    if (!pick && options.length) {
      const previous = lastOfKind.get(scene.kind);
      const fresh = options.filter(option => option !== previous);
      const pool = fresh.length ? fresh : options;
      pick = pool[hash(`${spec.topic}|${scene.kind}|${i}`) % pool.length];
    }
    if (pick) lastOfKind.set(scene.kind, pick);
    return pick && pick !== s.variant ? { ...scene, variant: pick } as ExplainerScene : scene;
  });
}
