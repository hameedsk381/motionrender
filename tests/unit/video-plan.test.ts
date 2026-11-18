import { describe, expect, it } from 'vitest';
import { videoPlanSchema } from '@ove/schema';
import { compileVideoPlan, diffVideoPlans, editVideoPlan, reviewVideoPlan, videoPlanSummary } from '@ove/core';

const plan = (extra: Record<string, unknown> = {}) => videoPlanSchema.parse({
  version: '1.0', kind: 'video-plan', id: 'launch', name: 'Launch story',
  brief: { prompt: 'Show why the product is faster', audience: 'operators' },
  beats: [
    { id: 'hook', intent: 'Establish the old painful workflow', durationSeconds: 2, onScreen: 'Too many tabs', narration: 'Work should not be this fragmented.' },
    { id: 'proof', intent: 'Prove the product workflow', durationSeconds: 3, visual: { asset: 'dashboard', media: 'image', transition: 'fade' } },
  ],
  assets: [{ id: 'dashboard', type: 'image', src: './dashboard.png' }],
  ...extra,
});

describe('semantic video plans', () => {
  it('keeps narrative intent separate from the rendered composition', () => {
    const built = compileVideoPlan(plan());
    expect(built.production.shots.map(shot => shot.action)).toEqual(['Establish the old painful workflow', 'Prove the product workflow']);
    expect(built.composition.scenes.map(scene => [scene.id, scene.durationFrames])).toEqual([['hook', 60], ['proof', 90]]);
    expect(built.composition.scenes[0]?.layers[0]).toMatchObject({ type: 'text', content: 'Too many tabs' });
    expect(built.composition.scenes[1]?.layers[0]).toMatchObject({ type: 'image', src: 'dashboard' });
    expect(built.composition.scenes[1]?.transitionIn).toMatchObject({ type: 'fade' });
  });

  it('compiles a selected semantic scene into editable visual primitives', () => {
    const built = compileVideoPlan(plan({ beats: [{ id: 'contrast', intent: 'Show the old and new workflow', durationSeconds: 4, onScreen: 'Too many tabs / One workspace', visual: { scene: 'before-after', direction: 'Messy work resolves into one calm surface' } }] }));
    const layers = built.composition.scenes[0]!.layers as any[];
    expect(layers.map(layer => layer.type)).toEqual(expect.arrayContaining(['rect', 'text']));
    expect(layers.map(layer => layer.id)).toEqual(expect.arrayContaining(['contrast-before-card', 'contrast-after-card']));
    expect(built.notes.join('\n')).toMatch(/before\/after contrast/);
  });

  it('keeps an approved media asset beneath a compiled semantic scene', () => {
    const built = compileVideoPlan(plan({ beats: [{ id: 'workflow', intent: 'Show the system', durationSeconds: 4, onScreen: 'Input to outcome', visual: { scene: 'workflow', asset: 'dashboard', media: 'image', direction: 'Three stages connect' } }] }));
    expect((built.composition.scenes[0]!.layers as any[]).map(layer => layer.type)).toContain('image');
    expect((built.composition.scenes[0]!.layers as any[]).map(layer => layer.id)).toContain('workflow-node-1');
  });

  it('reports duration and unfinished visual placeholders before a render exists', () => {
    expect(videoPlanSummary(plan())).toEqual({ beats: 2, seconds: 5, placeholders: 1 });
  });

  it('rejects a declared asset used as the wrong media type', () => {
    expect(() => plan({ beats: [{ id: 'x', intent: 'x', visual: { asset: 'dashboard', media: 'video' } }] })).toThrow(/asks for video/);
  });

  it('compiles a reusable scene module into a deterministic full-scene React layer', () => {
    const built = compileVideoPlan(plan({
      sceneModules: [{ id: 'product-proof', src: './product-proof.bundle.js', assets: ['dashboard'], props: { theme: 'midnight' } }],
      beats: [{ id: 'proof', intent: 'Prove the workflow', durationSeconds: 4, onScreen: 'One workspace', visual: { module: 'product-proof', props: { metric: '42%' } } }],
    }));
    expect(built.composition.scenes[0]?.layers[0]).toMatchObject({ type: 'react', src: './product-proof.bundle.js', x: 0, y: 0, durationInFrames: 120 });
    expect((built.composition.scenes[0]?.layers[0] as any).props).toMatchObject({ theme: 'midnight', metric: '42%', beat: { intent: 'Prove the workflow' }, assets: { dashboard: './dashboard.png' } });
    expect(built.notes.join('\n')).toMatch(/render with --allow-code/);
  });

  it('rejects a beat that refers to an unknown scene module', () => {
    expect(() => plan({ beats: [{ id: 'x', intent: 'x', visual: { module: 'missing' } }] })).toThrow(/which is not in sceneModules/);
  });

  it('edits beats by their narrative ids and reports the semantic diff', () => {
    const result = editVideoPlan(plan(), [
      { op: 'update-beat', id: 'hook', changes: { onScreen: 'One calm workspace', durationSeconds: 2.5 } },
      { op: 'move-beat', id: 'proof' },
      { op: 'insert-beat', after: 'proof', beat: { id: 'cta', intent: 'Ask for the next step', onScreen: 'Try it today', durationSeconds: 2 } },
    ]);
    expect(result.plan.beats.map(beat => beat.id)).toEqual(['proof', 'cta', 'hook']);
    expect(result.plan.beats.find(beat => beat.id === 'hook')?.onScreen).toBe('One calm workspace');
    expect(result.changes.map(change => change.op)).toEqual(['update-beat', 'move-beat', 'insert-beat']);
  });

  it('refuses an edit that would leave no beats', () => {
    const one = plan({ beats: [{ id: 'only', intent: 'The only beat' }] });
    expect(() => editVideoPlan(one, [{ op: 'remove-beat', id: 'only' }])).toThrow(/beats/);
  });

  it('carries cited factual claims into the canonical content script', () => {
    const cited = plan({
      sources: [{ id: 'study', title: 'Support benchmark', url: 'https://example.com/study', quote: 'Teams using one workspace resolved tickets 42% faster.' }],
      beats: [{ id: 'proof', intent: 'Prove the result', onScreen: '42% faster', claim: 'Teams resolved tickets 42% faster.', sourceIds: ['study'], data: [{ label: 'Resolution speed', value: 42, unit: '%', sourceIds: ['study'] }] }],
    });
    const built = compileVideoPlan(cited);
    expect(built.composition.content).toMatchObject({ sources: [{ id: 'study' }], beats: [{ id: 'proof', claim: 'Teams resolved tickets 42% faster.', sourceIds: ['study'], data: [{ value: 42 }] }] });
  });

  it('refuses unsupported factual claims before compilation', () => {
    expect(() => plan({ beats: [{ id: 'proof', intent: 'Prove the result', claim: 'A factual claim' }] })).toThrow(/cites no source/);
  });

  it('reports semantic and timing impact before recompiling', () => {
    const before = plan();
    const after = editVideoPlan(before, [{ op: 'update-beat', id: 'hook', changes: { durationSeconds: 4, onScreen: 'One workspace' } }, { op: 'move-beat', id: 'proof' }]).plan;
    const diff = diffVideoPlans(before, after);
    expect(diff).toMatchObject({ moved: expect.arrayContaining(['proof']), changed: [{ id: 'hook', fields: expect.arrayContaining(['durationSeconds', 'onScreen']) }], durationBefore: 5, durationAfter: 7 });
  });

  it('finds narrative problems before a render is attempted', () => {
    const reviewed = reviewVideoPlan(plan({
      brief: { prompt: 'p', targetDurationSeconds: 10 },
      beats: [{ id: 'hook', intent: 'A deliberately very long on screen sentence with too little time', durationSeconds: 1, narration: 'This narration is also far too long for one second of video.' }],
    }));
    expect(reviewed.map(issue => issue.code)).toEqual(expect.arrayContaining(['duration-target', 'implicit-copy', 'visual-placeholder', 'copy-read-time', 'voice-speed']));
  });

  it('passes typed personalization variables to the compiled composition', () => {
    const built = compileVideoPlan(plan({
      variables: { customer: { type: 'string', default: 'Acme' }, discount: { type: 'number', default: 20 } },
      beats: [{ id: 'offer', intent: 'Make the offer', onScreen: '{{customer}} saves {{discount}}%' }],
    }));
    expect(built.composition.variables).toMatchObject({ customer: { type: 'string', default: 'Acme' }, discount: { type: 'number', default: 20 } });
    expect(built.composition.content?.beats[0]?.onScreen).toBe('{{customer}} saves {{discount}}%');
  });
});
