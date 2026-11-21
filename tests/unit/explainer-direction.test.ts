import { describe, expect, it } from 'vitest';
import { directScenes, suitableVariants } from '../../packages/core/src/explainer-direction';
import { explainerSchema } from '../../packages/schema/src/explainer';

const steps = (n: number, detail = true) => ({ kind: 'steps', items: Array.from({ length: n }, (_, k) => ({ title: `Step ${k + 1}`, ...(detail ? { detail: 'A short detail' } : {}) })) });
const script = (topic: string, scenes: object[]) => explainerSchema.parse({ topic, scenes });

describe('explainer direction', () => {
  it('offers only the drawings that suit the content', () => {
    expect(suitableVariants(script('T', [steps(5, false)]).scenes[0]!)).toEqual(['list']);
    expect(suitableVariants(script('T', [steps(3)]).scenes[0]!)).toEqual(expect.arrayContaining(['ladder', 'cards']));
    expect(suitableVariants(script('T', [{ kind: 'stat', value: '1.46 billion', label: 'people' }]).scenes[0]!)).toEqual(['stacked']);
  });

  it('offers the full-bleed drawings only where the content fits them', () => {
    const one = (scene: object) => suitableVariants(script('T', [scene]).scenes[0]!);
    expect(one({ kind: 'stat', value: '95%', label: 'of loads' })).toContain('bleed');
    expect(one({ kind: 'stat', value: '1.46 billion', label: 'people' })).not.toContain('bleed');
    expect(one({ kind: 'title', brand: 'TLS', lines: ['A', 'B', 'C'] })).toContain('bleed');
    expect(one({ kind: 'title', lines: ['How does the whole internet', 'MANAGE TO NAME EVERYTHING', 'at once?'] })).not.toContain('bleed');
    expect(one({ kind: 'compare', left: { title: 'HTTP', points: ['Readable'] }, right: { title: 'HTTPS', points: ['Private'] } })).toContain('halves');
    expect(one({ kind: 'quote', text: 'x'.repeat(130), source: 'S' })).toEqual(['pull']);
  });

  it('is deterministic, keeps a scene\'s own variant, and varies with the topic', () => {
    const scenes = [steps(3), { ...steps(3), variant: 'bento' }, { kind: 'quote', text: 'A short line.', source: 'Someone' }];
    const a = directScenes(script('How DNS works', scenes)), b = directScenes(script('How DNS works', scenes));
    expect(a).toEqual(b);
    expect((a[1] as any).variant).toBe('bento');
    const picks = new Set(['DNS', 'Caches', 'Load balancers', 'Queues', 'Indexes', 'Sharding', 'CDNs', 'TLS'].map(t => (directScenes(script(t, scenes))[0] as any).variant));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('does not repeat a drawing for the next scene of the same kind', () => {
    const out = directScenes(script('Repeat', [steps(3), steps(3), steps(3)])).map(s => (s as any).variant);
    expect(out[0]).not.toBe(out[1]); expect(out[1]).not.toBe(out[2]);
  });
});
