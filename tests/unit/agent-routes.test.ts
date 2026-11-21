import { describe, expect, it } from 'vitest';
import { agentInstructions } from '../../packages/cli/src/agent-setup';

// The generated agent instructions put the code-first route first, because a layout made for the content is what a topic video needs.
describe('agent instructions: the routes', () => {
  const text = agentInstructions();
  const at = (needle: string) => text.indexOf(needle);

  it('lists code first, then the explainer, then the composition', () => {
    expect(at('1. **Code (the default')).toBeGreaterThan(-1);
    expect(at('1. **Code (the default')).toBeLessThan(at('2. **Explainer**'));
    expect(at('2. **Explainer**')).toBeLessThan(at('3. **Composition**'));
  });

  it('tells the agent to take the layout, colours and type from the content', () => {
    expect(text).toMatch(/Let the content decide the layout, the colours and the type/);
    expect(text).toMatch(/must not share a page structure/);
    expect(text).toMatch(/mr init <dir>/);
  });

  it('says the explainer shares one scene library, and that the code route can be narrated with mr voice', () => {
    expect(text).toMatch(/every video shares the same scene library/);
    expect(text).toMatch(/mr voice/);
    expect(text).toMatch(/Captions/);
  });
});
