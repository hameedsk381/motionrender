// `mr make`: the whole check-and-build loop in one call, for agents and people who would otherwise run validate, compile, still, review and
// render one after another. It reads an explainer script, semantic video plan, or composition, validates it, builds it, runs the design review and writes
// one contact sheet of the whole video, and (only when asked) renders it, as a quick draft or at full quality. Every problem comes back in one
// report with where it is, so one fix and one more call is the usual loop.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { explainerSchema, videoPlanSchema, type Explainer } from '@ove/schema';
import { compileVideoPlan, defaultConcurrency, loadComposition, parseVideoMarkdown, proposePlanRepairs, renderMedia, reviewComposition, reviewRepairTasks, type Composition, type PlanRepairProposal, type ReviewIssue, type ReviewRepairTask } from '@ove/core';
import { buildExplainer } from './explainer';
import { buildVideoSource } from './build';
import { verifyVideo, type VideoCheck } from './verify-video';
import { loadMotionAssertions, motionFileFor } from './motion-file';

export type MakeRender = 'draft' | 'final';
export type MakeOptions = {
  /** An explainer script, semantic video plan, or composition. */ file: string;
  /** Which platform controls the review keeps text clear of: social (default) or strict (TikTok, Reels and Shorts together). */ safeZone?: 'social' | 'strict';
  /** Render an MP4 after the checks: a quick draft (half size, fast encode) or the full-quality video. Default: no render. */ render?: MakeRender;
  /** The video file (default: draft.mp4 or out.mp4 beside the input). */ output?: string;
  /** Contact sheet path (default: review.png beside the input). */ sheet?: string;
  /** Record the explainer's spoken lines (default true). Without it scenes are as long as their pictures need and the video is silent. */ voice?: boolean;
  voiceName?: string;
  /** Draw the scene kinds that have a React drawing with React components (9:16 explainers). On by default; false keeps the stock scenes. */ react?: boolean;
  /** Run React, code and p5 layers while checking and rendering (only for files you trust). */ allowCode?: boolean;
  /** Check every Nth frame instead of the default spacing (a larger number is faster and less thorough). */ every?: number;
  log?: (message: string) => void;
};
export type MakeResult = {
  ok: boolean;
  kind: 'explainer' | 'video-plan' | 'composition' | 'source';
  /** Problems that stopped the build, with their paths. Empty when the file was built. */ problems: string[];
  composition?: string;
  summary?: { scenes: number; seconds: number; width: number; height: number; fps: number; spoken?: number };
  review?: { checkpoints?: Awaited<ReturnType<typeof reviewComposition>>["checkpoints"]; sheet: string; sheetFrames: number[]; errors: ReviewIssue[]; warnings: ReviewIssue[]; notes: ReviewIssue[]; repairs: ReviewRepairTask[]; planRepairs?: PlanRepairProposal[]; loudness?: { integrated: number; truePeak: number } };
  video?: { output: string; draft: boolean; seconds: number; frames: number; renderSeconds: number; /** What reading the finished file found: size, length, sound, black and frozen stretches. */ checks: VideoCheck[] };
  notes: string[];
  timings: Record<string, number>;
  next: string[];
};

const hasCodeLayers = (composition: Composition) => composition.scenes.some(scene => scene.layers.some(layer => layer.type === 'react' || layer.type === 'code' || layer.type === 'p5'));
const readJson = async (file: string) => JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, ''));
const seconds = (since: number) => Math.round((Date.now() - since) / 100) / 10;

/** A video plan declares kind: video-plan; an explainer has topic; a composition has version and no topic. */
/** An explainer script missing its topic still has scenes with a `kind` and no layers: it is reported as an explainer (so the error names the missing topic), not as a broken composition. */
const looksLikeExplainerScenes = (raw: any) => Array.isArray(raw?.scenes) && raw.scenes.length > 0 && raw.scenes.every((scene: any) => typeof scene?.kind === 'string' && !('layers' in scene));
export const kindOfFile = (raw: any): 'explainer' | 'video-plan' | 'composition' => raw?.kind === 'video-plan' ? 'video-plan' : (raw && typeof raw === 'object' && 'version' in raw && !('topic' in raw) && !looksLikeExplainerScenes(raw) ? 'composition' : 'explainer');

/** What the draft render changes: half the size, a fast encode, no motion blur. It is for checking how the video moves, not for sending. */
export const draftSettings = { scale: 0.5, preset: 'ultrafast' as const, crf: 32, motionBlur: false };

