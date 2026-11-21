import { describe, expect, it } from 'vitest';
import { checkMotionAssertions, motionFrames, parseMotionAssertions } from '../../packages/core/src/motion-assertions';

// Motion assertions are requirements about a video's own timeline. These judge them on made-up frames (one text per frame at chosen places) with no browser.
const fps = 30, W = 100, H = 200, frames = [0, 15, 30, 45, 60, 75, 90];
const note = (text: string, x0: number, alpha = 1) => ({ id: text, kind: 'text', text, words: 2, x0, y0: 50, x1: x0 + 40, y1: 80, size: 30, baseSize: 30, alpha, color: '#000', truncated: false, shrunk: false }) as any;
const at = (list: Record<number, any[]>) => frames.map(f => ({ texts: list[f] ?? [] }));
const check = (assertions: any[], reports: { texts: any[] }[], change = frames.slice(1).map(() => 5)) => checkMotionAssertions(parseMotionAssertions({ assertions }), reports, frames, change, fps, W, H);

describe('parseMotionAssertions', () => {
  it('reads the four assertions', () => {
    expect(parseMotionAssertions({ assertions: [{ appearsBy: { text: 'A', seconds: 1 } }, { appearsBy: { text: 'A', frame: 20 } }, { before: { first: 'A', then: 'B' } }, { staysInFrame: { text: 'A', to: 3 } }, { keepsMoving: { from: 1, every: 2 } }] })).toHaveLength(5);
  });
  it('says which assertion is wrong and why', () => {
    expect(() => parseMotionAssertions({})).toThrow(/\{ "assertions": \[/);
    expect(() => parseMotionAssertions({ assertions: [{ appearsBy: { text: 'A' } }] })).toThrow(/motion assertion 1: appearsBy needs either "seconds" or "frame"/);
    expect(() => parseMotionAssertions({ assertions: [{ appearsBy: { text: 'A', seconds: 1, frame: 3 } }] })).toThrow(/not both/);
    expect(() => parseMotionAssertions({ assertions: [{ before: { first: 'A' } }] })).toThrow(/before needs "first" and "then"/);
    expect(() => parseMotionAssertions({ assertions: [{ keepsMoving: { every: -1 } }] })).toThrow(/"every" is a time in seconds/);
    expect(() => parseMotionAssertions({ assertions: [{ appearsBy: { text: 'A', seconds: 1 }, before: { first: 'A', then: 'B' } }] })).toThrow(/exactly one of/);
    expect(() => parseMotionAssertions({ assertions: [{ bounces: {} }] })).toThrow(/"bounces" is not an assertion/);
  });
  it('asks for the frame an appearsBy deadline falls on', () => { expect(motionFrames(parseMotionAssertions({ assertions: [{ appearsBy: { text: 'A', seconds: 1 } }, { appearsBy: { text: 'B', frame: 12 } }, { keepsMoving: {} }] }), fps, 90)).toEqual([30, 12]); });
});

describe('checkMotionAssertions', () => {
  const title = at({ 30: [note('Solar got cheap', 10)], 45: [note('Solar got cheap', 10)], 60: [note('Solar got cheap', 10)] });
  it('appearsBy: passes when the text is in view by the deadline, fails when it is late or never there', () => {
    expect(check([{ appearsBy: { text: 'solar got', seconds: 1 } }], title)).toEqual([]);
    expect(check([{ appearsBy: { text: 'Solar got cheap', seconds: 0.5 } }], title)[0]).toMatchObject({ code: 'motion-appears-by', frame: 30, message: expect.stringMatching(/must be in view by 0\.5 s but first is at 1\.0 s/) });
    expect(check([{ appearsBy: { text: 'Nothing here', seconds: 1 } }], title)[0]!.message).toMatch(/is never in view/);
  });
  it('appearsBy: text that is faded, covered or outside the frame is not in view', () => {
    expect(check([{ appearsBy: { text: 'T', seconds: 2 } }], at({ 30: [note('T', 10, 0.4)] }))).toHaveLength(1);
    expect(check([{ appearsBy: { text: 'T', seconds: 2 } }], at({ 30: [{ ...note('T', 10), occluded: true }] }))).toHaveLength(1);
    expect(check([{ appearsBy: { text: 'T', seconds: 2 } }], at({ 30: [note('T', 80)] }))).toHaveLength(1);   // 80 + 40 > 100 wide
  });
  it('before: one text first, then the other', () => {
    const order = at({ 15: [note('Question', 10)], 45: [note('Answer', 10)] });
    expect(check([{ before: { first: 'Question', then: 'Answer' } }], order)).toEqual([]);
    expect(check([{ before: { first: 'Answer', then: 'Question' } }], order)[0]!.message).toMatch(/"Answer" must come before "Question"/);
    expect(check([{ before: { first: 'Question', then: 'Missing' } }], order)[0]!.message).toMatch(/"Missing" is never in view/);
  });
  it('staysInFrame: fails the moment it leaves, and not for an exit that fades it out', () => {
    const slides = at({ 30: [note('Card', 10)], 45: [note('Card', 40)], 60: [note('Card', 70)] });
    expect(check([{ staysInFrame: { text: 'Card' } }], slides)[0]).toMatchObject({ code: 'motion-stays-in-frame', frame: 60, message: expect.stringMatching(/leaves the frame at 2\.0 s/) });
    expect(check([{ staysInFrame: { text: 'Card', to: 1.5 } }], slides)).toEqual([]);
    expect(check([{ staysInFrame: { text: 'Card' } }], at({ 30: [note('Card', 10)], 45: [note('Card', 10)], 60: [note('Card', 70, 0.1)] }))).toEqual([]);
  });
  it('keepsMoving: fails a still stretch longer than allowed, in the window only', () => {
    const still = [5, 0, 0, 0, 0, 5];   // frames 15 to 75 do not change: 2 s
    expect(check([{ keepsMoving: { every: 1 } }], title, still)[0]).toMatchObject({ code: 'motion-keeps-moving', frame: 15, message: expect.stringMatching(/does not change from 0\.5 s to 2\.5 s/) });
    expect(check([{ keepsMoving: { every: 3 } }], title, still)).toEqual([]);
    expect(check([{ keepsMoving: { every: 1, from: 2.6 } }], title, still)).toEqual([]);
  });
});
