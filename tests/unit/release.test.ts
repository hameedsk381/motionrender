import { describe, expect, it } from 'vitest';
import { createReleaseManifest, editVideoPlan } from '@ove/core';
import { videoPlanSchema } from '@ove/schema';

const plan = () => videoPlanSchema.parse({
  id: 'launch', name: 'Launch', brief: { prompt: 'Launch', targetDurationSeconds: 3 },
  variables: { locale: { type: 'string' }, customer: { type: 'string', default: 'Acme' } },
  assets: [{ id: 'ui', type: 'image', src: './ui.png', status: 'approved', rights: { commercialUse: 'allowed' } }],
  beats: [{ id: 'product', intent: 'Show the product', durationSeconds: 3, onScreen: 'One calm workspace', visual: { scene: 'product-ui', asset: 'ui', media: 'image', direction: 'The inbox resolves into one clear surface' } }],
});

describe('release manifests', () => {
  it('blocks publication until a final approval is recorded', () => {
    const release = createReleaseManifest(plan(), { channels: ['web', 'tiktok'] });
    expect(release).toMatchObject({ status: 'blocked', delivery: { channels: ['web', 'tiktok'], variables: expect.arrayContaining([expect.objectContaining({ name: 'locale', required: true })]) } });
    expect(release.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'final-approval' })]));
  });

  it('records a final approval through the same reversible plan edit surface', () => {
    const approved = editVideoPlan(plan(), [{ op: 'set-approval', approval: { stage: 'final', approved: true, at: '2026-11-18T10:00:00Z', note: 'Checked delivery' } }]).plan;
    const release = createReleaseManifest(approved, { channels: ['web'] });
    expect(release).toMatchObject({ status: 'ready', plan: { finalApproval: { approved: true } } });
    expect(release.plan.digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
