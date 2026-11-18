import { sceneInputSchema, sceneInputJsonSchema, videoPlanSchema, type SceneInput } from '@ove/schema';
import { formatVideoMarkdown, reviewVideoPlan } from '@ove/core';
import { extractJson } from './json';
import type { AiProvider, ChatMessage } from './providers';
import type { DirectedVideoPlan, DirectVideoPlanOptions } from './video-plan';

const copyFor = (input: SceneInput) => input.type === 'before-after' ? `${input.before} / ${input.after}` : input.headline;
const wordsFor = (input: SceneInput) => [copyFor(input), ...(input.type === 'workflow' ? input.steps : [])].join(' ').split(/\s+/).length;

/** Small-model path: three narrow calls, local retries, and compiler-owned duration/layout. */
export async function directConstrainedVideo(provider: AiProvider, brief: string, options: DirectVideoPlanOptions = {}): Promise<DirectedVideoPlan> {
  if (!brief.trim()) throw new Error('Say what the video should communicate');
  const limit = options.maxAttempts ?? 3;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('maxAttempts must be an integer from 1 to 10');
  const roles = [
    { id: 'hook', intent: 'Establish the problem', allowed: ['kinetic-hook'] },
    { id: 'explain', intent: 'Explain the solution', allowed: ['workflow', 'before-after'] },
    { id: 'close', intent: 'Invite one next step', allowed: ['decisive-cta'] },
  ];
  const inputs: SceneInput[] = []; let attempts = 0;
  for (const role of roles) {
    const messages: ChatMessage[] = [{ role: 'system', content: `Write ONE scene input. Return only JSON matching the schema. Allowed type: ${role.allowed.join(' or ')}. Do not produce code, positions, timing, narration, citations, or numeric performance claims. Use only information in the brief. Schema: ${JSON.stringify(sceneInputJsonSchema)}` }, { role: 'user', content: `Brief: ${brief}\nAudience: ${options.audience ?? 'general'}\nGoal: ${options.goal ?? 'explain the idea'}\nScene job: ${role.intent}\nEarlier scenes: ${JSON.stringify(inputs)}` }];
    let accepted = false, last = '';
    for (let attempt = 0; attempt < limit; attempt++) {
      options.signal?.throwIfAborted();
      options.onProgress?.(`Writing ${role.id} (${attempt + 1}/${limit})…`);
      attempts++;
      const reply = await provider.chat(messages, { json: true, task: 'direct', temperature: 0.2, maxTokens: 600, signal: options.signal });
      try {
        const input = sceneInputSchema.parse(extractJson(reply));
        if (!role.allowed.includes(input.type)) throw new Error(`Choose ${role.allowed.join(' or ')}`);
        inputs.push(input); accepted = true; break;
      } catch (error) {
        last = (error as Error).message;
        messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `Fix only this scene: ${last}. Return one corrected JSON object.` });
      }
    }
    if (!accepted) throw new Error(`Scene ${role.id} failed after ${limit} attempts: ${last}`);
  }
  const minimums = inputs.map(input => Math.max(3, Math.ceil((0.75 + wordsFor(input) * 0.3) * 10) / 10));
  const minimum = minimums.reduce((sum, seconds) => sum + seconds, 0), duration = options.durationSeconds ?? Math.max(15, minimum);
  if (!Number.isFinite(duration) || duration < minimum) throw new Error(`This copy needs at least ${minimum.toFixed(1)} seconds; shorten it or increase the duration`);
  const extra = (duration - minimum) / inputs.length;
  const plan = videoPlanSchema.parse({ id: 'directed-video', name: brief.slice(0, 80), brief: { prompt: brief, audience: options.audience, goal: options.goal, targetDurationSeconds: duration }, format: { width: options.width ?? 1920, height: options.height ?? 1080, fps: options.fps ?? 30 }, beats: inputs.map((input, index) => ({ id: roles[index]!.id, intent: roles[index]!.intent, onScreen: copyFor(input), durationSeconds: minimums[index]! + extra, visual: { scene: input.type, input, direction: `Render the typed ${input.type} inputs with the standard compiler.` } })) });
  return { plan, markdown: formatVideoMarkdown(plan), review: reviewVideoPlan(plan), attempts };
}
