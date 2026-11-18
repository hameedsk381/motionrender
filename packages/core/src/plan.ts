import { parseComposition, productionSchema, type Production, type VideoPlan, type VideoPlanEdit, videoPlanEditsSchema, videoPlanSchema } from '@ove/schema';
import { compileProduction, type CompiledProduction } from './production';
import { sceneCatalog } from './scene-catalog';
import { compileSemanticScene } from './scene-compiler';
import { reviewPlanAssets } from './asset-intelligence';
import { reviewRepairTasks, type ReviewIssue, type ReviewRepairTask } from './review';

const mediaFor = (plan: VideoPlan, source: string | undefined, preference: 'auto' | 'image' | 'video') => {
  if (!source) return undefined;
  const declared = plan.assets.find(asset => asset.id === source);
  const type = preference === 'auto' ? declared?.type ?? (/\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(source) ? 'video' : 'image') : preference;
  return type === 'video' ? { video: source } : { image: source };
};

/** Compiles a semantic plan through the established production and composition contracts. */
export function compileVideoPlan(input: VideoPlan | unknown): CompiledProduction & { production: Production } {
  const plan = videoPlanSchema.parse(input);
  const production = productionSchema.parse({
    version: '1.0', id: plan.id, name: plan.name, productionType: 'hybrid', brief: plan.brief, format: plan.format, style: plan.style, approvals: plan.approvals, assets: plan.assets, audio: plan.audio, export: plan.export,
    script: { audience: plan.brief.audience, promise: plan.brief.goal, sources: plan.sources, beats: plan.beats.map(beat => ({ id: beat.id, name: beat.intent, seconds: beat.durationSeconds, onScreen: beat.onScreen ?? beat.intent, narration: beat.narration, claim: beat.claim, data: beat.data, sourceIds: beat.sourceIds })) },
    shots: plan.beats.map(beat => {
      const media = mediaFor(plan, beat.visual.asset, beat.visual.media);
      return { id: beat.id, sceneId: beat.id, name: beat.intent, action: beat.visual.direction ?? beat.intent, durationSeconds: beat.durationSeconds, onScreen: beat.onScreen, beatId: beat.id,
        ...(media ? { media: { ...media, fit: beat.visual.fit, audio: true } } : {}), ...(beat.visual.transition === 'cut' ? {} : { transition: beat.visual.transition }) };
    }),
  });
  const compiled = compileProduction(production);
  // Keep typed variables on the canonical composition so the existing --var and --batch
  // renderer resolves them before validation, exactly as it does for hand-written compositions.
  compiled.composition.variables = plan.variables;
  const palette = plan.style?.palette ?? {}, sceneOptions = { width: compiled.composition.width, height: compiled.composition.height, font: plan.style?.fonts?.display ?? 'Inter', ink: palette.text ?? '#f4f1ea', muted: palette.muted ?? '#9aa6c4', accent: palette.accent ?? '#22d3ee', surface: palette.surface ?? '#151c33' };
  for (const beat of plan.beats) {
    const act = plan.design?.acts.find(candidate => candidate.beatIds.includes(beat.id));
    if (!beat.visual.scene || beat.visual.module) continue;
    const scene = compiled.composition.scenes.find(candidate => candidate.id === beat.id);
    if (!scene) continue;
    const visual = compileSemanticScene(beat, { ...sceneOptions, ...(act ? { ink: act.ink, muted: act.ink, surface: act.surface ?? act.field, accent: act.accent ?? sceneOptions.accent } : {}), ...(plan.design ? { font: plan.design.typography.display } : {}), durationFrames: scene.durationFrames });
    if (!visual) continue;
    const audio = scene.layers.filter((layer: any) => layer.type === 'audio');
    // A selected semantic scene owns its primitive layers. Footage is deliberately retained as a background when present.
    const media = scene.layers.filter((layer: any) => layer.type === 'image' || layer.type === 'video');
    scene.layers = [...media, ...visual.layers, ...audio] as any;
    compiled.notes.push(`Beat "${beat.id}" compiled as ${visual.note} from semantic scene "${beat.visual.scene}".`);
  }
  for (const scene of compiled.composition.scenes) {
    const board = plan.beats.find(beat => beat.id === scene.id)?.storyboard;
    if (board) scene.metadata.storyboard = board;
  }
  const modules = new Map(plan.sceneModules.map(module => [module.id, module]));
  for (const beat of plan.beats) {
    const module = beat.visual.module ? modules.get(beat.visual.module) : undefined;
    if (!module) continue;
    const scene = compiled.composition.scenes.find(candidate => candidate.id === beat.id)!;
    const assets = Object.fromEntries(module.assets.map(id => [id, plan.assets.find(asset => asset.id === id)!.src]));
    // A module owns the visual scene; audio remains an ordinary composition layer so the existing mixer and review pipeline stay authoritative.
    const audio = scene.layers.filter((layer: any) => layer.type === 'audio');
    scene.layers = [{ id: `module:${beat.id}`, type: 'react', src: module.src, x: 0, y: 0, width: compiled.composition.width, height: compiled.composition.height,
      durationInFrames: scene.durationFrames, props: { ...module.props, ...beat.visual.props, ...(plan.design ? { design: plan.design } : {}), beat: { id: beat.id, intent: beat.intent, onScreen: beat.onScreen ?? beat.intent, narration: beat.narration }, assets }, resolution: module.resolution, startFrame: 0, endFrame: scene.durationFrames,
      opacity: 1, rotation: 0, scale: 1, scaleX: 1, scaleY: 1, originX: 0, originY: 0, zIndex: 0, visible: true, fixed: false, animations: [], blur: 0, blendMode: 'normal' } as any, ...audio];
    scene.assetIds = [...new Set([...scene.assetIds, ...module.assets])];
    compiled.notes.push(`Beat "${beat.id}" uses React scene module "${module.id}"; render with --allow-code only after trusting ${module.src}.`);
  }
  for (const act of plan.design?.acts ?? []) for (const id of act.beatIds) {
    const scene = compiled.composition.scenes.find(candidate => candidate.id === id)!;
    scene.layers.unshift({ id: `design-field:${id}`, type: 'rect', x: 0, y: 0, width: compiled.composition.width, height: compiled.composition.height, fill: act.field, startFrame: 0, endFrame: scene.durationFrames, zIndex: -1000 } as any);
  }
  compiled.composition = parseComposition(compiled.composition);
  return { ...compiled, production };
}

