import { compileVideoPlanRequest, parseRequest, saveVideoPlanRequest } from '@ove/contracts';
import { compileVideoPlan, measureMedia, planCollaborationStatus, recommendPlanAssets, reviewPlanAssets, reviewVideoPlan } from '@ove/core';
import { assertSourcesConfined, summarizeChange } from '@ove/ai';
import { loadComposition, videoPlanSchema, type VideoPlan } from '@ove/schema';
import type { Ctx, Route } from '../types';
import { sceneChangeManifest } from '@ove/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { sceneCatalog } from '@ove/core';
import { sampleReferenceVideo } from '../reference-video';
import { readdir } from 'node:fs/promises';

const PROJECT_FILE = 'video.plan.json';
const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }) => error.issues.map(issue => ({ path: issue.path.map(String).join('.'), message: issue.message }));
const existing = async (c: Ctx, value: unknown) => {
  const id = typeof value === 'string' ? value : '';
  if (!id) throw new Error('project is required');
  c.deps.store.projectDir(c.who, id);
  if (!await c.deps.store.exists(c.who, id)) throw new Error(`There is no project "${id}"`);
  return id;
};
const revisionOf = async (c: Ctx, id: string) => (await c.deps.store.revisions(c.who, id, PROJECT_FILE)).at(-1)!;

function draft(id: string, composition: ReturnType<typeof loadComposition>): VideoPlan {
  const duration = Math.max(3, Math.round(composition.durationFrames / composition.fps));
  return videoPlanSchema.parse({
    id, name: composition.name || id.replace(/-/g, ' '),
    brief: { prompt: 'Describe the video you want to make.', targetDurationSeconds: duration },
    format: { width: composition.width, height: composition.height, fps: composition.fps },
    beats: [{ id: 'hook', intent: 'Establish the central idea', durationSeconds: duration, onScreen: composition.name || 'Your story starts here', visual: { scene: 'kinetic-hook' } }],
  });
}

async function state(c: Ctx, id: string, raw: unknown, modified: number) {
  const parsed = videoPlanSchema.safeParse(raw);
  if (!parsed.success) return { plan: raw, valid: false, issues: issuesOf(parsed.error), review: [], assets: {}, status: null, modified, base: `/files/${id}/` };
  const plan = parsed.data;
  return {
    plan, valid: true, issues: [], review: [...reviewVideoPlan(plan), ...reviewPlanAssets(plan)],
    assets: Object.fromEntries(plan.beats.map(beat => [beat.id, recommendPlanAssets(plan, beat.id).slice(0, 3)])),
    status: planCollaborationStatus(plan), modified, base: `/files/${id}/`,
  };
}

