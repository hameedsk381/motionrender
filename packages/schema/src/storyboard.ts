import { z } from 'zod';

const boardLine = z.string().trim().min(1).max(300).regex(/^[^\r\n]+$/);
export const storyboardSchema = z.object({
  visible: boardLine, change: boardLine, takeaway: boardLine,
  moment: z.number().min(0).max(1).describe('Fraction of the beat at which its visual idea reads most clearly.'),
});
export type Storyboard = z.infer<typeof storyboardSchema>;

export const storyboardRangeSchema = z.object({ id: z.string(), startFrame: z.number().int().nonnegative(), durationFrames: z.number().int().positive(), storyboard: storyboardSchema });
