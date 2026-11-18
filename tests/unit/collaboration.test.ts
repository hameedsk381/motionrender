import { describe, expect, it } from 'vitest';
import { editVideoPlan, planCollaborationStatus } from '@ove/core';
import { videoPlanSchema } from '@ove/schema';

const plan = () => videoPlanSchema.parse({ id: 'review', name: 'Review', brief: { prompt: 'Review' }, beats: [{ id: 'hook', intent: 'Hook', durationSeconds: 3, onScreen: 'Hello' }] });

describe('plan collaboration', () => {
  it('keeps beat comments and approval decisions as auditable plan state', () => {
    const commented = editVideoPlan(plan(), [{ op: 'add-comment', comment: { id: 'c1', beatId: 'hook', body: 'Can we make the opening more concrete?', author: 'Maya', createdAt: '2026-11-18T10:00:00Z' } }, { op: 'set-approval', approval: { stage: 'script', approved: true, at: '2026-11-18T10:01:00Z' } }]).plan;
    const resolved = editVideoPlan(commented, [{ op: 'resolve-comment', id: 'c1', resolvedAt: '2026-11-18T10:02:00Z', resolvedBy: 'Sam' }, { op: 'set-approval', approval: { stage: 'script', approved: false, at: '2026-11-18T10:03:00Z', note: 'Needs revised opening' } }]).plan;
    const status = planCollaborationStatus(resolved);
    expect(status.comments).toMatchObject({ open: 0, resolved: 1, byBeat: {} });
    expect(status.approvals).toMatchObject({ current: [{ stage: 'script', approved: false }], history: [{ stage: 'script', approved: true }, { stage: 'script', approved: false }] });
  });
});
