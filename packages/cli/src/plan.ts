import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { compileVideoPlan, createReleaseManifest, diffVideoPlans, editVideoPlan, parseVideoMarkdown, planCollaborationStatus, recommendPlanAssets, recommendScenes, reviewPlanAssets, reviewVideoPlan, sceneCatalog, videoPlanSummary } from '@ove/core';
import { createProvider, directVideoPlan, directDesignedVideo, directReactDesign, type ProviderConfig } from '@ove/ai';
import { videoPlanSchema, type VideoPlan } from '@ove/schema';

const option = (argv: string[], name: string) => { const at = argv.indexOf(name); return at < 0 ? undefined : argv[at + 1]; };
const options = (argv: string[], name: string) => argv.flatMap((value, index) => value === name && argv[index + 1] ? [argv[index + 1]!] : []);
const readJson = async (file: string) => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const describe = (error: unknown) => (error as any)?.issues?.map((issue: any) => `- ${issue.path.join('.') || 'plan'}: ${issue.message}`).join('\n') ?? (error as Error).message;

export function readVideoPlan(raw: unknown): VideoPlan {
  const parsed = videoPlanSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`The video plan cannot be used:\n${describe(parsed.error)}`);
  return parsed.data;
}
export async function readVideoPlanFile(file: string): Promise<VideoPlan> {
  const text = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  return readVideoPlan(file.toLowerCase().endsWith('.md') ? parseVideoMarkdown(text) : JSON.parse(text));
}

