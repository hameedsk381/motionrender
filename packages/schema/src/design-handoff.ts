import { z } from 'zod';

const words = z.string().trim().min(1).max(1200);
const colour = z.string().regex(/^#[\da-f]{6}$/i, 'Use a six-digit hex colour');
/** Creative intent is portable; renderers decide how to implement it. */
export const designHandoffSchema = z.object({
  concept: words,
  visualMetaphor: words,
  motif: words.describe('A recurring form drawn from the subject, not a template name'),
  typography: z.object({ display: words, body: words, treatment: words }),
  motion: words,
  avoid: z.array(words).default([]),
  acts: z.array(z.object({ id: z.string().min(1), purpose: words, beatIds: z.array(z.string().min(1)).min(1), field: colour, ink: colour, surface: colour.optional(), accent: colour.optional() })).min(1).max(8),
});
export type DesignHandoff = z.infer<typeof designHandoffSchema>;