export function videoPlanSummary(input: VideoPlan | unknown) {
  const plan = videoPlanSchema.parse(input);
  return { beats: plan.beats.length, seconds: plan.beats.reduce((total, beat) => total + beat.durationSeconds, 0), placeholders: plan.beats.filter(beat => !beat.visual.asset).length };
}

export type VideoPlanChange = { op: string; id?: string; message: string };
export type VideoPlanEditResult = { plan: VideoPlan; changes: VideoPlanChange[] };
export type VideoPlanDiff = { added: string[]; removed: string[]; moved: string[]; changed: { id: string; fields: string[] }[]; sources: { added: string[]; removed: string[]; changed: string[] }; styleChanged: boolean; durationBefore: number; durationAfter: number };
export type VideoPlanReviewIssue = { severity: 'warning' | 'info'; code: string; message: string; beatId?: string };
export type PlanRepairProposal = { id: string; beatId?: string; task: ReviewRepairTask; edits: VideoPlanEdit[]; rationale: string; automatic: false };

/** Converts visual-review findings into inspectable, reversible beat-level edit proposals. */
export function proposePlanRepairs(input: VideoPlan | unknown, issues: ReviewIssue[]): PlanRepairProposal[] {
  const plan = videoPlanSchema.parse(input), composition = compileVideoPlan(plan).composition, tasks = reviewRepairTasks(composition, issues);
  return tasks.map(task => {
    const beatId = task.target.beatId, beat = beatId ? plan.beats.find(candidate => candidate.id === beatId) : undefined;
    let edits: VideoPlanEdit[] = [], rationale = 'Review the target and choose a semantic edit; this issue does not have a safe mechanical fix.';
    if (beat && (task.issues.some(issue => issue.code === 'read-time') || task.issues.some(issue => issue.code === 'caption-speed'))) {
      const words = (beat.onScreen ?? beat.intent).trim().split(/\s+/).filter(Boolean).length, duration = Math.max(beat.durationSeconds, Math.ceil((0.5 + words * 0.25) * 10) / 10);
      edits = [{ op: 'update-beat', id: beat.id, changes: { durationSeconds: duration } }];
      rationale = `Give ${words} on-screen words at least ${duration.toFixed(1)} s to read; shorten copy instead if total duration is fixed.`;
    } else if (beat && task.issues.some(issue => ['off-frame', 'safe-zone', 'overlap', 'text-cut'].includes(issue.code))) {
      edits = [{ op: 'update-beat', id: beat.id, changes: { visual: { ...beat.visual, direction: `${beat.visual.direction ?? beat.intent} Keep primary copy inside safe zones with one clear hierarchy.` } } }];
      rationale = 'Preserve the beat’s message, but make safe placement and hierarchy explicit to the visual compiler or scene-module author.';
    } else if (beat && task.issues.some(issue => issue.code === 'frozen')) {
      edits = [{ op: 'update-beat', id: beat.id, changes: { visual: { ...beat.visual, direction: `${beat.visual.direction ?? beat.intent} Add one slow continuous motion or purposeful reveal during the hold.` } } }];
      rationale = 'The renderer found a static hold; this adds a motion requirement without prescribing keyframes.';
    } else if (task.issues.some(issue => issue.code === 'mixed-transitions')) {
      edits = [{ op: 'set-style', style: { ...(plan.style ?? {}), transition: 'fade' } }];
      rationale = 'Use one deliberate transition family. Fade is a conservative starting proposal; keep another transition when it is intentional.';
    }
    return { id: task.id, ...(beatId ? { beatId } : {}), task, edits, rationale, automatic: false };
  });
}

