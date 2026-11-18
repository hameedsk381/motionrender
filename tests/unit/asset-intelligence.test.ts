import { describe, expect, it } from 'vitest';
import { recommendPlanAssets, reviewPlanAssets } from '@ove/core';
import { videoPlanSchema } from '@ove/schema';

const plan = () => videoPlanSchema.parse({
  id: 'assets', name: 'Asset intelligence', brief: { prompt: 'Show a calmer support workflow' },
  assets: [
    { id: 'support-ui', type: 'image', src: './support.png', status: 'approved', metadata: { tags: ['support', 'inbox', 'workflow'] }, rights: { commercialUse: 'allowed' } },
    { id: 'old-photo', type: 'image', src: './old.jpg', status: 'rejected', metadata: { tags: ['support'] }, rights: { commercialUse: 'allowed' } },
    { id: 'voice', type: 'audio', src: './voice.wav', status: 'approved' },
  ],
  beats: [{ id: 'product', intent: 'Show the support inbox workflow', durationSeconds: 3, visual: { scene: 'product-ui' } }],
});

describe('plan asset intelligence', () => {
  it('ranks approved, tagged visual media above rejected or non-visual assets', () => {
    const results = recommendPlanAssets(plan(), 'product');
    expect(results[0]).toMatchObject({ assetId: 'support-ui', usable: true });
    expect(results.find(result => result.assetId === 'old-photo')).toMatchObject({ usable: false });
    expect(results.find(result => result.assetId === 'voice')!.score).toBeLessThan(0);
  });

  it('finds selected assets that cannot be used for the beat', () => {
    const invalid = plan(); invalid.beats[0]!.visual.asset = 'voice';
    expect(reviewPlanAssets(invalid)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'asset-not-visual', beatId: 'product' }), expect.objectContaining({ code: 'scene-asset-contract', beatId: 'product' })]));
  });
});
