import { z } from 'zod';
import { explainerKinds, explainerKindDocs, explainerLooks, explainerSchema, storyboardSchema, type Explainer } from '@ove/schema';
import { explainerVariants } from '@ove/schema';
import type { AiProvider, ChatMessage } from './providers';
import { extractJson } from './json';
import { reactGrounding } from './react-grounding';

const label = z.string().trim().min(1).max(28);
const actionTreatments = {
  route: 'Choose map for a network of places, or rail for a fixed station sequence with a visibly raised bypass.',
  split: 'Choose fork for rays or signals radiating outward, or manifold for two flows through a shared trunk and right-angle branches, such as irrigation or plumbing.',
  fold: 'Choose sheet for a tall printed sheet with a continuous turn, or booklet for a wide cover with a brief pause at the crease.',
};
const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('route'), trips: z.array(z.object({ name: label, via: z.array(label).min(2).max(8) })).min(1).max(3) }),
  z.object({ kind: z.literal('split'), origin: label, endpoints: z.tuple([label, label]) }),
  z.object({ kind: z.literal('fold'), inside: z.string().trim().min(1).max(32), cover: z.string().trim().min(1).max(32) }),
]);
const intentSchema = z.object({
  silent: z.boolean(),
  singleShot: z.boolean(),
  assets: z.array(z.string().trim().min(1).max(200)),
  actions: z.array(actionSchema).max(12),
}).superRefine(({ actions }, ctx) => {
  actions.forEach((action, i) => {
    if (action.kind === 'route') {
      const names = new Set(action.trips.map(trip => trip.name));
      const stops = new Set(action.trips.flatMap(trip => trip.via));
      if (names.size !== action.trips.length || stops.size > 5 || action.trips.some(trip => trip.via.some((stop, j) => stop === trip.via[j - 1]))) {
        ctx.addIssue({ code: 'custom', path: ['actions', i], message: 'Use unique trip names and up to five distinct stops with no consecutive duplicate visits' });
      }
    }
    if (action.kind === 'split' && new Set([action.origin, ...action.endpoints]).size !== 3) {
      ctx.addIssue({ code: 'custom', path: ['actions', i], message: 'Use three distinct labels for the origin and endpoints' });
    }
  });
});

const direction = z.object({
  topic: z.string().trim().min(1).max(40),
  look: z.enum(explainerLooks),
  scenes: z.array(z.object({ kind: z.enum(explainerKinds), action: z.number().int().min(1).optional(), storyboard: storyboardSchema })).min(1).max(12),
});

function preserveAction(action: z.infer<typeof actionSchema>, value: unknown) {
  const scene = z.looseObject({ kind: z.string() }).parse(value);
  if (action.kind === 'route' && scene.kind === 'route') {
    return { ...scene, stops: [...new Set(action.trips.flatMap(trip => trip.via))], trips: action.trips };
  }
  if (action.kind === 'split' && scene.kind === 'split') {
    const branch = z.object({ direction: z.string() });
    const [first, second] = z.tuple([branch, branch]).parse(scene.branches);
    return { ...scene, origin: action.origin, branches: [{ ...first, endpoint: action.endpoints[0] }, { ...second, endpoint: action.endpoints[1] }] };
  }
  if (action.kind === 'fold' && scene.kind === 'fold') {
    return { artwork: 'print', direction: 'right-to-left', ...scene, inside: action.inside, cover: action.cover };
  }
  return scene;
}

function singleScene(value: unknown): unknown {
  const parsed = z.object({
    kind: z.string().optional(),
    scene: z.unknown().optional(),
    scenes: z.tuple([z.unknown()]).optional(),
  }).safeParse(value);
  if (!parsed.success || parsed.data.kind) return value;
  return parsed.data.scene ?? parsed.data.scenes?.[0] ?? value;
}

