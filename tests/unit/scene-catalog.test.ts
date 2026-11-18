import { describe, expect, it } from 'vitest';
import { recommendScenes, reviewVideoPlan } from '@ove/core';

describe('semantic scene catalog', () => {
  it('recommends a concrete scene shape with explainable reasons', () => {
    const [first] = recommendScenes({ intent: 'Compare the old workflow before and after', onScreen: 'Before / after' });
    expect(first?.id).toBe('before-after');
    expect(first?.reasons.join(' ')).toContain('before');
  });

  it('checks a selected scene against its declared input contract', () => {
    const issues = reviewVideoPlan({ id: 'proof', name: 'Proof', brief: { prompt: 'Prove it' }, beats: [{ id: 'stat', intent: 'Prove the outcome', durationSeconds: 3, visual: { scene: 'proof-stat' } }] });
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'scene-contract', beatId: 'stat' })]));
  });

  it('warns when a plan names an unavailable scene', () => {
    const issues = reviewVideoPlan({ id: 'unknown', name: 'Unknown', brief: { prompt: 'x' }, beats: [{ id: 'beat', intent: 'x', durationSeconds: 3, visual: { scene: 'made-up' } }] });
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknown-scene' })]));
  });
});
