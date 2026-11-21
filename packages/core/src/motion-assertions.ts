// Motion assertions: requirements a video declares about its own timeline, in a small JSON file beside it (video.motion.json), checked by the review on the real
// frames. The review already knows what is wrong with a picture (clipped text, contrast, safe zones); this says what must be TRUE of the motion: the title is in view
// by one second, the question comes before the answer, the card never leaves the frame, nothing stands still for more than two seconds.
//
//   { "assertions": [
//     { "appearsBy":    { "text": "Solar got cheap", "seconds": 1 } },
//     { "before":       { "first": "Hand-built", "then": "Factories scale" } },
//     { "staysInFrame": { "text": "Mass production" } },
//     { "keepsMoving":  { "from": 1, "to": 12, "every": 2 } }
//   ] }
//
// Text is found by what it says (a part of it, any case), which is stable in a React video where layer ids are not.
import type { TextNote } from '@ove/graphics';

export type MotionAssertion =
  | { appearsBy: { text: string; seconds?: number; frame?: number } }
  | { before: { first: string; then: string } }
  | { staysInFrame: { text: string; to?: number } }
  | { keepsMoving: { from?: number; to?: number; every?: number } };

export type MotionIssue = { severity: 'error'; code: string; message: string; frame?: number };

const fail = (index: number, message: string): never => { throw new Error(`motion assertion ${index + 1}: ${message}`); };
const str = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const num = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Reads a motion file's contents; throws a message that names the assertion and what is wrong with it. */
export function parseMotionAssertions(raw: unknown): MotionAssertion[] {
  const list = (raw as { assertions?: unknown })?.assertions;
  if (!Array.isArray(list)) throw new Error('A motion file is { "assertions": [ … ] }');
  return list.map((item, i): MotionAssertion => {
    const keys = item && typeof item === 'object' ? Object.keys(item) : [];
    if (keys.length !== 1) return fail(i, 'each assertion has exactly one of appearsBy, before, staysInFrame, keepsMoving');
    const key = keys[0]!, a = (item as Record<string, any>)[key];
    switch (key) {
      case 'appearsBy':
        if (!str(a?.text)) return fail(i, 'appearsBy needs the "text" to look for');
        if (!(num(a.seconds) !== num(a.frame))) return fail(i, 'appearsBy needs either "seconds" or "frame", not both and not neither');
        return { appearsBy: { text: a.text, ...(a.seconds !== undefined ? { seconds: a.seconds } : { frame: a.frame }) } };
      case 'before':
        if (!str(a?.first) || !str(a?.then)) return fail(i, 'before needs "first" and "then", the text of each');
        return { before: { first: a.first, then: a.then } };
      case 'staysInFrame':
        if (!str(a?.text)) return fail(i, 'staysInFrame needs the "text" to follow');
        if (a.to !== undefined && !num(a.to)) return fail(i, '"to" is a time in seconds');
        return { staysInFrame: { text: a.text, ...(a.to !== undefined ? { to: a.to } : {}) } };
      case 'keepsMoving':
        for (const field of ['from', 'to', 'every']) if (a?.[field] !== undefined && !num(a[field])) return fail(i, `"${field}" is a time in seconds`);
        return { keepsMoving: { ...(a?.from !== undefined ? { from: a.from } : {}), ...(a?.to !== undefined ? { to: a.to } : {}), ...(a?.every !== undefined ? { every: a.every } : {}) } };
      default:
        return fail(i, `"${key}" is not an assertion; use appearsBy, before, staysInFrame or keepsMoving`);
    }
  });
}

/** The frames an assertion needs looked at exactly: where an appearsBy deadline falls, so it is judged at that moment and not at the nearest sample. */
export function motionFrames(assertions: MotionAssertion[], fps: number, durationFrames: number): number[] {
  const frames = new Set<number>();
  for (const assertion of assertions) if ('appearsBy' in assertion) {
    const by = assertion.appearsBy.frame ?? Math.round((assertion.appearsBy.seconds ?? 0) * fps);
    frames.add(Math.max(0, Math.min(durationFrames - 1, by)));
  }
  return [...frames];
}