/** Applies edits to narrative beats—not generated layer ids—and validates the complete result. */
export function editVideoPlan(input: VideoPlan | unknown, edits: VideoPlanEdit[] | unknown): VideoPlanEditResult {
  const plan = structuredClone(videoPlanSchema.parse(input));
  const operations = videoPlanEditsSchema.parse(edits), changes: VideoPlanChange[] = [];
  const indexOf = (id: string) => { const index = plan.beats.findIndex(beat => beat.id === id); if (index < 0) throw new Error(`No beat named "${id}" exists in this video plan`); return index; };
  for (const operation of operations) {
    if (operation.op === 'update-beat') {
      const index = indexOf(operation.id), before = plan.beats[index]!;
      plan.beats[index] = { ...before, ...operation.changes, visual: operation.changes.visual ? { ...before.visual, ...operation.changes.visual, props: { ...before.visual.props, ...operation.changes.visual.props } } : before.visual };
      changes.push({ op: operation.op, id: operation.id, message: `Updated beat "${operation.id}".` });
    } else if (operation.op === 'insert-beat') {
      const position = operation.after === undefined ? plan.beats.length : indexOf(operation.after) + 1;
      plan.beats.splice(position, 0, operation.beat); changes.push({ op: operation.op, id: operation.beat.id, message: `Inserted beat "${operation.beat.id}".` });
    } else if (operation.op === 'remove-beat') {
      plan.beats.splice(indexOf(operation.id), 1); changes.push({ op: operation.op, id: operation.id, message: `Removed beat "${operation.id}".` });
    } else if (operation.op === 'move-beat') {
      const from = indexOf(operation.id), [beat] = plan.beats.splice(from, 1), position = operation.after === undefined ? 0 : indexOf(operation.after) + 1;
      plan.beats.splice(position, 0, beat!); changes.push({ op: operation.op, id: operation.id, message: `Moved beat "${operation.id}"${operation.after ? ` after "${operation.after}"` : ' to the opening'}.` });
    } else if (operation.op === 'update-brief') {
      plan.brief = { ...plan.brief, ...operation.changes }; changes.push({ op: operation.op, message: 'Updated the video brief.' });
    } else if (operation.op === 'set-style') {
      plan.style = operation.style; changes.push({ op: operation.op, message: 'Updated the visual style.' });
    } else if (operation.op === 'set-approval') {
      const index = plan.approvals.findIndex(approval => approval.stage === operation.approval.stage);
      if (index >= 0) plan.approvals[index] = operation.approval; else plan.approvals.push(operation.approval);
      plan.approvalHistory.push({ ...operation.approval });
      changes.push({ op: operation.op, id: operation.approval.stage, message: `${operation.approval.approved ? 'Approved' : 'Returned'} ${operation.approval.stage} checkpoint.` });
    } else if (operation.op === 'add-comment') {
      if (plan.comments.some(comment => comment.id === operation.comment.id)) throw new Error(`Comment "${operation.comment.id}" already exists`);
      plan.comments.push(operation.comment); changes.push({ op: operation.op, id: operation.comment.id, message: `Added ${operation.comment.beatId ? `comment on beat "${operation.comment.beatId}"` : 'plan comment'}.` });
    } else {
      const comment = plan.comments.find(item => item.id === operation.id);
      if (!comment) throw new Error(`No comment named "${operation.id}" exists in this video plan`);
      comment.resolvedAt = operation.resolvedAt ?? new Date().toISOString(); if (operation.resolvedBy) comment.resolvedBy = operation.resolvedBy;
      changes.push({ op: operation.op, id: operation.id, message: `Resolved comment "${operation.id}".` });
    }
  }
  const validated = videoPlanSchema.safeParse(plan);
  if (!validated.success) throw new Error(`The edited plan is invalid:\n${validated.error.issues.map(issue => `- ${issue.path.join('.') || 'plan'}: ${issue.message}`).join('\n')}`);
  return { plan: validated.data, changes };
}

