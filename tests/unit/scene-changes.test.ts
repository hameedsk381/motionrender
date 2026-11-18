import { expect, it } from 'vitest';
import { compileVideoPlan, sceneChangeManifest } from '@ove/core';

const build = () => compileVideoPlan({ id: 'test', name: 'Test', brief: { prompt: 'Explain a workflow' }, beats: [{ id: 'a', intent: 'Hook', onScreen: 'Hello', durationSeconds: 3 }, { id: 'b', intent: 'Finish', onScreen: 'Goodbye', durationSeconds: 3 }] }).composition;

it('invalidates only the edited scene for a local copy change', () => {
  const before = build(), after = structuredClone(before);
  (after.scenes[0]!.layers[0] as any).content = 'Updated';
  expect(sceneChangeManifest(before, after).scenes.map(scene => scene.status)).toEqual(['changed', 'unchanged']);
});

it('invalidates scenes when global rendering dependencies change', () => {
  const before = build(), after = structuredClone(before);
  after.width = 720;
  expect(sceneChangeManifest(before, after).scenes.every(scene => scene.status === 'changed')).toBe(true);
});

it('reports removal and treats an identical compilation as unchanged', () => {
  const before = build(), after = build();
  expect(sceneChangeManifest(before, after).scenes.every(scene => scene.status === 'unchanged')).toBe(true);
  after.scenes.pop();
  expect(sceneChangeManifest(before, after).removed).toEqual(['b']);
});
