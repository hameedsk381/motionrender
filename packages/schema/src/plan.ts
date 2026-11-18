import { z } from 'zod';
import { assetSchema } from './assets';
import { contentDatumSchema, contentSchema, contentSourceSchema } from './content';
import { variablesSchema } from './variables';
import { productionApprovalSchema, productionStyleSchema } from './production';
import { sceneInputSchema } from './scene-input';

const source = z.string().min(1);
export const videoPlanCommentSchema = z.object({
  frame: z.number().int().nonnegative().optional().describe('Absolute frame in the preview composition.'),
  elementId: z.string().min(1).optional().describe('Optional visual element targeted by this feedback.'),
  id: z.string().min(1), beatId: z.string().min(1).optional(), body: z.string().min(1), author: z.string().min(1).optional(), createdAt: z.string().optional(), resolvedAt: z.string().optional(), resolvedBy: z.string().min(1).optional(),
}).describe('A shared review comment on the whole plan or one named beat. Comments remain in the plan for auditability; resolving does not delete them.');
const approvalHistorySchema = productionApprovalSchema.extend({ by: z.string().min(1).optional() });
const sceneModuleSchema = z.object({
  id: z.string().min(1),
  renderer: z.literal('react').default('react'),
  src: z.string().min(1).describe('A trusted React bundle built with `mr build`, relative to the plan.'),
  props: z.record(z.string(), z.unknown()).default({}).describe('Static defaults passed to every use of this module.'),
  assets: z.array(z.string().min(1)).default([]).describe('Declared composition asset ids exposed to the module as props.assets.'),
  resolution: z.number().min(0.5).max(4).default(1),
}).describe('A reusable full-scene React implementation. Its runtime receives deterministic frame, t, fps and durationInFrames values from MotionRender.');
export const videoPlanVisualSchema = z.object({
  input: sceneInputSchema.optional(),
  direction: z.string().optional().describe('Creative direction retained as production metadata, not renderer coordinates.'),
  scene: z.string().min(1).optional().describe('A semantic scene-catalog id such as workflow or proof-stat; the compiler chooses the concrete renderer.'),
  module: z.string().min(1).optional().describe('A sceneModules id. The module fills this beat and receives beat data plus deterministic time from the runtime.'),
  props: z.record(z.string(), z.unknown()).default({}).describe('Per-beat props merged over the module defaults.'),
  asset: source.optional().describe('An image/video asset id, URL, or relative path. Without one the compiler creates an editable text-card placeholder.'),
  media: z.enum(['auto', 'image', 'video']).default('auto'), fit: z.enum(['cover', 'contain', 'fill']).default('cover'),
  transition: z.enum(['cut', 'fade', 'slide', 'wipe', 'zoom']).default('cut'),
});
export const videoPlanBeatSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1).describe('The communication job of this beat, such as “establish the problem” or “prove the result”.'),
  durationSeconds: z.number().positive().default(3), onScreen: z.string().optional(), narration: z.string().optional(),
  claim: z.string().optional().describe('A factual assertion this beat makes. Claims require cited sources with verified quotes.'),
  data: z.array(contentDatumSchema).default([]).describe('Figures shown in this beat, each cited to one or more sources.'),
  sourceIds: z.array(z.string().min(1)).default([]).describe('Sources backing this beat’s claim.'),
  visual: videoPlanVisualSchema.default({ props: {}, media: 'auto', fit: 'cover', transition: 'cut' }),
});