/** A stable, intent-level diff for review before recompiling a plan. */
export function diffVideoPlans(beforeInput: VideoPlan | unknown, afterInput: VideoPlan | unknown): VideoPlanDiff {
  const before = videoPlanSchema.parse(beforeInput), after = videoPlanSchema.parse(afterInput);
  const beforeById = new Map(before.beats.map(beat => [beat.id, beat])), afterById = new Map(after.beats.map(beat => [beat.id, beat]));
  const added = after.beats.filter(beat => !beforeById.has(beat.id)).map(beat => beat.id), removed = before.beats.filter(beat => !afterById.has(beat.id)).map(beat => beat.id);
  const moved = after.beats.filter(beat => beforeById.has(beat.id) && before.beats.findIndex(candidate => candidate.id === beat.id) !== after.beats.findIndex(candidate => candidate.id === beat.id)).map(beat => beat.id);
  const changed = after.beats.flatMap(beat => {
    const original = beforeById.get(beat.id); if (!original) return [];
    const fields = (['intent', 'durationSeconds', 'onScreen', 'narration', 'claim', 'data', 'sourceIds', 'visual'] as const).filter(field => JSON.stringify(original[field]) !== JSON.stringify(beat[field]));
    return fields.length ? [{ id: beat.id, fields: [...fields] }] : [];
  });
  const sourceDiff = (field: 'added' | 'removed' | 'changed') => {
    const a = new Map(before.sources.map(source => [source.id, source])), b = new Map(after.sources.map(source => [source.id, source]));
    if (field === 'added') return after.sources.filter(source => !a.has(source.id)).map(source => source.id);
    if (field === 'removed') return before.sources.filter(source => !b.has(source.id)).map(source => source.id);
    return after.sources.filter(source => a.has(source.id) && JSON.stringify(a.get(source.id)) !== JSON.stringify(source)).map(source => source.id);
  };
  return { added, removed, moved, changed, sources: { added: sourceDiff('added'), removed: sourceDiff('removed'), changed: sourceDiff('changed') }, styleChanged: JSON.stringify(before.style) !== JSON.stringify(after.style), durationBefore: before.beats.reduce((total, beat) => total + beat.durationSeconds, 0), durationAfter: after.beats.reduce((total, beat) => total + beat.durationSeconds, 0) };
}

