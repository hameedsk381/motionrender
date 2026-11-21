import { describe, expect, it } from 'vitest';
import { autoLook, contrastRatio, moodOf } from '../../packages/core/src/explainer-auto-look';
import { compileExplainer } from '../../packages/core/src/explainer';
import { explainerSchema } from '../../packages/schema/src/explainer';

// With look "auto" (the default) the design is made from what the script is about, not taken from one of thirteen fixed boards.
const script = (topic: string, text: string, extra: object = {}) => explainerSchema.parse({ topic, scenes: [{ kind: 'title', lines: [text] }, { kind: 'closing', title: text, points: [text] }], ...extra });

describe('auto look', () => {
  it('is the default', () => expect(script('X', 'y').look).toBe('auto'));

  it('points a subject at the family its words suggest', () => {
    expect(moodOf(script('How a bill becomes law', 'Senate and house vote')).look).toBe('newsprint');
    expect(moodOf(script('Password hashing', 'Security, encryption')).look).toBe('terminal');
    expect(moodOf(script('Forests', 'Climate, trees, carbon')).look).toBe('forest');
  });

  it('gives different subjects different colours and frames, the same subject the same look', () => {
    const a = autoLook(script('How a bill becomes law', 'senate vote')), b = autoLook(script('Forests and carbon', 'trees climate'));
    expect(a.def.colors.bg).not.toBe(b.def.colors.bg);
    expect(autoLook(script('How a bill becomes law', 'senate vote'))).toEqual(a);
    const frames = new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map(t => { const d = autoLook(script(t, 'a topic')).def.design; return `${d.header}/${d.progress}/${d.captions}/${d.motion}`; }));
    expect(frames.size).toBeGreaterThan(3);
  });

  it('keeps the accent readable on the board', () => {
    for (const topic of ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']) {
      const { colors } = autoLook(script(topic, 'security news climate')).def;
      expect(contrastRatio(colors.accent, colors.bg), topic).toBeGreaterThanOrEqual(3);
    }
  });

  it('compiles with the made look, and a named look still wins', () => {
    const auto = compileExplainer(script('How a bill becomes law', 'senate vote')).composition as any;
    const fixed = compileExplainer(script('How a bill becomes law', 'senate vote', { look: 'navy' })).composition as any;
    expect(auto.variables.bg.default).not.toBe(fixed.variables.bg.default);
    expect(fixed.variables.bg.default).toBe('#0b1c3f');
  });
});
