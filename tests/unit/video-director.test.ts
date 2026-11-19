import { describe, expect, it } from 'vitest';
import { directVideoPlan, type AiProvider } from '@ove/ai';

describe('semantic video director', () => {
  it('repairs a schema-valid plan when semantic review finds unfinished visual direction', async () => {
    const replies = [
      '# Make the old workflow feel expensive\nID: hook\nDuration: 3s\nOn-screen: Support should not be a scavenger hunt.',
      '# Make the old workflow feel expensive\nID: hook\nDuration: 3s\nOn-screen: Support should not be a scavenger hunt.\nVisual: A stack of tickets collapses into one calm inbox.\n\n# Invite the next step\nID: close\nDuration: 2s\nOn-screen: One place. Every answer.\nVisual: The inbox resolves into a single clear CTA.',
    ];
    const provider: AiProvider = { id: 'test', model: 'test', baseUrl: '', chat: async (messages, options) => {
      expect(messages[0]!.content).toContain('Reply in Markdown only');
      expect(options?.json).toBeUndefined();
      return replies.shift()!;
    } };
    const result = await directVideoPlan(provider, 'Launch a better support inbox', { durationSeconds: 5, width: 1080, height: 1920 });
    expect(result.attempts).toBe(2);
    expect(result.plan.beats.map(beat => beat.id)).toEqual(['hook', 'close']);
    expect(result.markdown).toContain('# Make the old workflow feel expensive');
    expect(result.review.filter(issue => issue.severity === 'warning')).toEqual([]);
    expect(result.plan.format).toMatchObject({ width: 1080, height: 1920 });
  });

  it('rejects invented factual claims instead of accepting them into a plan', async () => {
    const replies = ['# Prove value\nID: proof\nDuration: 3s\nClaim: It saves 99% of time'];
    const provider: AiProvider = { id: 'test', model: 'test', baseUrl: '', chat: async () => replies.shift()! };
    await expect(directVideoPlan(provider, 'Show value', { maxAttempts: 1 })).rejects.toThrow(/cites no source/);
  });
});
