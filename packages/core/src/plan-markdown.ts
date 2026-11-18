import { type VideoPlan, videoPlanSchema } from '@ove/schema';

const standardFormats: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], '3:4': [1080, 1440] };
const value = (text: string) => text.trim().replace(/^['"]|['"]$/g, '');
const seconds = (text: string) => { const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(value(text)); return match ? Number(match[1]) : undefined; };
const fields = (body: string) => Object.fromEntries(body.split(/\r?\n/).map(line => /^([A-Za-z][\w -]*):\s*(.*)$/.exec(line.trim())).filter((entry): entry is RegExpExecArray => !!entry).map(entry => [entry[1]!.toLowerCase().replace(/\s+/g, '-'), value(entry[2]!)]));

/**
 * A deliberately small Markdown grammar: readable prose is the primary surface;
 * headings are beats and labelled lines retain the fields that need structure.
 */
export function parseVideoMarkdown(markdown: string): VideoPlan {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(normalized), meta = fields(front?.[1] ?? '');
  const body = normalized.slice(front?.[0].length ?? 0);
  const sourceLines = [...body.matchAll(/^>\s*Source\s*\[([^\]]+)\]\s*:\s*([^|]+?)(?:\s*\|\s*(.+))?\s*$/gmi)];
  const variableLines = [...body.matchAll(/^>\s*Variable\s+([\w-]+)\s*:\s*(string|number|boolean|color)(?:\s*=\s*(.+))?\s*$/gmi)];
  const headings = [...body.matchAll(/^#\s+(.+)\n([\s\S]*?)(?=^#\s+|(?![\s\S]))/gm)];
  const format = meta.format && standardFormats[meta.format] ? standardFormats[meta.format] : undefined;
  const title = meta.title ?? meta.name ?? 'Untitled video';
  const beats = headings.map((heading, index) => {
    const data = fields(heading[2]!);
    const visual = { ...(data['scene-input'] ? { input: JSON.parse(data['scene-input']) } : {}), ...(data.visual ? { direction: data.visual } : {}), ...(data.scene ? { scene: data.scene } : {}), ...(data.asset ? { asset: data.asset } : {}), ...(data.module ? { module: data.module } : {}), ...(data.transition ? { transition: data.transition } : {}), ...(data['media-fit'] ? { fit: data['media-fit'] } : {}) };
    return { id: data.id ?? (heading[1]!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `beat-${index + 1}`), intent: data.intent ?? heading[1]!, durationSeconds: seconds(data.duration ?? '') ?? 3, onScreen: data['on-screen'], narration: data.narration, claim: data.claim, sourceIds: data.source ? data.source.split(',').map(value).filter(Boolean) : [], visual };
  });
  const variables = Object.fromEntries(variableLines.map(match => {
    const type = match[2]!, raw = match[3] ? value(match[3]!) : undefined;
    const parsed = raw === undefined ? undefined : type === 'number' ? Number(raw) : type === 'boolean' ? raw.toLowerCase() === 'true' : raw;
    return [match[1]!, { type, ...(parsed === undefined ? {} : { default: parsed }) }];
  }));
  return videoPlanSchema.parse({ version: '1.0', kind: 'video-plan', id: meta.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: title,
    brief: { prompt: meta.prompt ?? meta.goal ?? title, audience: meta.audience, goal: meta.goal, targetDurationSeconds: seconds(meta.duration ?? '') },
    format: { width: format?.[0] ?? (Number(meta.width) || 1920), height: format?.[1] ?? (Number(meta.height) || 1080), fps: Number(meta.fps) || 30 }, variables,
    ...(meta.design ? { design: JSON.parse(meta.design) } : {}), sources: sourceLines.map(match => ({ id: match[1]!, url: value(match[2]!), quote: match[3] ? value(match[3]!) : undefined })), beats,
  });
}

/** The canonical Markdown representation; output is intentionally simple for people and agents to edit. */
export function formatVideoMarkdown(input: VideoPlan | unknown): string {
  const plan = videoPlanSchema.parse(input), ratio = Object.entries(standardFormats).find(([, size]) => size[0] === plan.format.width && size[1] === plan.format.height)?.[0];
  const lines = ['---', `id: ${plan.id}`, `title: ${plan.name}`, `format: ${ratio ?? `${plan.format.width}x${plan.format.height}`}`, `fps: ${plan.format.fps}`, `prompt: ${plan.brief.prompt}`, ...(plan.brief.audience ? [`audience: ${plan.brief.audience}`] : []), ...(plan.brief.goal ? [`goal: ${plan.brief.goal}`] : []), ...(plan.brief.targetDurationSeconds ? [`duration: ${plan.brief.targetDurationSeconds}s`] : []), '---', ''];
  for (const [name, declaration] of Object.entries(plan.variables)) lines.push(`> Variable ${name}: ${declaration.type}${declaration.default === undefined ? '' : ` = ${declaration.default}`}`);
  if (plan.design) lines.splice(2, 0, `design: ${JSON.stringify(plan.design)}`);
  if (Object.keys(plan.variables).length) lines.push('');
  for (const source of plan.sources) lines.push(`> Source [${source.id}]: ${source.url ?? source.title ?? ''}${source.quote ? ` | ${source.quote}` : ''}`);
  if (plan.sources.length) lines.push('');
  for (const beat of plan.beats) lines.push(`# ${beat.intent}`, `ID: ${beat.id}`, `Duration: ${beat.durationSeconds}s`, ...(beat.onScreen ? [`On-screen: ${beat.onScreen}`] : []), ...(beat.narration ? [`Narration: ${beat.narration}`] : []), ...(beat.claim ? [`Claim: ${beat.claim}`] : []), ...(beat.sourceIds.length ? [`Source: ${beat.sourceIds.join(', ')}`] : []), ...(beat.visual.scene ? [`Scene: ${beat.visual.scene}`] : []), ...(beat.visual.direction ? [`Visual: ${beat.visual.direction}`] : []), ...(beat.visual.asset ? [`Asset: ${beat.visual.asset}`] : []), ...(beat.visual.module ? [`Module: ${beat.visual.module}`] : []), ...(beat.visual.transition !== 'cut' ? [`Transition: ${beat.visual.transition}`] : []), '');
  for (const beat of plan.beats) if (beat.visual.input) {
    const index = lines.indexOf(`ID: ${beat.id}`);
    lines.splice(index + 1, 0, `Scene-input: ${JSON.stringify(beat.visual.input)}`);
  }
  return lines.join('\n').trimEnd() + '\n';
}
