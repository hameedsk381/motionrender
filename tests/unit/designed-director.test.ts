import { expect, it } from 'vitest';
import { directDesignedVideo, type AiProvider } from '@ove/ai';
import { comparePlanVariety } from '@ove/core';

const story = () => ({ design: { concept: 'A contribution connects a community', visualMetaphor: 'Connections grow outward', motif: 'Contributor paths', typography: { display: 'Inter', body: 'Inter', treatment: 'Short phrases' }, motion: 'Follow connections', avoid: [], acts: [{ id: 'journey', purpose: 'Show participation', beatIds: ['invite', 'participate'], field: '#ffffff', ink: '#102030' }] }, beats: [{ id: 'invite', intent: 'Invite participation', scene: 'decisive-cta' }, { id: 'participate', intent: 'Explain participation', scene: 'workflow' }] });
const provider = (values: unknown[]): AiProvider => ({ id: 'fixture', model: 'fixture', baseUrl: '', chat: async () => { const value = values.shift(); return typeof value === 'string' ? value : JSON.stringify(value); } });
const inputs = () => [{ type: 'decisive-cta', headline: 'Join the community', layout: 'corner', choreography: 'reveal' }, { type: 'workflow', headline: 'Contribute together', steps: ['Connect', 'Learn', 'Contribute'], layout: 'radial', choreography: 'trace' }];

it('uses model-directed sequence and beat IDs rather than fixed roles', async () => {
  const result = await directDesignedVideo(provider([story(), ...inputs()]), 'Build an open-source community');
  expect(result.plan.beats.map(beat => beat.id)).toEqual(['invite', 'participate']);
  expect(result.plan.beats.map(beat => beat.visual.scene)).toEqual(['decisive-cta', 'workflow']);
  expect(result.plan.design?.concept).toBe('A contribution connects a community');
  expect(result.attempts).toBe(3);
});

it('repairs malformed direction before generating scene inputs', async () => {
  const result = await directDesignedVideo(provider(['not json', story(), ...inputs()]), 'Community promo');
  expect(result.attempts).toBe(4);
});

it('flags palette-only variants as structurally repeated', async () => {
  const first = (await directDesignedVideo(provider([story(), ...inputs()]), 'Community promo')).plan;
  const second = structuredClone(first); second.name = 'New copy'; second.design!.acts[0]!.field = '#eeeeee'; second.beats[0]!.onScreen = 'Different words';
  expect(comparePlanVariety(first, second)).toMatchObject({ similarity: 1, repeated: true });
  const result = await directDesignedVideo(provider([story(), ...inputs()]), 'Another community promo', { previousPlans: [first] });
  expect(result.review.some(issue => issue.code === 'repeated-structure')).toBe(true);
});
