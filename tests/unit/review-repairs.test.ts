import { describe, expect, it } from 'vitest';
import { loadComposition } from '@ove/schema';
import { proposePlanRepairs, reviewRepairTasks } from '@ove/core';

const composition = loadComposition({
  version: '1.0', id: 'reviewed', name: 'Reviewed', width: 1080, height: 1920, fps: 30, durationFrames: 120,
  scenes: [{ id: 'hook', name: 'Hook', beat: 'hook', startFrame: 0, durationFrames: 60, layers: [] }, { id: 'proof', name: 'Proof', beat: 'proof', startFrame: 60, durationFrames: 60, layers: [] }],
});

describe('review repair tasks', () => {
  it('maps visual faults to the semantic beat active at that frame', () => {
    const tasks = reviewRepairTasks(composition, [
      { severity: 'error', code: 'off-frame', message: 'Title runs off the frame', frame: 20, layer: 'title' },
      { severity: 'warning', code: 'frozen', message: 'Nothing moves', frame: 75 },
    ]);
    expect(tasks).toMatchObject([
      { category: 'layout', target: { sceneId: 'hook', beatId: 'hook', layer: 'title', frame: 20 } },
      { category: 'motion', target: { sceneId: 'proof', beatId: 'proof', frame: 75 } },
    ]);
    expect(tasks[0]?.instruction).toMatch(/preserve.*narrative intent/i);
  });

  it('turns rendered read-time findings back into a reversible beat-duration proposal', () => {
    const plan = { id: 'p', name: 'Plan', brief: { prompt: 'p' }, beats: [{ id: 'hook', intent: 'Hook', durationSeconds: 1, onScreen: 'A readable sentence needs more time on screen' }] };
    const proposals = proposePlanRepairs(plan, [{ severity: 'warning', code: 'read-time', message: 'Copy is too fast', frame: 0 }]);
    expect(proposals[0]).toMatchObject({ beatId: 'hook', automatic: false, edits: [{ op: 'update-beat', id: 'hook', changes: { durationSeconds: expect.any(Number) } }] });
    expect((proposals[0]!.edits[0] as any).changes.durationSeconds).toBeGreaterThan(1);
  });
});