export async function makeVideo(options: MakeOptions): Promise<MakeResult> {
  const log = options.log ?? (() => {}), file = resolve(options.file), dir = dirname(file), timings: Record<string, number> = {}, notes: string[] = [];
  let started = Date.now();
  const isSource = /\.[jt]sx$/i.test(file);
  let raw: unknown, kind: MakeResult['kind'] = isSource ? 'source' : extname(file).toLowerCase() === '.md' ? 'video-plan' : 'composition';
  const fail = (problems: string[]): MakeResult => ({ ok: false, kind, problems, notes, timings, next: ['Fix the problems listed and run make again.'] });
  try { raw = isSource ? undefined : kind === 'video-plan' ? parseVideoMarkdown(await readFile(file, 'utf8')) : await readJson(file); }
  catch (error) {
    const issues = (error as { issues?: { path: PropertyKey[]; message: string }[] }).issues;
    return fail(issues?.map(issue => `${issue.path.join('.') || 'plan'}: ${issue.message}`) ?? [(error as Error).message]);
  }
  if (!isSource) kind = kindOfFile(raw);

  // 1. Check and build.
  let compositionPath = file, composition: Composition, plan: any, spoken: number | undefined, reacted = false, scriptScenes: number | undefined, sourceBase: string | undefined;
  if (kind === 'source') {
    log('Building the video…');
    try { const built = await buildVideoSource(file); compositionPath = built.compositionPath; sourceBase = built.baseDir; composition = loadComposition(built.raw); }
    catch (error) { return fail([(error as Error).message]); }
  } else if (kind === 'explainer') {
    const parsed = explainerSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues.map(issue => `${issue.path.join('.') || 'script'}: ${issue.message}`));
    log('Building the video…');
    let built;
    try { built = await buildExplainer(parsed.data as Explainer, { output: join(dir, 'composition.json'), voice: options.voice !== false, voiceName: options.voiceName, react: options.react !== false, log }); }
    catch (error) { return fail([(error as Error).message]); }
    compositionPath = built.output; spoken = built.spoken; reacted = built.react; scriptScenes = built.scenes; notes.push(...built.notes);
    composition = loadComposition(await readJson(compositionPath));
  } else if (kind === 'video-plan') {
    const parsed = videoPlanSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues.map(issue => `${issue.path.join('.') || 'plan'}: ${issue.message}`));
    log('Compiling the semantic video plan…');
    plan = parsed.data; const built = compileVideoPlan(parsed.data);
    compositionPath = join(dir, 'composition.json');
    await writeFile(compositionPath, JSON.stringify(built.composition, null, 2) + '\n');
    notes.push(...built.notes);
    spoken = parsed.data.beats.filter(beat => beat.narration).length;
    composition = loadComposition(built.composition);
  } else {
    try { composition = loadComposition(raw); }
    catch (error) { return fail([(error as Error).message]); }
  }
  timings.build = seconds(started);
  const baseDir = sourceBase ?? dirname(compositionPath), allowCode = options.allowCode === true || reacted || kind === 'source';   // running your own source is trusting it: the build already ran it   // a React build runs only MotionRender's own view, with the script as data
  if (hasCodeLayers(composition) && !allowCode) return fail(['This composition has react, code or p5 layers, which run JavaScript while checking and rendering. Run make again with allowCode (--allow-code) if you trust the file.']);
  const summary = { scenes: reacted && scriptScenes !== undefined ? scriptScenes : composition.scenes.filter(scene => scene.id !== 'overlay').length, seconds: Math.round((composition.durationFrames / composition.fps) * 10) / 10, width: composition.width, height: composition.height, fps: composition.fps, ...(spoken === undefined ? {} : { spoken }) };

  // 2. Review: automated checks and one contact sheet of the whole video.
  started = Date.now();
  log('Checking the design and drawing the contact sheet…');
  const motion = await loadMotionAssertions(file).catch((error: Error) => { notes.push(`Motion assertions not used: ${error.message}`); return undefined; });
  if (motion?.length) notes.push(`Checking ${motion.length} motion assertion${motion.length === 1 ? '' : 's'} from ${motionFileFor(file).split(/[\\/]/).pop()}.`);
  const reviewed = await reviewComposition(composition, { baseDir, allowCode, every: options.every, motion, safeZonePreset: options.safeZone });
  const sheet = resolve(options.sheet ?? join(baseDir, 'review.png'));
  await writeFile(sheet, reviewed.sheet);
  timings.review = seconds(started);
  const bySeverity = (severity: ReviewIssue['severity']) => reviewed.issues.filter(issue => issue.severity === severity);
  const review = { checkpoints: reviewed.checkpoints, sheet, sheetFrames: reviewed.sheetFrames, errors: bySeverity('error'), warnings: bySeverity('warning'), notes: bySeverity('info'), repairs: reviewRepairTasks(composition, reviewed.issues), ...(plan ? { planRepairs: proposePlanRepairs(plan, reviewed.issues) } : {}), loudness: reviewed.loudness };
  const clean = review.errors.length === 0;

  // 3. Render, only when asked, and not over unresolved errors.
  let video: MakeResult['video'];
  if (options.render && clean) {
    started = Date.now();
    const draft = options.render === 'draft', output = resolve(options.output ?? join(baseDir, draft ? 'draft.mp4' : 'out.mp4'));
    log(draft ? 'Rendering a quick draft…' : 'Rendering the final video…');
    const rendered = await renderMedia(composition, { baseDir, output, allowCode, concurrency: defaultConcurrency(), ...(draft ? draftSettings : {}) });
    timings.render = seconds(started);
    // Read the file that was written: the review checks the plan, this checks the result.
    const exp = composition.export as { loudness?: number; audio?: unknown } | undefined;
    const checks = await verifyVideo(rendered.output, { width: composition.width, height: composition.height, seconds: composition.durationFrames / composition.fps, audio: JSON.stringify(composition).includes('"type":"audio"') || !!exp?.audio, loudness: typeof exp?.loudness === 'number' ? exp.loudness : undefined, scale: draft ? draftSettings.scale : 1 }).catch((error: Error) => [{ severity: 'warning' as const, code: 'video-unchecked', message: `The finished file could not be checked: ${error.message}` }]);
    video = { output: rendered.output, draft, seconds: rendered.durationSeconds, frames: rendered.frames, renderSeconds: timings.render, checks };
  } else if (options.render) notes.push('Not rendered: the review found errors. Fix them first.');

  const rel = (path: string) => path;
  const next: string[] = [];
  if (!clean) next.push('Fix the review errors using the targeted repair tasks, then run make again.');
  else if (!video) next.push(`Look at the contact sheet (${rel(sheet)}) to check the whole video, then run make again with render "draft" to see it move, or "final" for the finished video.`);
  else if (video.draft) next.push('If the draft moves the way you want, run make again with render "final".');
  return { ok: clean && !(video?.checks ?? []).some(check => check.severity === 'error'), kind, problems: [], composition: compositionPath, summary, review, video, notes, timings, next };
}

