import { describe, expect, it } from 'vitest';
import { explainerLookDefs, explainerLooks } from '../../packages/schema/src/explainer-looks';
import { compileExplainer } from '../../packages/core/src/explainer';
import { explainerSchema } from '../../packages/schema/src/explainer';

// The frame around every scene (header, progress, captions) is part of the look, so two videos do not share one skeleton.
const script = (look: string, design?: object) => explainerSchema.parse({ topic: 'DNS lookup', look, design, scenes: [{ kind: 'title', lines: ['How does a', 'NAME', 'work?'] }, { kind: 'closing', title: 'Done', points: ['One'], cta: 'Follow' }] });
const ids = (look: string, design?: object) => { const c: any = compileExplainer(script(look, design)).composition; return { overlay: c.overlay.map((l: any) => l.id), scene: c.scenes[0].layers.map((l: any) => l.id) }; };

describe('explainer chrome', () => {
  it('gives the looks more than one header, progress and caption style', () => {
    const defs = explainerLooks.map(look => explainerLookDefs[look].design);
    for (const key of ['header', 'progress', 'captions'] as const) expect(new Set(defs.map(d => d[key])).size).toBeGreaterThan(2);
    expect(new Set(defs.map(d => `${d.header}/${d.progress}/${d.captions}`)).size).toBeGreaterThan(8);
  });

  it('draws the header by look', () => {
    expect(ids('navy').overlay).toContain('header-kind');
    expect(ids('paper').overlay).toContain('header-rule');
    expect(ids('ink').overlay).toContain('header-tag');
    expect(ids('forest').overlay).toEqual(['header-topic']);
  });

  it('draws the progress by look, and a script can override it', () => {
    expect(ids('navy').scene.filter((id: string) => id.startsWith('chapter-')).length).toBeGreaterThan(3);
    expect(ids('ink').scene).toContain('chapter-track');
    expect(ids('terminal').scene.filter((id: string) => id.startsWith('chapter')).sort()).toEqual(['chapter-count']);
    expect(ids('navy', { progress: 'line' }).scene).toContain('chapter-track');
  });
});
