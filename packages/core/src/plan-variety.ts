import { videoPlanSchema } from '@ove/schema';

/** Structural repetition signal only: it cannot measure beauty or whether a metaphor is realized. */
export function comparePlanVariety(first: unknown, second: unknown) {
  const a = videoPlanSchema.parse(first), b = videoPlanSchema.parse(second);
  const shape = (plan: typeof a) => plan.beats.map(beat => beat.visual.module ? `module:${beat.visual.module}` : [beat.visual.scene ?? (beat.visual.asset ? 'media' : 'text'), beat.visual.input?.layout ?? 'default', beat.visual.input?.choreography ?? 'default'].join('/'));
  const left = shape(a), right = shape(b), table = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0) as number[]);
  for (let i = 1; i <= left.length; i++) for (let j = 1; j <= right.length; j++) table[i]![j] = left[i - 1] === right[j - 1] ? table[i - 1]![j - 1]! + 1 : Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
  const similarity = table[left.length]![right.length]! / Math.max(left.length, right.length);
  return { scope: 'narrative-structure' as const, similarity, repeated: similarity >= 0.8, left, right, message: similarity >= 0.8 ? 'Scene structure is substantially repeated; new copy or colours do not establish a distinct design.' : 'Scene structure differs; visual distinctiveness still needs rendered review.' };
}
