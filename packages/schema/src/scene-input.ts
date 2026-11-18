import { z } from 'zod';

const copy = (words: number) => z.string().trim().min(1).max(180).refine(value => value.split(/\s+/).length <= words, `Use at most ${words} words`);
/** A bounded vocabulary for the reliable generation path. No coordinates or executable props. */
export const sceneInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('kinetic-hook'), headline: copy(9) }).strict(),
  z.object({ type: z.literal('workflow'), headline: copy(9), steps: z.tuple([copy(3), copy(3), copy(3)]) }).strict(),
  z.object({ type: z.literal('before-after'), before: copy(6), after: copy(6) }).strict(),
  z.object({ type: z.literal('decisive-cta'), headline: copy(9) }).strict(),
]);
export type SceneInput = z.infer<typeof sceneInputSchema>;
export const sceneInputJsonSchema = z.toJSONSchema(sceneInputSchema, { target: 'draft-2020-12' });