/** Durable semantic plans: an agent-readable brief and beats, separate from the compiled composition. */
export function videoPlanRoutes(): Route[] {
  return [
    { method: 'POST', path: '/api/video-plan/reference', handle: async c => {
      if (c.deps.mode !== 'local') return c.json(403, { error: 'Reference extraction is available in local Studio.' });
      const request = await c.body(), id = await existing(c, request.id);
      const asset = (await c.deps.store.assets(c.who, id)).find(item => item.name === request.asset && item.kind === 'video');
      if (!asset) throw new Error('Choose an uploaded video asset');
      const { dir, commit } = await c.deps.store.workdir(c.who, id);
      const key = createHash('sha256').update(`${asset.path}:${asset.bytes}:${Date.now()}`).digest('hex').slice(0, 20);
      const folder = join(dir, 'references', key), result = await sampleReferenceVideo(join(dir, asset.path), folder);
      const frames = (await readdir(folder)).filter(file => /^frame-\d+\.jpg$/.test(file)).sort();
      await commit();
      c.json(200, { ...result, frames: frames.map((file, index) => ({ seconds: index * result.interval, url: `/files/${encodeURIComponent(id)}/references/${key}/${file}` })) });
    } },
    { method: 'GET', path: '/api/video-plan/catalog', handle: async c => {
      const query = (c.url.searchParams.get('q') ?? '').toLowerCase();
      c.json(200, { scenes: sceneCatalog.filter(scene => `${scene.name} ${scene.purpose} ${scene.keywords.join(' ')}`.toLowerCase().includes(query)) });
    } },
    { method: 'POST', path: '/api/video-plan/build-scene', handle: async c => {
      if (c.deps.mode !== 'local' || !c.deps.buildScene) return c.json(403, { error: 'Source building is available in local Studio.' });
      const request = await c.body(), id = await existing(c, request.id);
      if (typeof request.source !== 'string' || !request.source.trim() || request.source.length > 200000) throw new Error('Provide scene source under 200 KB');
      const key = createHash('sha256').update(request.source).digest('hex').slice(0, 20);
      const { dir, commit } = await c.deps.store.workdir(c.who, id);
      const folder = join(dir, 'scenes', key); await mkdir(folder, { recursive: true });
      const source = join(folder, 'scene.tsx');
      await writeFile(source, request.source);
      await c.deps.buildScene(source, join(folder, 'composition.json'));
      await commit();
      c.json(200, { src: `scenes/${key}/scene.bundle.js`, source: `scenes/${key}/scene.tsx` });
    } },
    { method: 'GET', path: '/api/video-plan', handle: async c => {
      const id = await existing(c, c.url.searchParams.get('id')), raw = await c.deps.store.readVideoPlan(c.who, id);
      if (raw === undefined) return c.json(200, { plan: null, valid: false, issues: [], review: [], assets: {}, status: null, modified: 0, base: `/files/${id}/` });
      c.json(200, await state(c, id, raw, (await c.deps.store.videoPlanModified(c.who, id)) ?? 0));
    } },
    { method: 'POST', path: '/api/video-plan/init', handle: async c => {
      const request = parseRequest(saveVideoPlanRequest.pick({ id: true }), await c.body()), id = await existing(c, request.id);
      if (await c.deps.store.videoPlanModified(c.who, id) !== undefined) return c.json(409, { error: 'This project already has a semantic plan' });
      const plan = draft(id, loadComposition(await c.deps.store.readRaw(c.who, id)));
      await c.deps.store.writeVideoPlan(c.who, id, plan, { kind: 'edit', label: 'Started a semantic plan' });
      c.json(200, { ...await state(c, id, plan, (await c.deps.store.videoPlanModified(c.who, id)) ?? 0), revision: await revisionOf(c, id) });
    } },
    { method: 'POST', path: '/api/video-plan', handle: async c => {
      const request = parseRequest(saveVideoPlanRequest, await c.body()), id = await existing(c, request.id), parsed = videoPlanSchema.safeParse(request.plan);
      if (!parsed.success) return c.json(400, { error: 'The semantic plan has problems to fix before it can be saved', issues: issuesOf(parsed.error) });
      const current = await c.deps.store.videoPlanModified(c.who, id);
      if (request.baseModified !== undefined && (current ?? 0) !== request.baseModified) return c.json(409, { error: 'The semantic plan changed in another tab. Reload it before saving.' });
      await c.deps.store.writeVideoPlan(c.who, id, parsed.data, { kind: 'edit', label: 'Edited the semantic plan' });
      c.json(200, { ...await state(c, id, parsed.data, (await c.deps.store.videoPlanModified(c.who, id)) ?? 0), revision: await revisionOf(c, id) });
    } },
    { method: 'POST', path: '/api/video-plan/compile', handle: async c => {
      const request = parseRequest(compileVideoPlanRequest, await c.body()), id = await existing(c, request.id), raw = await c.deps.store.readVideoPlan(c.who, id);
      if (raw === undefined) return c.json(400, { error: 'This project has no semantic plan yet' });
      if (request.baseModified !== undefined && request.baseModified !== await c.deps.store.videoPlanModified(c.who, id)) return c.json(409, { error: 'The semantic plan changed in another tab. Reload it before compiling.' });
      if (request.plan && !request.dryRun) throw new Error('Save the plan before building the timeline');
      const parsed = videoPlanSchema.safeParse(request.dryRun && request.plan ? request.plan : raw);
      if (!parsed.success) return c.json(400, { error: 'The semantic plan cannot be compiled yet', issues: issuesOf(parsed.error) });
      const compiled = compileVideoPlan(parsed.data), current = loadComposition(await c.deps.store.readRaw(c.who, id));
      if (c.deps.mode === 'hosted') assertSourcesConfined(compiled.composition);
      const result = { dryRun: request.dryRun, notes: compiled.notes, changes: summarizeChange(current, compiled.composition), composition: { scenes: compiled.composition.scenes.length, durationFrames: compiled.composition.durationFrames, fps: compiled.composition.fps, width: compiled.composition.width, height: compiled.composition.height } };
      const sceneChanges = sceneChangeManifest(current, compiled.composition);
      if (request.dryRun) {
        const composition = compiled.composition, { dir } = await c.deps.store.workdir(c.who, id);
        const preview = {
          id, name: composition.name, width: composition.width, height: composition.height, fps: composition.fps, durationFrames: composition.durationFrames, mode: 'finished',
          scenes: composition.scenes.map(scene => ({ id: scene.id, name: scene.name, startFrame: scene.startFrame, durationFrames: scene.durationFrames, beat: scene.beat })),
          variables: [], theme: {}, texts: [], assets: [], revisions: 0, blocks: [],
          source: { raw: composition, media: await measureMedia(composition, dir), base: `/files/${id}/` },
        };
        return c.json(200, { ...result, preview, sceneChanges });
      }
      await c.deps.store.writeRaw(c.who, id, compiled.composition, { kind: 'compose', label: `Compiled ${parsed.data.name}` });
      c.json(200, { ...result, sceneChanges, revision: (await c.deps.store.revisions(c.who, id)).at(-1)! });
    } },
  ];
}