const said = (t: TextNote, wanted: string) => (t.kind === 'text' || t.kind === 'captions') && t.text.toLowerCase().includes(wanted.toLowerCase());
const seconds = (frame: number, fps: number) => `${(frame / fps).toFixed(1)} s`;

/**
 * Judges the assertions on the sampled frames. `reports[i]` is frame `frames[i]`; `change[i]` is how much the picture changed from sample i to i + 1.
 * Text counts as in view when it is fully opaque, not covered, and inside the frame.
 */
export function checkMotionAssertions(assertions: MotionAssertion[], reports: { texts: TextNote[] }[], frames: number[], change: number[], fps: number, width: number, height: number): MotionIssue[] {
  const issues: MotionIssue[] = [];
  const inFrame = (t: TextNote) => t.x0 >= -2 && t.y0 >= -2 && t.x1 <= width + 2 && t.y1 <= height + 2;
  const inView = (t: TextNote) => t.alpha >= 0.95 && !t.occluded && inFrame(t);
  const firstSeen = (wanted: string) => { const i = reports.findIndex(r => r.texts.some(t => said(t, wanted) && inView(t))); return i < 0 ? undefined : i; };
  const add = (code: string, message: string, frame?: number) => issues.push({ severity: 'error', code, message, ...(frame === undefined ? {} : { frame }) });

  for (const assertion of assertions) {
    if ('appearsBy' in assertion) {
      const { text } = assertion.appearsBy, by = assertion.appearsBy.frame ?? Math.round((assertion.appearsBy.seconds ?? 0) * fps), first = firstSeen(text);
      if (first === undefined) add('motion-appears-by', `"${text}" is never in view (opaque, uncovered and inside the frame): is the text right, and does it get drawn?`);
      else if (frames[first]! > by) add('motion-appears-by', `"${text}" must be in view by ${seconds(by, fps)} but first is at ${seconds(frames[first]!, fps)}: bring it in earlier or lift the deadline`, frames[first]);
    } else if ('before' in assertion) {
      const { first: a, then: b } = assertion.before, fa = firstSeen(a), fb = firstSeen(b);
      if (fa === undefined) add('motion-before', `"${a}" is never in view, so it cannot come before "${b}"`);
      else if (fb === undefined) add('motion-before', `"${b}" is never in view, so "${a}" cannot come before it`);
      else if (fa >= fb) add('motion-before', `"${a}" must come before "${b}" but appears at ${seconds(frames[fa]!, fps)}, "${b}" at ${seconds(frames[fb]!, fps)}`, frames[fa]);
    } else if ('staysInFrame' in assertion) {
      const { text } = assertion.staysInFrame, start = firstSeen(text);
      if (start === undefined) { add('motion-stays-in-frame', `"${text}" is never in view, so there is nothing to keep in the frame`); continue; }
      const stop = assertion.staysInFrame.to === undefined ? undefined : Math.round(assertion.staysInFrame.to * fps);
      // From when it first appears until it is gone (an exit that fades it out ends the check), or until `to`.
      for (let i = start; i < reports.length; i++) {
        if (stop !== undefined && frames[i]! > stop) break;
        const here = reports[i]!.texts.filter(t => said(t, text) && t.alpha >= 0.3);
        if (!here.length) { if (stop === undefined) break; continue; }
        const out = here.find(t => !inFrame(t));
        if (out) { add('motion-stays-in-frame', `"${text}" leaves the frame at ${seconds(frames[i]!, fps)}`, frames[i]); break; }
      }
    } else {
      const { from = 0, to = Infinity, every = 2 } = assertion.keepsMoving;
      let still: number | undefined;
      for (let i = 0; i <= change.length; i++) {
        const inWindow = i < change.length && frames[i]! / fps >= from && frames[i]! / fps <= to, isStill = inWindow && change[i]! < 0.5;
        if (isStill && still === undefined) still = i;
        if (!isStill && still !== undefined) {
          const span = (frames[i]! - frames[still]!) / fps;
          if (span > every) add('motion-keeps-moving', `The picture does not change from ${seconds(frames[still]!, fps)} to ${seconds(frames[i]!, fps)} (${span.toFixed(1)} s, longer than the ${every} s allowed): add motion, or shorten the hold`, frames[still]);
          still = undefined;
        }
      }
    }
  }
  return issues;
}
