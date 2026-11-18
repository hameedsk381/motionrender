import { expect, it } from 'vitest';
import { directConstrainedVideo, type AiProvider } from '@ove/ai';
import { compileVideoPlan, parseVideoMarkdown } from '@ove/core';
import { sceneInputSchema, videoPlanSchema } from '@ove/schema';

const responses = () => [
  { type: 'kinetic-hook', headline: 'Stop losing requests' },
  { type: 'workflow', headline: 'Every request has a route', steps: ['Receive', 'Assign', 'Resolve'] },
  { type: 'decisive-cta', headline: 'Try one shared inbox' },
];
const providerFor = (values: unknown[]): AiProvider => ({ id: 'fixture', model: 'fixture', baseUrl: '', chat: async () => JSON.stringify(values.shift()) });

it('compiles typed workflow labels and preserves inputs through Markdown', async () => {
  const result = await directConstrainedVideo(providerFor(responses()), 'Explain a shared inbox', { durationSeconds: 15 });
  expect(result.attempts).toBe(3);
  const roundtrip = parseVideoMarkdown(result.markdown);
  expect(roundtrip.beats.map(beat => beat.visual.input)).toEqual(result.plan.beats.map(beat => beat.visual.input));
  const composition = compileVideoPlan(roundtrip).composition;
  expect(composition.scenes[0]!.layers.every(layer => layer.visible && layer.opacity > 0)).toBe(true);
  const labels = composition.scenes[1]!.layers.filter((layer: any) => layer.id.includes('node-copy')).map((layer: any) => layer.content);
  expect(labels).toEqual(['Receive', 'Assign', 'Resolve']);
  expect(composition.durationFrames).toBe(450);
});

it('repairs only the failed beat and retains previously accepted copy', async () => {
  const valid = responses();
  const result = await directConstrainedVideo(providerFor([valid[0], { type: 'workflow', headline: 'A route', steps: ['Only one'] }, valid[1], valid[2]]), 'Explain a shared inbox');
  expect(result.attempts).toBe(4);
  expect(result.plan.beats[0]!.onScreen).toBe('Stop losing requests');
});

it('rejects arbitrary code, excessive copy, and scene/input mismatches', () => {
  expect(sceneInputSchema.safeParse({ type: 'kinetic-hook', headline: 'Hello', code: 'draw()' }).success).toBe(false);
  expect(sceneInputSchema.safeParse({ type: 'kinetic-hook', headline: 'one '.repeat(10) }).success).toBe(false);
  expect(videoPlanSchema.safeParse({ id: 'x', name: 'x', brief: { prompt: 'x' }, beats: [{ id: 'a', intent: 'x', visual: { scene: 'workflow', input: { type: 'kinetic-hook', headline: 'Hello' } } }] }).success).toBe(false);
});

it('fails clearly when the reading budget exceeds the requested duration', async () => {
  await expect(directConstrainedVideo(providerFor(responses()), 'Explain a shared inbox', { durationSeconds: 2 })).rejects.toThrow(/at least/);
});

it('bounds retries rather than accepting an invalid scene', async () => {
  await expect(directConstrainedVideo(providerFor([{}, {}]), 'Explain a shared inbox', { maxAttempts: 2 })).rejects.toThrow(/hook failed after 2/);
});