/** The report as text, short enough to read in one go: what was built, what is wrong, where the files are. */
export function makeReport(result: MakeResult): string {
  const lines: string[] = [];
  if (!result.ok && result.problems.length) {
    lines.push(`Could not build the ${result.kind}:`, ...result.problems.map(problem => `- ${problem}`), '', ...result.next);
    return lines.join('\n');
  }
  const s = result.summary!;
  lines.push(`${result.ok ? 'Built' : 'Built, with errors'}: ${result.composition} (${s.scenes} scene${s.scenes === 1 ? '' : 's'}, ${s.seconds} s, ${s.width}x${s.height}${s.spoken === undefined ? '' : `, ${s.spoken} spoken line${s.spoken === 1 ? '' : 's'}`})`);
  const r = result.review!;
  lines.push(`Review: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}, ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}, ${r.notes.length} note${r.notes.length === 1 ? '' : 's'}. Contact sheet of the whole video: ${r.sheet}`);
  const show = (issue: ReviewIssue, label: string) => `  ${label} ${issue.frame === undefined ? '' : `frame ${issue.frame}: `}${issue.message}${issue.layer ? ` [${issue.layer}]` : ''}`;
  for (const issue of r.errors) lines.push(show(issue, 'ERROR'));
  for (const issue of r.warnings.slice(0, 8)) lines.push(show(issue, 'warn '));
  if (r.warnings.length > 8) lines.push(`  …and ${r.warnings.length - 8} more warnings`);
  for (const issue of r.notes.slice(0, 5)) lines.push(show(issue, 'note '));
  for (const note of result.notes) lines.push(`Note: ${note}`);
  if (r.repairs.length) {
    lines.push(`Repairs: ${r.repairs.length} actionable task${r.repairs.length === 1 ? '' : 's'}.`);
    for (const task of r.repairs.slice(0, 6)) lines.push(`  ${task.id}${task.target.beatId ? ` [beat ${task.target.beatId}]` : task.target.sceneId ? ` [scene ${task.target.sceneId}]` : ''}: ${task.instruction}`);
    if (r.repairs.length > 6) lines.push(`  …and ${r.repairs.length - 6} more repair tasks`);
  }
  if (r.planRepairs?.length) {
    const proposed = r.planRepairs.filter(repair => repair.edits.length);
    if (proposed.length) lines.push(`Semantic proposals: ${proposed.length}; inspect their edits, then use mr plan edit rather than changing generated layers.`, ...proposed.slice(0, 4).map(repair => `  ${repair.id}${repair.beatId ? ` [beat ${repair.beatId}]` : ''}: ${repair.rationale}`));
  }
  if (result.video) lines.push(`${result.video.draft ? 'Draft video' : 'Video'}: ${result.video.output} (${result.video.seconds.toFixed(1)} s, rendered in ${result.video.renderSeconds} s)`);
  for (const check of result.video?.checks ?? []) lines.push(`  ${check.severity === 'error' ? 'VIDEO ERROR' : check.severity === 'warning' ? 'video warn' : 'video note'} ${check.message}`);
  lines.push(`Time: ${Object.entries(result.timings).map(([step, took]) => `${step} ${took} s`).join(', ')}`);
  lines.push('', ...result.next);
  return lines.join('\n');
}
