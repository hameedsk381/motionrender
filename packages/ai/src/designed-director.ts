import { z } from 'zod';
import { designHandoffSchema, storyboardSchema } from '@ove/schema';
import { directConstrainedVideo } from './constrained-director';
import type { AiProvider, ChatMessage } from './providers';
import type { DirectVideoPlanOptions } from './video-plan';
import { extractJson } from './json';
import { comparePlanVariety } from '@ove/core';

const storySchema = z.object({ design: designHandoffSchema, beats: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), intent: z.string().min(1), storyboard: storyboardSchema, scene: z.enum(['fold', 'split', 'route', 'kinetic-hook', 'workflow', 'before-after', 'decisive-cta']) })).min(2).max(6) }).superRefine((story, ctx) => {
  const ids = new Set(story.beats.map(beat => beat.id)), assigned = story.design.acts.flatMap(act => act.beatIds);
  if (ids.size !== story.beats.length || new Set(assigned).size !== assigned.length || assigned.length !== ids.size || assigned.some(id => !ids.has(id))) ctx.addIssue({ code: 'custom', message: 'Every beat needs a unique ID and exactly one narrative act' });
  if (new Set(story.design.acts.map(act => act.id)).size !== story.design.acts.length) ctx.addIssue({ code: 'custom', message: 'Act IDs must be unique' });
});

/** Design first, then fill independently validated scene contracts. No fixed hook/workflow/CTA sequence. */
export async function directDesignedVideo(provider: AiProvider, brief: string, options: DirectVideoPlanOptions = {}) {
  if (!brief.trim()) throw new Error('Say what the video should communicate');
  const limit = options.maxAttempts ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('maxAttempts must be an integer from 1 to 10');
  const examples = { design: { concept: 'Subject-specific story', visualMetaphor: 'A visual relationship grounded in the subject', motif: 'The recurring subject form', typography: { display: 'Inter', body: 'Inter', treatment: 'Hierarchy and composition in words' }, motion: 'Purposeful changes following the story', avoid: ['Generic card rows'], acts: [{ id: 'discovery', purpose: 'What the viewer discovers', beatIds: ['idea', 'resolution'], field: '#ffffff', ink: '#142838', accent: '#005ca8' }] }, beats: [{ id: 'idea', intent: 'Communication purpose', scene: 'kinetic-hook' }, { id: 'resolution', intent: 'Different communication purpose', scene: 'decisive-cta' }] };
  const messages: ChatMessage[] = [{ role: 'system', content: `Direct a distinctive short video. Return JSON in this shape: ${JSON.stringify(examples)}. For every beat also include storyboard with visible (what the camera sees), change (what moves), takeaway (what the viewer learns), and moment (fraction from 0 to 1 where the action reads most clearly). Select a scene that can draw that action. Choose 2–6 beats with your own IDs and purposes, and 1–4 narrative acts covering every beat exactly once. Select each scene from fold (a sheet closes and reveals a cover), split (one origin feeding two simultaneous paths), route (named stops and successive trips with a return or bypass), kinetic-hook (short statement), workflow (three steps or one source branching into two outcomes), before-after (two states supplied in brief), decisive-cta (invitation). Do not mechanically choose hook/workflow/CTA for every brief. Develop a concrete visual metaphor, recurring motif, type treatment and motion. Use hex colours. Typeface families: Inter, Archivo, Fraunces, Space Grotesk. No invented facts. These primitives limit execution: do not claim they can realize arbitrary visual effects.` }, { role: 'user', content: `Brief: ${brief}\nDuration: ${options.durationSeconds ?? 15}s\nAudience: ${options.audience ?? 'general'}\nGoal: ${options.goal ?? 'communicate the idea'}\nAvoid repeating these previous directions: ${JSON.stringify((options.previousPlans ?? []).map(plan => ({ concept: plan.design?.concept, motif: plan.design?.motif, scenes: plan.beats.map(beat => ({ scene: beat.visual.scene, layout: beat.visual.input?.layout, choreography: beat.visual.input?.choreography })) })))}` }];
  let last = '';
  for (let attempt = 1; attempt <= limit; attempt++) {
    options.onProgress?.(`Directing concept and narrative acts (${attempt}/${limit})…`);
    const reply = await provider.chat(messages, { json: true, task: 'direct', maxTokens: 2200, temperature: 0.5, signal: options.signal });
    try {
      const story = storySchema.parse(extractJson(reply));
      if (story.beats.length * 3 > (options.durationSeconds ?? 15)) throw new Error('Use fewer beats: allow at least three seconds per beat');
      const directed = await directConstrainedVideo(provider, brief, { ...options, story });
      for (const previous of options.previousPlans ?? []) {
        const comparison = comparePlanVariety(previous, directed.plan);
        if (comparison.repeated) directed.review.push({ severity: 'warning', code: 'repeated-structure', message: comparison.message });
      }
      return { ...directed, attempts: directed.attempts + attempt };
    } catch (error) { last = (error as Error).message; }
    messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `Fix this direction contract: ${last}. Return corrected JSON.` });
  }
  throw new Error(`Could not direct the story: ${last}`);
}