/** Agent-facing intent; compilation owns all renderer coordinates and keyframes. */
export const videoPlanSchema = z.object({
  version: z.literal('1.0').default('1.0'),
  kind: z.literal('video-plan').default('video-plan'),
  id: z.string().min(1), name: z.string().min(1),
  brief: z.object({ prompt: z.string().min(1), audience: z.string().optional(), goal: z.string().optional(), targetDurationSeconds: z.number().positive().optional() }),
  format: z.object({ width: z.number().int().positive().default(1920), height: z.number().int().positive().default(1080), fps: z.number().int().positive().max(240).default(30) }).default({ width: 1920, height: 1080, fps: 30 }),
  style: productionStyleSchema.optional(), approvals: z.array(productionApprovalSchema).default([]).describe('Current state of script, characters, storyboard, preview, and final checkpoints.'), approvalHistory: z.array(approvalHistorySchema).default([]).describe('Append-only approval decisions, including who made each decision.'), comments: z.array(videoPlanCommentSchema).default([]).describe('Shared plan and beat comments.'), variables: variablesSchema.default({}).describe('Typed personalization inputs, used as {{name}} in plan copy and passed through to batch rendering.'), assets: z.array(assetSchema).default([]), sources: z.array(contentSourceSchema).default([]).describe('Evidence behind factual beats; cited sources need a verified quote.'), sceneModules: z.array(sceneModuleSchema).default([]),
  audio: z.object({ music: source.optional(), volume: z.number().min(0).max(4).default(1), duck: z.boolean().default(true) }).optional(),
  export: z.object({ format: z.enum(['mp4', 'webm', 'mov']).optional(), loudness: z.number().min(-40).max(-5).optional(), grain: z.number().min(0).max(1).optional() }).optional(),
  beats: z.array(videoPlanBeatSchema).min(1),
}).superRefine((plan, ctx) => {
  const ids = new Set<string>(), moduleIds = new Set<string>(), assets = new Map(plan.assets.map(asset => [asset.id, asset]));
  for (const [index, module] of plan.sceneModules.entries()) {
    if (moduleIds.has(module.id)) ctx.addIssue({ code: 'custom', path: ['sceneModules', index, 'id'], message: `Scene module id "${module.id}" is used twice` });
    moduleIds.add(module.id);
    for (const [assetIndex, asset] of module.assets.entries()) if (!assets.has(asset)) ctx.addIssue({ code: 'custom', path: ['sceneModules', index, 'assets', assetIndex], message: `Scene module "${module.id}" uses asset "${asset}", which is not in assets` });
  }
  for (const [index, beat] of plan.beats.entries()) {
    if (beat.visual.input && (beat.visual.input.type !== beat.visual.scene || beat.visual.module || beat.visual.asset)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'visual', 'input'], message: 'Typed inputs must match visual.scene and cannot be combined with a module or asset' });
    if (ids.has(beat.id)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'id'], message: `Beat id "${beat.id}" is used twice` });
    ids.add(beat.id); const asset = beat.visual.asset, type = asset ? assets.get(asset)?.type : undefined;
    if (beat.visual.module && !moduleIds.has(beat.visual.module)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'visual', 'module'], message: `Beat "${beat.id}" uses scene module "${beat.visual.module}", which is not in sceneModules` });
    if (beat.visual.module && beat.visual.asset) ctx.addIssue({ code: 'custom', path: ['beats', index, 'visual'], message: 'A beat uses either visual.module or visual.asset; pass module media through its declared assets and props' });
    if (type && beat.visual.media === 'image' && !['image', 'svg'].includes(type)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'visual', 'asset'], message: `Beat "${beat.id}" asks for an image but asset "${asset}" is ${type}` });
    if (type && beat.visual.media === 'video' && type !== 'video') ctx.addIssue({ code: 'custom', path: ['beats', index, 'visual', 'asset'], message: `Beat "${beat.id}" asks for video but asset "${asset}" is ${type}` });
  }
  const commentIds = new Set<string>();
  for (const [index, comment] of plan.comments.entries()) {
    if (commentIds.has(comment.id)) ctx.addIssue({ code: 'custom', path: ['comments', index, 'id'], message: `Comment id "${comment.id}" is used twice` });
    commentIds.add(comment.id);
    if (comment.beatId && !ids.has(comment.beatId)) ctx.addIssue({ code: 'custom', path: ['comments', index, 'beatId'], message: `Comment refers to unknown beat "${comment.beatId}"` });
  }
  const content = contentSchema.safeParse({ audience: plan.brief.audience, promise: plan.brief.goal, sources: plan.sources, beats: plan.beats.map(beat => ({ id: beat.id, name: beat.intent, seconds: beat.durationSeconds, onScreen: beat.onScreen ?? beat.intent, narration: beat.narration, claim: beat.claim, data: beat.data, sourceIds: beat.sourceIds })) });
  if (!content.success) for (const issue of content.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
});

export type VideoPlan = z.infer<typeof videoPlanSchema>;
export const videoPlanJsonSchema = z.toJSONSchema(videoPlanSchema, { target: 'draft-2020-12', io: 'input' });

export const videoPlanEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('update-beat'), id: z.string().min(1), changes: videoPlanBeatSchema.omit({ id: true }).partial() }),
  z.object({ op: z.literal('insert-beat'), beat: videoPlanBeatSchema, after: z.string().min(1).optional() }),
  z.object({ op: z.literal('remove-beat'), id: z.string().min(1) }),
  z.object({ op: z.literal('move-beat'), id: z.string().min(1), after: z.string().min(1).optional() }),
  z.object({ op: z.literal('update-brief'), changes: z.object({ prompt: z.string().min(1).optional(), audience: z.string().optional(), goal: z.string().optional(), targetDurationSeconds: z.number().positive().optional() }) }),
  z.object({ op: z.literal('set-style'), style: productionStyleSchema.optional() }),
  z.object({ op: z.literal('set-approval'), approval: productionApprovalSchema }),
  z.object({ op: z.literal('add-comment'), comment: videoPlanCommentSchema }),
  z.object({ op: z.literal('resolve-comment'), id: z.string().min(1), resolvedAt: z.string().optional(), resolvedBy: z.string().min(1).optional() }),
]);
export const videoPlanEditsSchema = z.array(videoPlanEditSchema).min(1);
export type VideoPlanEdit = z.infer<typeof videoPlanEditSchema>;