/** Plan from the whole drawing library, then ask for just the selected component's inputs. */
export async function directReactDesign(
  provider: AiProvider, brief: string, aspect: Explainer['aspect'], attempts = 3,
  options: { mediaAvailable?: (src: string) => boolean } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error('Use 1–10 attempts');
  const grounding = reactGrounding(brief);
  async function ask<T>(stage: string, prompt: string, validate: (data: unknown) => T): Promise<T> {
    const messages: ChatMessage[] = [{ role: 'system', content: 'Design a frame-driven video. Return JSON only. Ground every claim, figure and asset reference in the brief.' }, { role: 'user', content: prompt }];
    for (let i = 0; i < attempts; i++) {
      const answer = await provider.chat(messages, { task: 'direct', json: true, maxTokens: 3200 });
      try { return validate(extractJson(answer)); } catch (error) {
        const problem = error instanceof z.ZodError
          ? error.issues.map(issue => {
            const path = stage.startsWith('Scene ') && issue.path[0] === 'scenes' && issue.path[1] === 0 ? issue.path.slice(2) : issue.path;
            return `${path.join('.') || 'response'}: ${issue.message}`;
          }).join('\n')
          : (error as Error).message;
        if (i + 1 === attempts) throw new Error(`${stage} could not be completed after ${attempts} attempt(s):\n${problem}`, { cause: error });
        // Keep only the latest failed reply. Send the original contract again
        // so a correction cannot drift into the storyboard shape.
        messages.splice(2, messages.length - 2,
          { role: 'assistant', content: answer },
          { role: 'user', content: `Return a complete replacement JSON object for ${stage}. Keep the original shape and satisfy these corrections:\n${problem}` });
      }
    }
    throw new Error('Direction exhausted');
  }
  const intent = await ask('Brief requirements', `Extract requirements from this brief before designing any scenes:
${brief}
Return {silent:boolean,singleShot:boolean,assets:string[],actions:[]}.
Set silent for a video explicitly requested without sound. Set singleShot for a single continuous product shot or action.
List only actual file paths or media URLs supplied verbatim in the brief, never imagined assets.
In viewing order, use only these action shapes where applicable:
- {kind:"route",trips:[{name,via:[stop,...]}]} for ordered visits, especially comparing a path with a bypass. Keep both paths in one action. Up to five distinct stop labels.
- {kind:"split",origin,endpoints:[first,second]} for one source reaching two endpoints simultaneously.
- {kind:"fold",inside,cover} for an open sheet physically closing to reveal its cover. The opening view and the closed cover belong to one action. Extract the exact words viewers should read. Remove surrounding language about where the text appears or what the camera does. For "Start on the open page headed Orchard. Close it to show Field Notes on the cover", inside is "Orchard" and cover is "Field Notes".
Use an empty actions array for other motions. Do not add actions, stops, or facts beyond the brief.`, value => {
    const parsed = intentSchema.parse(value);
    if (parsed.assets.some(asset => !brief.includes(asset))) throw new Error('Only list assets supplied verbatim in the brief');
    grounding.checkCopy(parsed.actions);
    return parsed;
  });
  const assets = intent.assets.filter(src => options.mediaAvailable?.(src) ?? true);
  const catalog = explainerKindDocs.filter(doc => doc.kind !== 'media' || assets.length > 0)
    .map(doc => doc.kind + ': ' + doc.shows).join('\n');
  const board = await ask('Storyboard', `Brief: ${brief}\nRequirements: ${JSON.stringify({ ...intent, assets })}\nAvailable React drawings:\n${catalog}
Choose a look from ${explainerLooks.join(', ')}. Return {topic,look,scenes:[{kind,action?,storyboard:{visible,change,takeaway,moment}}]}.
Match each required action in order to one scene of the same kind. Set action to its one-based index. Omit action for supporting scenes.
Use stat or chart only for numbers supplied in the brief. If a media file is unavailable, choose another drawing.
Use only as many scenes as the brief needs. A single shot must have exactly one scene. Do not add a separate opener or closer to it.
Use one short line per description and a number 0–1 for the decisive moment.`, value => {
    const parsed = direction.parse(value);
    grounding.checkCopy(parsed);
    if (intent.singleShot && parsed.scenes.length !== 1) throw new Error('A single shot must have exactly one scene');
    let next = 1;
    for (const scene of parsed.scenes) {
      if (scene.kind === 'media' && !assets.length) throw new Error('Use a drawing because no supplied media files are available');
      if (scene.action === undefined) {
        if (scene.kind === 'fold' || scene.kind === 'route' || scene.kind === 'split') throw new Error(`Assign ${scene.kind} to a required action using its index`);
        continue;
      }
      if (scene.action !== next || intent.actions[next - 1]?.kind !== scene.kind) {
        throw new Error(`Use action ${next} once, in order, with its declared kind`);
      }
      next++;
    }
    if (next <= intent.actions.length) throw new Error(`Include required actions ${next} through ${intent.actions.length}`);
    return parsed;
  });
  const scenes = [];
  for (const [index, beat] of board.scenes.entries()) {
    const doc = explainerKindDocs.find(item => item.kind === beat.kind)!;
    const variants = explainerVariants[beat.kind] ?? [];
    const action = beat.action === undefined ? undefined : intent.actions[beat.action - 1];
    const requirements = action ? `Use this action exactly: ${JSON.stringify(action)}. ${actionTreatments[action.kind]}` : '';
    const media = beat.kind === 'media' ? `Use src from this list: ${JSON.stringify(assets)}.` : '';
    const closing = beat.kind === 'closing' ? 'Set title to a short takeaway. Include up to three points or omit points.' : '';
    const scene = await ask(`Scene ${index + 1} (${beat.kind})`, `Brief: ${brief}\nTopic: ${board.topic}\nScene: ${JSON.stringify(beat)}\n${requirements} ${media} ${closing}
Return exactly one flat JSON scene object with kind="${beat.kind}" at the top level. Fill the selected React drawing. The following example shows the shape only. Do not reuse its facts or figures: ${JSON.stringify(doc.example)}.
Use the brief's own content. Keep directions to the filmmaker out of printed copy. Available variants: ${variants.join(', ') || 'automatic'}.`, value => {
      const unwrapped = singleScene(value);
      const input = action ? preserveAction(action, unwrapped) : unwrapped;
      const parsed = explainerSchema.parse({ topic: board.topic, scenes: [input] }).scenes[0]!;
      if (parsed.kind !== beat.kind || (parsed.variant && !variants.includes(parsed.variant))) throw new Error('Use the selected kind and a listed variant, or omit variant');
      if (parsed.kind === 'media' && !assets.includes(parsed.src ?? '')) throw new Error('Use src from the available assets');
      if (intent.silent) delete parsed.say;
      grounding.checkCopy(parsed);
      if (parsed.kind === 'stat') grounding.checkData(parsed.value);
      if (parsed.kind === 'chart') for (const item of parsed.items) {
        grounding.checkData(String(item.value));
        if (parsed.unit) grounding.checkCopy(`${item.value} ${parsed.unit}`);
      }
      if (parsed.kind === 'quote' && (!brief.includes(parsed.text) || !brief.includes(parsed.source))) {
        throw new Error('Use the exact quote and source name supplied in the brief.');
      }
      return { ...parsed, storyboard: beat.storyboard };
    });
    scenes.push(scene);
  }
  return explainerSchema.parse({ topic: board.topic, look: board.look, aspect, scenes, ...(intent.silent ? { silent: true, music: 'none', captions: false } : {}) });
}
