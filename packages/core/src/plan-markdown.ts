import { type SceneInput, type VideoPlan, videoPlanSchema } from '@ove/schema';

const standardFormats: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], '3:4': [1080, 1440] };
const value = (text: string) => text.trim().replace(/^['"]|['"]$/g, '');
const seconds = (text: string) => { const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(value(text)); return match ? Number(match[1]) : undefined; };
const entries = (body: string) => body.split(/\r?\n/).flatMap(line => {
  const match = /^(?:-\s+)?([A-Za-z][\w -]*):\s*(.*)$/.exec(line.trim());
  return match ? [[match[1]!.toLowerCase().replace(/\s+/g, '-'), value(match[2]!)] as const] : [];
});
const fields = (body: string) => Object.fromEntries(entries(body));
const inline = (text: string) => !/[\r\n]/.test(text) && value(text) === text;
const stopsIn = (text?: string) => text?.split(/\s*(?:→|->)\s*/).map(value);
const pair = (text: string, label: string, syntax: string) => {
  const parts = text.split('|').map(value);
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error(`${label} needs ${syntax}`);
  return [parts[0], parts[1]] as const;
};

function markdownScene(body: string, data: ReturnType<typeof fields>, title: string) {
  if (data['scene-input']) return JSON.parse(data['scene-input']);
  const all = (field: string) => entries(body).filter(([key]) => key === field).map(([, text]) => text);
  const type = data.scene;
  const common = { type, headline: data.headline ?? data['on-screen'] ?? title, layout: data.layout, choreography: data.choreography };
  switch (type) {
    case 'route': {
      const trips = all('trip').map(line => {
        const [name, path] = pair(line, 'Trip', 'a name | Stop → Stop');
        return { name, via: stopsIn(path)! };
      });
      const arrival = (line: string, label: string): Extract<SceneInput, { type: 'route' }>['cue'] => {
        const [name, trip] = pair(line, label, 'a label | Trip → Stop (or Trip → #visit)');
        const [tripName, stop, extra] = stopsIn(trip)!;
        if (!tripName || !stop || extra !== undefined) throw new Error(`${label} needs a trip and an arrival stop or #visit`);
        return { name, trip: tripName, ...(/^#\d+$/.test(stop) ? { visit: Number(stop.slice(1)) } : { stop }) };
      };
      const last = trips.at(-1);
      const cue = data.arrival ? arrival(data.arrival, 'Arrival') : last && { name: 'Arrival', trip: last.name, visit: last.via.length };
      const saved = data.save ? arrival(data.save, 'Save') : undefined;
      const save = saved && { label: saved.name, trip: saved.trip, stop: saved.stop, visit: saved.visit };
      return { ...common, variant: data.variant, stops: stopsIn(data.stops) ?? [...new Set(trips.flatMap(trip => trip.via))], trips, cue, save };
    }
    case 'split': return { ...common, origin: data.origin, variant: data.variant, branches: all('branch').map(line => {
      const [endpoint, direction] = pair(line, 'Branch', 'an endpoint | direction');
      return { endpoint, direction };
    }) };
    case 'fold': return { ...common, variant: data.variant, inside: data.inside, cover: data.cover, artwork: data.artwork ?? 'print', direction: data.direction ?? 'right-to-left' };
    case 'workflow': return all('step').length ? { ...common, steps: all('step') } : undefined;
    case 'before-after': return data.before !== undefined || data.after !== undefined
      ? { type, layout: data.layout, choreography: data.choreography, before: data.before, after: data.after } : undefined;
    case 'kinetic-hook':
    case 'decisive-cta': return data.headline || data.layout || data.choreography || data['on-screen'] ? common : undefined;
    default: return undefined;
  }
}

function formatScene(input: SceneInput): string[] {
  const base = [...('headline' in input ? [`Headline: ${input.headline}`] : []), ...(input.layout ? [`Layout: ${input.layout}`] : []), ...(input.choreography ? [`Choreography: ${input.choreography}`] : [])];
  if ('variant' in input && input.variant) base.push(`Variant: ${input.variant}`);
  switch (input.type) {
    case 'route': {
      const arrival = (event: typeof input.cue) =>
        `${event.name} | ${event.trip} → ${event.visit === undefined ? event.stop : '#' + event.visit}`;
      // The inline grammar reserves these delimiters. Preserve exceptional legacy labels losslessly.
      if ([...input.stops, ...input.trips.map(trip => trip.name), input.cue.name, input.save?.label ?? ''].some(label => !inline(label) || /[|→]|->|^#\d+$/.test(label))
        || [input.cue, input.save].some(event => event?.visit !== undefined && event.stop !== undefined)) {
        return [`Scene-input: ${JSON.stringify(input)}`];
      }
      return [...base, `Stops: ${input.stops.join(' → ')}`, ...input.trips.map(trip => `Trip: ${trip.name} | ${trip.via.join(' → ')}`),
        `Arrival: ${arrival(input.cue)}`, ...(input.save ? [`Save: ${arrival({ ...input.save, name: input.save.label })}`] : [])];
    }
    case 'split': return input.branches.some(branch => !inline(branch.endpoint) || branch.endpoint.includes('|'))
      ? [`Scene-input: ${JSON.stringify(input)}`]
      : [...base, `Origin: ${input.origin}`, ...input.branches.map(branch => `Branch: ${branch.endpoint} | ${branch.direction}`)];
    case 'fold': return [...base, `Inside: ${input.inside}`, `Cover: ${input.cover}`, `Artwork: ${input.artwork}`, `Direction: ${input.direction}`];
    case 'workflow': return input.steps.every(inline) ? [...base, ...input.steps.map(step => `Step: ${step}`)] : [`Scene-input: ${JSON.stringify(input)}`];
    case 'before-after': return [...base, `Before: ${input.before}`, `After: ${input.after}`];
    default: return base;
  }
}

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
  const dimensions = /^(\d+)x(\d+)$/i.exec(meta.format ?? '');
  const format = dimensions ? [Number(dimensions[1]), Number(dimensions[2])] : standardFormats[meta.format ?? ''];
  const title = meta.title ?? meta.name ?? 'Untitled video';
  const sceneModules = [...body.matchAll(/^>\s*React\s*\[([^\]\n]+)\]:[ \t]*([^\n]+)$/gmi)]
    .map(match => ({ id: value(match[1]!), src: value(match[2]!) }));
  const beats = headings.map((heading, index) => {
    const data = fields(heading[2]!);
    let input: unknown;
    try { input = markdownScene(heading[2]!, data, heading[1]!); }
    catch (error) { throw new Error(`Beat "${heading[1]}": ${(error as Error).message}`, { cause: error }); }
    const visual = { input, direction: data.visual, scene: data.scene, asset: data.asset, module: data.module, transition: data.transition, fit: data['media-fit'] };
    const storyboard = ['visible', 'change', 'takeaway', 'moment'].some(key => key in data)
      ? { cue: data.cue, visible: data.visible, change: data.change, takeaway: data.takeaway, moment: data.moment?.trim() ? Number(data.moment) : undefined }
      : undefined;
    return { storyboard, id: data.id ?? (heading[1]!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `beat-${index + 1}`), intent: data.intent ?? heading[1]!, durationSeconds: seconds(data.duration ?? '') ?? 3, onScreen: data['on-screen'], narration: data.narration, claim: data.claim, sourceIds: data.source ? data.source.split(',').map(value).filter(Boolean) : [], visual };
  });
  const variables = Object.fromEntries(variableLines.map(match => {
    const type = match[2]!, raw = match[3] ? value(match[3]!) : undefined;
    const parsed = raw === undefined ? undefined : type === 'number' ? Number(raw) : type === 'boolean' ? raw.toLowerCase() === 'true' : raw;
    return [match[1]!, { type, ...(parsed === undefined ? {} : { default: parsed }) }];
  }));
  return videoPlanSchema.parse({ version: '1.0', kind: 'video-plan', id: meta.id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: title,
    brief: { prompt: meta.prompt ?? meta.goal ?? title, audience: meta.audience, goal: meta.goal, targetDurationSeconds: seconds(meta.duration ?? '') },
    format: { width: format?.[0] ?? (Number(meta.width) || 1920), height: format?.[1] ?? (Number(meta.height) || 1080), fps: Number(meta.fps) || 30 }, variables, sceneModules,
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
  for (const module of plan.sceneModules) lines.push(`> React [${module.id}]: ${module.src}`);
  if (plan.sceneModules.length) lines.push('');
  for (const beat of plan.beats) lines.push(`# ${beat.intent}`, `ID: ${beat.id}`, `Duration: ${beat.durationSeconds}s`, ...(beat.storyboard ? [...(beat.storyboard.cue ? [`Cue: ${beat.storyboard.cue}`] : []), `Visible: ${beat.storyboard.visible}`, `Change: ${beat.storyboard.change}`, `Takeaway: ${beat.storyboard.takeaway}`, `Moment: ${beat.storyboard.moment}`] : []), ...(beat.onScreen ? [`On-screen: ${beat.onScreen}`] : []), ...(beat.narration ? [`Narration: ${beat.narration}`] : []), ...(beat.claim ? [`Claim: ${beat.claim}`] : []), ...(beat.sourceIds.length ? [`Source: ${beat.sourceIds.join(', ')}`] : []), ...(beat.visual.scene ? [`Scene: ${beat.visual.scene}`] : []), ...(beat.visual.direction ? [`Visual: ${beat.visual.direction}`] : []), ...(beat.visual.asset ? [`Asset: ${beat.visual.asset}`] : []), ...(beat.visual.module ? [`Module: ${beat.visual.module}`] : []), ...(beat.visual.transition !== 'cut' ? [`Transition: ${beat.visual.transition}`] : []), '');
  for (const beat of plan.beats) if (beat.visual.input) {
    const index = lines.indexOf(`ID: ${beat.id}`);
    const input = beat.visual.input;
    const readable = beat.visual.scene === input.type && Object.values(input).every(field => typeof field !== 'string' || inline(field));
    lines.splice(index + 1, 0, ...(readable ? formatScene(input) : [`Scene-input: ${JSON.stringify(input)}`]));
  }
  return lines.join('\n').trimEnd() + '\n';
}
