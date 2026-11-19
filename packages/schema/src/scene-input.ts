import { foldFields } from './fold';
import { splitFields, validateSplit } from './split';
import { routeFields, validateRoute } from './route';
import { z } from 'zod';

const copy = (words: number) => z.string().trim().min(1).max(180).refine(value => value.split(/\s+/).length <= words, `Use at most ${words} words`);
const choreography = z.enum(['reveal', 'cascade', 'trace']).optional();
/** A bounded vocabulary for the reliable generation path. No coordinates or executable props. */
export const sceneInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fold'), headline: copy(9), ...foldFields, layout: z.literal('sheet').default('sheet'), choreography: z.literal('hinge').default('hinge') }).strict(),
  z.object({ type: z.literal('split'), headline: copy(9), ...splitFields, layout: z.literal('fork').default('fork'), choreography: z.literal('trace').default('trace') }).strict().superRefine(validateSplit),
  z.object({ type: z.literal('route'), headline: copy(9), ...routeFields, layout: z.literal('map').default('map'), choreography: z.literal('trace').default('trace') }).strict().superRefine(validateRoute),
  z.object({ type: z.literal('kinetic-hook'), headline: copy(9), layout: z.enum(['editorial', 'poster', 'split']).optional(), choreography }).strict(),
  z.object({ type: z.literal('workflow'), headline: copy(9), steps: z.tuple([copy(3), copy(3), copy(3)]), layout: z.enum(['horizontal', 'vertical', 'radial', 'branch']).optional(), choreography }).strict(),
  z.object({ type: z.literal('before-after'), before: copy(6), after: copy(6), layout: z.enum(['split', 'stacked']).optional(), choreography }).strict(),
  z.object({ type: z.literal('decisive-cta'), headline: copy(9), layout: z.enum(['centered', 'corner', 'banner']).optional(), choreography }).strict(),
]);
export type SceneInput = z.infer<typeof sceneInputSchema>;
export const sceneInputJsonSchema = z.toJSONSchema(sceneInputSchema, { target: 'draft-2020-12' });
