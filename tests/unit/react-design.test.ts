import { expect, it } from 'vitest';
import { directReactDesign, type AiProvider } from '@ove/ai';
import { explainerKindDocs, explainerVariants } from '@ove/schema';

it.each(explainerKindDocs)('directs a $kind scene with its own input contract', async doc => {
  const storyboard = { visible: doc.shows, change: 'Elements appear in order', takeaway: doc.use, moment: 0.6 };
  const answers = [{ topic: 'Test', look: 'paper', scenes: [{ kind: doc.kind, storyboard }] }, { ...doc.example, variant: explainerVariants[doc.kind]?.[0] }];
  const provider: AiProvider = { id: 'fixture', model: 'fixture', baseUrl: '', chat: async () => JSON.stringify(answers.shift()) };
  const result = await directReactDesign(provider, 'Demonstrate the selected drawing', '16:9');
  expect(result.scenes[0]).toMatchObject({ kind: doc.kind, storyboard });
});
