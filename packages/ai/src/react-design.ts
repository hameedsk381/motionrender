import { z } from 'zod';
import { explainerKinds, explainerKindDocs, explainerLooks, explainerSchema, storyboardSchema, type Explainer } from '@ove/schema';
import { explainerVariants } from '@ove/schema';
import type { AiProvider, ChatMessage } from './providers';
import { extractJson } from './json';

const direction = z.object({
  topic: z.string().trim().min(1).max(40),
  look: z.enum(explainerLooks),
  scenes: z.array(z.object({ kind: z.enum(explainerKinds), storyboard: storyboardSchema })).min(1).max(12),
});

/** Plan from the whole drawing library, then ask for just the selected component's inputs. */
export async function directReactDesign(provider: AiProvider, brief: string, aspect: Explainer['aspect'], attempts = 3) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error('Use 1–10 attempts');
  async function ask<T>(prompt: string, validate: (data: unknown) => T): Promise<T> {
    const messages: ChatMessage[] = [{ role: 'system', content: 'Design a frame-driven video. Return JSON only. Ground every claim, figure and asset reference in the brief.' }, { role: 'user', content: prompt }];
    for (let i = 0; i < attempts; i++) {
      const answer = await provider.chat(messages, { task: 'direct', json: true, maxTokens: 3200 });
      try { return validate(extractJson(answer)); } catch (error) {
        if (i + 1 === attempts) throw error;
        messages.push({ role: 'assistant', content: answer }, { role: 'user', content: 'Correct this response: ' + (error as Error).message });
      }
    }
    throw new Error('Direction exhausted');
  }
  const catalog = explainerKindDocs.map(doc => doc.kind + ': ' + doc.shows).join('\n');
  const board = await ask(`Brief: ${brief}\nAvailable React drawings:\n${catalog}\nChoose a look from ${explainerLooks.join(', ')}. Return {topic,look,scenes:[{kind,storyboard:{visible,change,takeaway,moment}}]}. Use one short line per description and a number 0–1 for the decisive moment. Choose drawings for the relationships the viewer needs to see.`, value => direction.parse(value));
  const scenes = [];
  for (const beat of board.scenes) {
    const doc = explainerKindDocs.find(item => item.kind === beat.kind)!;
    const variants = explainerVariants[beat.kind] ?? [];
    const scene = await ask(`Brief: ${brief}\nTopic: ${board.topic}\nScene: ${JSON.stringify(beat)}\nFill the selected React drawing. Example shape: ${JSON.stringify(doc.example)}. Use the brief's own content. Available variants: ${variants.join(', ') || 'automatic'}.`, value => {
      const parsed = explainerSchema.parse({ topic: board.topic, scenes: [value] }).scenes[0]!;
      if (parsed.kind !== beat.kind || (parsed.variant && !variants.includes(parsed.variant))) throw new Error('Use the selected kind and a listed variant, or omit variant');
      return { ...parsed, storyboard: beat.storyboard };
    });
    scenes.push(scene);
  }
  return explainerSchema.parse({ topic: board.topic, look: board.look, aspect, scenes });
}
