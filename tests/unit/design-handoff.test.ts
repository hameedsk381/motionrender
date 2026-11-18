import { expect, it } from 'vitest';
import { videoPlanSchema } from '@ove/schema';
import { compileVideoPlan, formatVideoMarkdown, parseVideoMarkdown } from '@ove/core';

const input = () => ({ id: 'community', name: 'Community', brief: { prompt: 'One contribution becomes a community' }, beats: [{ id: 'seed', intent: 'Start with one contribution', onScreen: 'One contribution', visual: { scene: 'kinetic-hook' } }, { id: 'network', intent: 'Show the community', onScreen: 'Build together', visual: { scene: 'decisive-cta' } }], design: { concept: 'One contribution becomes a community', visualMetaphor: 'A seed grows into a connected network', motif: 'Contributor nodes and connecting paths', typography: { display: 'Inter', body: 'Inter', treatment: 'Strong hierarchy with short phrases' }, motion: 'Connections grow from one contributor outward', avoid: ['Identical cards'], acts: [{ id: 'begin', purpose: 'Introduce a contribution', beatIds: ['seed'], field: '#ffffff', ink: '#102030', accent: '#005ca8' }, { id: 'resolve', purpose: 'Invite participation', beatIds: ['network'], field: '#005ca8', ink: '#ffffff', accent: '#e4efcb' }] } });

it('retains the creative handoff across the portable Markdown format', () => {
  const plan = videoPlanSchema.parse(input());
  expect(parseVideoMarkdown(formatVideoMarkdown(plan)).design).toEqual(plan.design);
});

it('applies narrative act fields and inks without changing the copy', () => {
  const result = compileVideoPlan(input()).composition;
  expect(result.scenes.map(scene => (scene.layers.find(layer => layer.id.startsWith('design-field:')) as any).fill)).toEqual(['#ffffff', '#005ca8']);
  expect((result.scenes[0]!.layers.find(layer => layer.id === 'seed-headline') as any).color).toBe('#102030');
  expect((result.scenes[1]!.layers.find(layer => layer.id === 'network-cta') as any).content).toBe('Build together');
});

it('rejects missing, repeated and nonexistent beat assignments', () => {
  const missing = input(); missing.design.acts.pop(); expect(videoPlanSchema.safeParse(missing).success).toBe(false);
  const duplicate = input(); duplicate.design.acts[1]!.beatIds.push('seed'); expect(videoPlanSchema.safeParse(duplicate).success).toBe(false);
  const unknown = input(); unknown.design.acts[0]!.beatIds.push('absent'); expect(videoPlanSchema.safeParse(unknown).success).toBe(false);
});
