import { describe, expect, it } from 'vitest';
import { compileVideoPlan, formatVideoMarkdown, parseVideoMarkdown } from '@ove/core';

const markdown = `---
id: launch
title: Launch story
format: 9:16
duration: 6s
prompt: Explain the launch
---

> Variable customer: string = Acme
> Source [benchmark]: https://example.com/benchmark | Teams resolved requests 42% faster.

# Proof
ID: proof
Duration: 6s
Intent: Prove the outcome.
On-screen: {{customer}} resolves requests 42% faster.
Claim: Teams resolved requests 42% faster.
Source: benchmark
Visual: Calm editorial proof card.
Scene: proof-stat
`;

describe('semantic plan Markdown', () => {
  it('parses readable beat headings and typed directives into the same plan contract', () => {
    const plan = parseVideoMarkdown(markdown);
    expect(plan).toMatchObject({ id: 'launch', format: { width: 1080, height: 1920 }, variables: { customer: { type: 'string', default: 'Acme' } }, sources: [{ id: 'benchmark' }], beats: [{ id: 'proof', sourceIds: ['benchmark'], visual: { scene: 'proof-stat' } }] });
  });

  it('formats a plan back to an editable Markdown representation', () => {
    const output = formatVideoMarkdown(parseVideoMarkdown(markdown));
    expect(output).toContain('# Prove the outcome.');
    expect(output).toContain('> Variable customer: string = Acme');
    expect(output).toContain('Scene: proof-stat');
    expect(parseVideoMarkdown(output).beats[0]?.claim).toBe('Teams resolved requests 42% faster.');
  });

  it('round trips action scenes and a trusted React bundle without inline JSON', () => {
    const plans = `---
title: Three actions
format: 432x768
---
> React [custom]: ./custom.bundle.js

# Compare train stops
Scene: route
Variant: rail
- Trip: Express | Central → Harbor
- Trip: Local | Central -> Market -> Harbor
Arrival: Express arrival | Express → Harbor

# Water both beds
Scene: split
Origin: Tap
Branch: Herbs | down-left
Branch: Tomatoes | down-right

# Close the booklet
Scene: fold
Variant: booklet
Inside: Ensemble
Cover: Night Shift

# End card
Module: custom
On-screen: Finished
`;
    const plan = parseVideoMarkdown(plans);
    expect(plan.beats[0]!.visual.input).toMatchObject({ stops: ['Central', 'Harbor', 'Market'], trips: [{ via: ['Central', 'Harbor'] }, { via: ['Central', 'Market', 'Harbor'] }] });
    expect(plan.format).toMatchObject({ width: 432, height: 768 });
    const output = formatVideoMarkdown(plan);
    expect(output).not.toContain('Scene-input:');
    expect(parseVideoMarkdown(output)).toEqual(plan);
    const { composition } = compileVideoPlan(plan);
    expect(composition.scenes.map(scene => scene.layers.some(layer => layer.type === 'react'))).toEqual([false, false, false, true]);
  });

  it('points at the beat when an action line is malformed', () => {
    expect(() => parseVideoMarkdown('# Compare trains\nScene: route\nTrip: Express Central → Harbor\n'))
      .toThrow('Beat "Compare trains": Trip needs a name | Stop → Stop');
  });

  it('uses plain copy directives for a workflow and a before-and-after comparison', () => {
    const plan = parseVideoMarkdown('# A request\nScene: workflow\nStep: Send\nStep: Check\nStep: Reply\n\n# Compare outcomes\nScene: before-after\nBefore: Manual review\nAfter: Automatic routing\n');
    expect(plan.beats.map(beat => beat.visual.input)).toMatchObject([
      { type: 'workflow', steps: ['Send', 'Check', 'Reply'] },
      { type: 'before-after', before: 'Manual review', after: 'Automatic routing' },
    ]);
    expect(parseVideoMarkdown(formatVideoMarkdown(plan))).toEqual(plan);
  });
});
