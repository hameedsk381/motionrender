import { expect, it } from 'vitest';
import { sceneInputSchema, videoPlanSchema } from '@ove/schema';
import { compileVideoPlan, comparePlanVariety } from '@ove/core';

const plan = (layout: 'editorial' | 'poster' | 'split') => videoPlanSchema.parse({ id: 'x', name: 'x', brief: { prompt: 'Explain open source' }, beats: [{ id: 'idea', intent: 'Introduce idea', visual: { scene: 'kinetic-hook', input: { type: 'kinetic-hook', headline: 'Build together', layout, choreography: 'cascade' } } }] });
it('rejects layouts that do not belong to the scene contract', () => {
  expect(sceneInputSchema.safeParse({ type: 'workflow', headline: 'A route', steps: ['A', 'B', 'C'], layout: 'poster' }).success).toBe(false);
});
it('compiles alternate geometry instead of merely changing colours', () => {
  const a = compileVideoPlan(plan('editorial')).composition, b = compileVideoPlan(plan('poster')).composition;
  const heading = (composition: typeof a) => composition.scenes[0]!.layers.find(layer => layer.id.endsWith('-headline')) as any;
  expect(heading(a).x).not.toBe(heading(b).x);
  expect(heading(a).textAlign).not.toBe(heading(b).textAlign);
  expect(comparePlanVariety(plan('editorial'), plan('poster')).repeated).toBe(false);
});
it('changes animation timing for cascade versus reveal', () => {
  const a = plan('editorial'), b = structuredClone(a); b.beats[0]!.visual.input!.choreography = 'reveal';
  const compiledA = compileVideoPlan(a).composition, compiledB = compileVideoPlan(b).composition;
  expect(compiledA.scenes[0]!.layers[1]!.animations).not.toEqual(compiledB.scenes[0]!.layers[1]!.animations);
});
