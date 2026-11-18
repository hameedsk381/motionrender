import { describe, expect, it } from 'vitest';
import { formatVideoMarkdown, parseVideoMarkdown } from '@ove/core';

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
});
