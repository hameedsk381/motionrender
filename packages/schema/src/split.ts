import { z } from 'zod';

const label = z.string().trim().min(1).max(28);
const branch = z.object({
  endpoint: label,
  direction: z.enum(['left', 'right', 'down', 'down-left', 'down-right']),
});
export const splitVariants = ['fork', 'manifold'] as const;
export const splitFields = { origin: label, branches: z.tuple([branch, branch]), variant: z.enum(splitVariants).optional() };
export type Split = z.infer<typeof splitSchema>;
export const splitSchema = z.object(splitFields).superRefine(validateSplit);
export function validateSplit(split: { origin: string; branches: [z.infer<typeof branch>, z.infer<typeof branch>] }, ctx: z.RefinementCtx) {
  const [first, second] = split.branches;
  if (new Set([split.origin, first.endpoint, second.endpoint]).size !== 3) {
    ctx.addIssue({ code: 'custom', path: ['branches'], message: 'Name the origin and two distinct endpoints' });
  }
  if (first.direction === second.direction) ctx.addIssue({ code: 'custom', path: ['branches', 1, 'direction'], message: 'Choose diverging directions' });
}
