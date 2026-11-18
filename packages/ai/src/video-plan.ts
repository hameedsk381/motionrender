// The Markdown-first director. It asks a model for semantic intent, never renderer coordinates,
// then validates and reviews that plan before handing it to the deterministic compiler.
import { formatVideoMarkdown, reviewVideoPlan, sceneCatalogMarkdown, type VideoPlanReviewIssue } from '@ove/core';
import { videoPlanSchema, type VideoPlan } from '@ove/schema';
import { extractJson } from './json';
import type { AiProvider, ChatMessage } from './providers';

export type DirectVideoPlanOptions = {
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  audience?: string;
  goal?: string;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
};

export type DirectedVideoPlan = {
  plan: VideoPlan;
  markdown: string;
  review: VideoPlanReviewIssue[];
  attempts: number;
};

const issues = (error: any) => error?.issues?.slice(0, 12).map((issue: any) => `- ${issue.path.join('.') || 'plan'}: ${issue.message}`).join('\n') ?? String(error);
const idFor = (brief: string) => brief.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'video-plan';

export function directorPrompt(brief: string, options: DirectVideoPlanOptions = {}): ChatMessage[] {
  const width = options.width ?? 1920, height = options.height ?? 1080, fps = options.fps ?? 30, duration = options.durationSeconds ?? 15;
  const skeleton = {
    version: '1.0', kind: 'video-plan', id: idFor(brief), name: 'Short human title',
    brief: { prompt: brief, audience: options.audience, goal: options.goal, targetDurationSeconds: duration },
    format: { width, height, fps },
    beats: [{ id: 'hook', intent: 'The communication job of this beat', durationSeconds: 3, onScreen: 'The short words a viewer reads', narration: 'Optional spoken line', visual: { direction: 'A concrete visual idea, not coordinates', transition: 'cut' } }],
  };
  return [{ role: 'system', content: [
    'You are MotionRender\'s video director. Turn a creative brief into a concise semantic video plan.',
    'Reply with one JSON object only. This plan is authored by people and agents; it must describe narrative intent and visual direction, never pixels, layers, keyframes, CSS, or code.',
    `Use this exact contract shape (add beats as appropriate):\n${JSON.stringify(skeleton, null, 2)}`,
    `The total of durationSeconds must be about ${duration} seconds. Use 3–7 purposeful beats: hook, development/proof, and a decisive ending.`,
    `Each beat needs a stable kebab-case id, an intent (the communication job), short onScreen copy where useful, optional narration, and a concrete visual.direction. Select visual.scene from this catalog when a shape fits; satisfy its required inputs. Use varied transitions sparingly.\n${sceneCatalogMarkdown()}`,
    'Do not invent facts, dates, customer results, or statistics. Unless the user supplied verified sources, omit claim, data, sources and sourceIds entirely. Do not fake citations.',
    'Choose a visual world specific to the brief rather than defaulting to dark gradients or generic glass cards. Keep copy readable and make the first beat visually active.',
  ].join('\n') }, { role: 'user', content: `Direct this video:\n${brief.trim()}${options.audience ? `\nAudience: ${options.audience}` : ''}${options.goal ? `\nGoal: ${options.goal}` : ''}` }];
}

/** Generates a schema-valid plan and gives the director one corrective pass for semantic review warnings. */
export async function directVideoPlan(provider: AiProvider, brief: string, options: DirectVideoPlanOptions = {}): Promise<DirectedVideoPlan> {
  if (!brief.trim()) throw new Error('Say what the video should communicate');
  const messages = directorPrompt(brief, options), limit = Math.max(1, options.maxAttempts ?? 3);
  let feedback = '', last = '';
  for (let attempt = 1; attempt <= limit; attempt++) {
    options.onProgress?.(attempt === 1 ? `Directing the video with ${provider.id}…` : `Refining the semantic plan (attempt ${attempt}/${limit})…`);
    const reply = await provider.chat(messages, { json: true, task: 'direct', temperature: attempt === 1 ? 0.7 : 0.25, maxTokens: 2400, signal: options.signal });
    let parsed: VideoPlan;
    try {
      const raw = extractJson(reply);
      const candidate = raw && typeof raw === 'object' ? { ...raw as object, version: '1.0', kind: 'video-plan', brief: { prompt: brief, targetDurationSeconds: options.durationSeconds ?? 15, ...(raw as any).brief }, format: { width: options.width ?? 1920, height: options.height ?? 1080, fps: options.fps ?? 30, ...(raw as any).format } } : raw;
      const checked = videoPlanSchema.safeParse(candidate);
      if (!checked.success) throw checked.error;
      parsed = checked.data;
    } catch (error) {
      feedback = `The plan is not valid:\n${issues(error)}`; last = feedback;
      messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `${feedback}\nReply with the corrected JSON object only.` });
      continue;
    }
    const review = reviewVideoPlan(parsed);
    const warnings = review.filter(issue => issue.severity === 'warning');
    if (!warnings.length || attempt === limit) return { plan: parsed, markdown: formatVideoMarkdown(parsed), review, attempts: attempt };
    feedback = `The plan passes the schema but needs this editorial repair before production:\n${warnings.map(issue => `- ${issue.beatId ? `[${issue.beatId}] ` : ''}${issue.message}`).join('\n')}`;
    last = feedback;
    messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `${feedback}\nKeep the brief and evidence rules. Reply with the repaired JSON object only.` });
  }
  throw new Error(`The director could not produce a usable video plan after ${limit} attempts:\n${last}`);
}