export async function runPlan(argv: string[]): Promise<number> {
  const sub = argv[1], file = argv[2];
  if (!sub || sub.startsWith('--') || (!file && sub !== 'catalog') || file?.startsWith('--')) throw new Error('Usage: mr plan direct "creative brief" [--output video.md]\n   or: mr plan catalog [what-the-beat-needs]\n   or: mr plan assets <video.md|video.plan.json> [--beat id]\n   or: mr plan status <video.md|video.plan.json> [--channel web]\n   or: mr plan release <video.md|video.plan.json> [--channel web] [--output release.json]\n   or: mr plan validate <video.md|video.plan.json>\n   or: mr plan review <video.md|video.plan.json>\n   or: mr plan compile <video.md|video.plan.json> [--output composition.json]\n   or: mr plan edit <video.md|video.plan.json> --edits edits.json [--output refined.plan.json]\n   or: mr plan diff <before> <after>');
  if (sub !== 'direct' && sub !== 'catalog' && sub !== 'assets' && sub !== 'status' && sub !== 'release' && sub !== 'validate' && sub !== 'review' && sub !== 'compile' && sub !== 'edit' && sub !== 'diff') throw new Error(`Unknown plan command "${sub}"; use direct, catalog, assets, status, release, validate, review, compile, edit or diff`);
  if (sub === 'catalog') {
    const choices = file ? recommendScenes({ intent: file, onScreen: file }) : sceneCatalog.map(scene => ({ ...scene, score: 0, reasons: ['catalog entry'], missing: [] }));
    for (const scene of choices) console.log(`${scene.id} (${scene.score}) — ${scene.purpose}\n  Required: ${scene.inputs.filter(input => input.required).map(input => input.name).join(', ') || 'none'}\n  ${scene.reasons.join('; ')}`);
    return 0;
  }
  if (sub === 'direct') {
    const aspect = option(argv, '--format') ?? '16:9', sizes: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350], '3:4': [1080, 1440] };
    const custom = /^(\d+)x(\d+)$/i.exec(aspect), size = custom ? [Number(custom[1]), Number(custom[2])] as [number, number] : sizes[aspect];
    if (!size) throw new Error('--format must be 9:16, 16:9, 1:1, 4:5, 3:4, or WIDTHxHEIGHT');
    const duration = option(argv, '--duration') ? Number(option(argv, '--duration')) : 15, fps = option(argv, '--fps') ? Number(option(argv, '--fps')) : 30;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('--duration must be a positive number');
    if (!Number.isInteger(fps) || fps <= 0) throw new Error('--fps must be a positive integer');
    const provider = createProvider({ provider: option(argv, '--provider'), model: option(argv, '--model'), baseUrl: option(argv, '--base-url') } satisfies ProviderConfig);
    if (argv.includes('--react')) {
      if (!['9:16', '16:9', '4:5', '1:1'].includes(aspect)) throw new Error('React design supports 9:16, 16:9, 4:5 and 1:1');
      const output = resolve(option(argv, '--output') ?? 'explainer.json');
      if (extname(output).toLowerCase() !== '.json') throw new Error('React design output must be an explainer JSON file');
      for (const unsupported of ['--fps', '--duration', '--avoid', '--constrained']) {
        if (argv.includes(unsupported)) throw new Error(unsupported + ' is for semantic plans. React designs use the explainer timeline.');
      }
      const brief = [file, option(argv, '--audience') && 'Audience: ' + option(argv, '--audience'), option(argv, '--goal') && 'Goal: ' + option(argv, '--goal')].filter(Boolean).join('\n');
      const script = await directReactDesign(provider, brief, aspect as '16:9' | '9:16' | '1:1' | '4:5', Number(option(argv, '--max-attempts') ?? 3));
      await writeFile(output, JSON.stringify(script, null, 2) + '\n');
      console.log(`Wrote ${script.scenes.length} React scene designs to ${output}. Build with mr make "${output}".`);
      return 0;
    }
    const director = argv.includes('--constrained') ? directDesignedVideo : directVideoPlan;
    const previousPlans = await Promise.all(options(argv, '--avoid').flatMap(value => value.split(',')).map(path => readVideoPlanFile(resolve(path))));
    const directed = await director(provider, file, { previousPlans, durationSeconds: duration, width: size[0], height: size[1], fps, audience: option(argv, '--audience'), goal: option(argv, '--goal'), maxAttempts: option(argv, '--max-attempts') ? Number(option(argv, '--max-attempts')) : undefined, onProgress: message => console.log(message) });
    const output = resolve(option(argv, '--output') ?? 'video.md');
    await writeFile(output, directed.markdown);
    console.log(`Wrote reviewed semantic plan to ${output} (${directed.plan.beats.length} beats; ${directed.attempts} director attempt${directed.attempts === 1 ? '' : 's'}).`);
    for (const issue of directed.review) console.log(`${issue.severity === 'warning' ? 'WARN' : 'INFO'}${issue.beatId ? ` [beat ${issue.beatId}]` : ''} ${issue.message}`);
    console.log(`Next: mr make ${output}${argv.includes('--draft') ? ' --draft' : argv.includes('--final') ? ' --final' : ''}`);
    return 0;
  }
  const path = resolve(file), plan = await readVideoPlanFile(path), summary = videoPlanSummary(plan);
  if (sub === 'assets') {
    const beat = option(argv, '--beat');
    const recommendations = beat ? { [beat]: recommendPlanAssets(plan, beat) } : Object.fromEntries(plan.beats.map(item => [item.id, recommendPlanAssets(plan, item.id).slice(0, 3)]));
    console.log(JSON.stringify({ recommendations, issues: reviewPlanAssets(plan) }, null, 2));
    return 0;
  }
  if (sub === 'release') {
    const manifest = createReleaseManifest(plan, { channels: options(argv, '--channel'), requireFinalApproval: !argv.includes('--no-final-approval') });
    const output = option(argv, '--output');
    if (output) { const target = resolve(output); await writeFile(target, JSON.stringify(manifest, null, 2) + '\n'); console.log(`Wrote ${manifest.status} release manifest to ${target}`); }
    else console.log(JSON.stringify(manifest, null, 2));
    return manifest.status === 'ready' ? 0 : 2;
  }
  if (sub === 'status') {
    console.log(JSON.stringify(planCollaborationStatus(plan, { channels: options(argv, '--channel') }), null, 2));
    return 0;
  }
  if (sub === 'diff') {
    const after = argv[3]; if (!after || after.startsWith('--')) throw new Error('mr plan diff needs both <before.plan.json> and <after.plan.json>');
    const diff = diffVideoPlans(plan, await readVideoPlanFile(resolve(after)));
    console.log(JSON.stringify(diff, null, 2));
    return 0;
  }
  if (sub === 'validate') {
    console.log(`Valid video plan "${plan.name}" (${summary.beats} beats, ${summary.seconds.toFixed(1)} s, ${summary.placeholders} editable placeholder${summary.placeholders === 1 ? '' : 's'})`);
    return 0;
  }
  if (sub === 'review') {
    const issues = reviewVideoPlan(plan);
    if (!issues.length) console.log('Plan review: clean.');
    else for (const issue of issues) console.log(`${issue.severity === 'warning' ? 'WARN' : 'info'}${issue.beatId ? ` [beat ${issue.beatId}]` : ''} ${issue.message}`);
    return 0;
  }
  if (sub === 'edit') {
    const editsFile = option(argv, '--edits');
    if (!editsFile) throw new Error('mr plan edit needs --edits edits.json');
    const result = editVideoPlan(plan, await readJson(resolve(editsFile)));
    const output = resolve(option(argv, '--output') ?? `${path.slice(0, -extname(path).length)}.edited.json`);
    if (output === path) throw new Error('--output must not overwrite the source plan; review the semantic diff first');
    await writeFile(output, JSON.stringify(result.plan, null, 2) + '\n');
    console.log(`Wrote refined plan to ${output}`);
    for (const change of result.changes) console.log(`  ${change.message}`);
    return 0;
  }
  const { composition, notes } = compileVideoPlan(plan), output = resolve(option(argv, '--output') ?? `${dirname(path)}/composition.json`);
  if (output === path) throw new Error('--output must not overwrite the video plan');
  await writeFile(output, JSON.stringify(composition, null, 2) + '\n');
  console.log(`Compiled ${summary.beats} semantic beats to ${output}`);
  for (const note of notes) console.log(`  note: ${note}`);
  return 0;
}