/** Fast, no-render review of the narrative plan before it becomes a composition. */
export function reviewVideoPlan(input: VideoPlan | unknown): VideoPlanReviewIssue[] {
  const plan = videoPlanSchema.parse(input), issues: VideoPlanReviewIssue[] = [];
  const total = plan.beats.reduce((sum, beat) => sum + beat.durationSeconds, 0);
  if (plan.brief.targetDurationSeconds !== undefined && Math.abs(total - plan.brief.targetDurationSeconds) > 0.5) issues.push({ severity: 'warning', code: 'duration-target', message: `Plan runs ${total.toFixed(1)} s but the brief asks for ${plan.brief.targetDurationSeconds.toFixed(1)} s.` });
  if (plan.beats.length >= 4 && plan.beats.length < 12 && plan.beats.every(beat => Math.abs(beat.durationSeconds - total / plan.beats.length) <= 0.1 * (total / plan.beats.length))) issues.push({ severity: 'warning', code: 'uniform-beats', message: `All ${plan.beats.length} beats are about ${(total / plan.beats.length).toFixed(1)} s; vary their length to create rhythm.` });
  const cited = new Set(plan.beats.flatMap(beat => [...beat.sourceIds, ...beat.data.flatMap(datum => datum.sourceIds)]));
  for (const source of plan.sources) if (!cited.has(source.id)) issues.push({ severity: 'info', code: 'unused-source', message: `Source "${source.id}" is not cited by any beat.` });
  for (const beat of plan.beats) {
    if (!beat.onScreen) issues.push({ severity: 'info', code: 'implicit-copy', beatId: beat.id, message: `Beat "${beat.id}" has no on-screen copy; compilation will show its intent as a placeholder.` });
    if (!beat.visual.asset && !beat.visual.module) issues.push({ severity: 'info', code: 'visual-placeholder', beatId: beat.id, message: `Beat "${beat.id}" has no media or scene module; compilation will use an editable text-card placeholder.` });
    if (beat.visual.scene && !sceneCatalog.some(scene => scene.id === beat.visual.scene)) issues.push({ severity: 'warning', code: 'unknown-scene', beatId: beat.id, message: `Beat "${beat.id}" names unknown scene "${beat.visual.scene}"; choose a catalog scene or omit it for a custom visual.` });
    if (beat.visual.scene) {
      const scene = sceneCatalog.find(entry => entry.id === beat.visual.scene);
      if (scene) {
        const missing = scene.inputs.filter(input => input.required && ((input.name === 'onScreen' && !beat.onScreen) || (input.name === 'visual.direction' && !beat.visual.direction) || (input.name === 'visual.asset' && !beat.visual.asset) || (input.name === 'claim' && !beat.claim) || (input.name === 'sourceIds' && !beat.sourceIds.length) || (input.name === 'data' && !beat.data.length))).map(input => input.name);
        if (missing.length) issues.push({ severity: 'warning', code: 'scene-contract', beatId: beat.id, message: `Beat "${beat.id}" uses ${scene.id} but is missing: ${missing.join(', ')}.` });
      }
    }
    const words = (beat.onScreen ?? beat.intent).trim().split(/\s+/).filter(Boolean).length, needed = 0.5 + words * 0.25;
    if (beat.durationSeconds < needed) issues.push({ severity: 'warning', code: 'copy-read-time', beatId: beat.id, message: `Beat "${beat.id}" is ${beat.durationSeconds.toFixed(1)} s, but its ${words} on-screen words need about ${needed.toFixed(1)} s to read.` });
    if (beat.narration) { const narrationWords = beat.narration.trim().split(/\s+/).filter(Boolean).length, rate = narrationWords / beat.durationSeconds; if (rate > 3) issues.push({ severity: 'warning', code: 'voice-speed', beatId: beat.id, message: `Beat "${beat.id}" asks for ${rate.toFixed(1)} spoken words/s; shorten narration or lengthen the beat.` }); }
  }
  issues.push(...reviewPlanAssets(plan));
  return issues;
}
