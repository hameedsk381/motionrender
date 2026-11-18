import { describe, expect, it } from 'vitest';
import { directVideoPlan, type AiProvider } from '@ove/ai';

describe('semantic video director', () => {
  it('repairs a schema-valid plan when semantic review finds unfinished visual direction', async () => {
    const replies = [
      JSON.stringify({ id: 'launch', name: 'Launch', brief: { prompt: 'Launch a better support inbox' }, beats: [{ id: 'hook', intent: 'Make the old workflow feel expensive', durationSeconds: 3, onScreen: 'Support should not be a scavenger hunt.' }] }),
      JSON.stringify({ id: 'launch', name: 'Launch', brief: { prompt: 'Launch a better support inbox' }, beats: [{ id: 'hook', intent: 'Make the old workflow feel expensive', durationSeconds: 3, onScreen: 'Support should not be a scavenger hunt.', visual: { direction: 'A stack of tickets collapses into one calm inbox.' } }, { id: 'close', intent: 'Invite the next step', durationSeconds: 2, onScreen: 'One place. Every answer.', visual: { direction: 'The inbox resolves into a single clear CTA.' } }] }),
    ];
    const provider: AiProvider = { id: 'test', model: 'test', baseUrl: '', chat: async () => replies.shift()! };
    const result = await directVideoPlan(provider, 'Launch a better support inbox', { durationSeconds: 5 });
    expect(result.attempts).toBe(2);
    expect(result.plan.beats.map(beat => beat.id)).toEqual(['hook', 'close']);
    expect(result.markdown).toContain('# Make the old workflow feel expensive');
    expect(result.review.filter(issue => issue.severity === 'warning')).toEqual([]);
  });

  it('rejects invented factual claims instead of accepting them into a plan', async () => {
    const replies = [JSON.stringify({ id: 'claim', name: 'Claim', beats: [{ id: 'proof', intent: 'Prove value', durationSeconds: 3, claim: 'It saves 99% of time' }] })];
    const provider: AiProvider = { id: 'test', model: 'test', baseUrl: '', chat: async () => replies.shift()! };
    await expect(directVideoPlan(provider, 'Show value', { maxAttempts: 1 })).rejects.toThrow(/cites no source/);
  });
});
