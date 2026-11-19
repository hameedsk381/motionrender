import { z } from 'zod';

const faceTitle = z.string().trim().min(1).max(32);
export const foldVariants = ['sheet', 'booklet'] as const;
export const foldFields = {
  variant: z.enum(foldVariants).optional(),
  inside: faceTitle.describe('Short printed title on the open sheet'),
  cover: faceTitle.describe('Short printed title revealed on the closed cover'),
  artwork: z.enum(['print', 'map']),
  direction: z.enum(['right-to-left', 'left-to-right']),
};
export const foldSchema = z.object(foldFields);
export type Fold = z.infer<typeof foldSchema>;
