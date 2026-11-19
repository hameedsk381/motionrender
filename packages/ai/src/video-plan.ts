// The Markdown-first director. It asks a model for semantic intent, never renderer coordinates,
// then validates and reviews that plan before handing it to the deterministic compiler.
import { formatVideoMarkdown, parseVideoMarkdown, reviewVideoPlan, type VideoPlanReviewIssue } from '@ove/core';
import { videoPlanSchema, type VideoPlan } from '@ove/schema';
import type { DesignHandoff, SceneInput } from '@ove/schema';
import type { AiProvider, ChatMessage } from './providers';

export type DirectVideoPlanOptions = {
  story?: { design: DesignHandoff; beats: { id: string; intent: string; scene: SceneInput['type']; storyboard?: VideoPlan['beats'][number]['storyboard'] }[] };
  previousPlans?: VideoPlan[];
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
  const skeleton = `---
id: ${idFor(brief)}
title: Short human title
width: ${width}
height: ${height}
fps: ${fps}
---

# What this beat communicates
ID: beat-one
Duration: 3s
Scene: kinetic-hook
On-screen: Short words the viewer reads
Visual: A concrete visual idea
Visible: What is on screen
Change: What moves
Takeaway: What the viewer learns
Moment: 0.65`;
  return [{ role: 'system', content: [
    'You are MotionRender\'s video director. Turn a creative brief into a concise semantic video plan.',
    'Reply in Markdown only. Describe the story and visible action. Omit coordinates, CSS, code, file references and JSON.',
    `Use these labelled lines, with one level-one heading per beat:\n${skeleton}`,
    `Keep total duration around ${duration} seconds. Choose the beats that serve this brief. When asked for one scene, return one beat with no separate title or closing beat.`,
    'Use Scene: route for ordered trips and skipped stops. If paths share a destination and one visits an intermediate stop, keep the whole path of each trip in one route beat. Example scene lines: Scene: route; Trip: Local | A → B → C; Trip: Express | A → C. Optional Variant: rail or map.',
    'Use Scene: split only when one source reaches two different endpoints simultaneously. Write Origin: Tap and two Branch: destination | direction lines. Directions are left, right, down, down-left and down-right. Optional Variant: fork or manifold.',
    'Use Scene: fold for a printed sheet closing. Write Inside: printed title and Cover: printed title. Optional Variant: sheet or booklet.',
    'For Scene: workflow, write three Step: short label lines. For Scene: before-after, write Before: and After:. For kinetic-hook and decisive-cta, use short On-screen: copy. Use an optional Narration: line for speech. Moment is an inspection fraction between zero and one.',
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
    const reply = await provider.chat(messages, { task: 'direct', temperature: attempt === 1 ? 0.7 : 0.25, maxTokens: 2400, signal: options.signal });
    let parsed: VideoPlan;
    try {
      const markdown = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i.exec(reply)?.[1] ?? reply.trim();
      const plan = parseVideoMarkdown(markdown);
      parsed = videoPlanSchema.parse({
        ...plan,
        brief: { ...plan.brief, prompt: brief, targetDurationSeconds: options.durationSeconds ?? 15, audience: options.audience ?? plan.brief.audience, goal: options.goal ?? plan.brief.goal },
        format: { width: options.width ?? 1920, height: options.height ?? 1080, fps: options.fps ?? 30 },
      });
    } catch (error) {
      feedback = `The plan is not valid:\n${issues(error)}`; last = feedback;
      messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `${feedback}\nReply with the complete corrected Markdown plan.` });
      continue;
    }
    const review = reviewVideoPlan(parsed);
    const warnings = review.filter(issue => issue.severity === 'warning');
    if (!warnings.length || attempt === limit) return { plan: parsed, markdown: formatVideoMarkdown(parsed), review, attempts: attempt };
    feedback = `The plan passes the schema but needs this editorial repair before production:\n${warnings.map(issue => `- ${issue.beatId ? `[${issue.beatId}] ` : ''}${issue.message}`).join('\n')}`;
    last = feedback;
    messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `${feedback}\nKeep the brief and evidence rules. Reply with the complete repaired Markdown plan.` });
  }
  throw new Error(`The director could not produce a usable video plan after ${limit} attempts:\n${last}`);
}
